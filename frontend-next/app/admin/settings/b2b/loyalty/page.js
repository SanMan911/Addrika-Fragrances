'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, RefreshCw, Save, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { authFetch } from '../../../layout';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const formatCurrency = (v) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(v || 0);

export default function AdminLoyaltyPage() {
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newMilestone, setNewMilestone] = useState({
    min_purchase: '',
    discount_percent: '',
    label: '',
  });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_URL}/api/admin/b2b-loyalty/milestones`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMilestones(data.milestones || []);
    } catch {
      toast.error('Failed to load milestones');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const add = async () => {
    const min = Number(newMilestone.min_purchase);
    const dp = Number(newMilestone.discount_percent);
    if (!min || !dp) {
      toast.error('Enter min purchase and discount %');
      return;
    }
    try {
      const res = await authFetch(`${API_URL}/api/admin/b2b-loyalty/milestones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          min_purchase: min,
          discount_percent: dp,
          label: newMilestone.label || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Create failed');
      }
      toast.success('Milestone added');
      setNewMilestone({ min_purchase: '', discount_percent: '', label: '' });
      fetchAll();
    } catch (e) {
      toast.error(e.message || 'Failed to add');
    }
  };

  const saveOne = async (m) => {
    try {
      const res = await authFetch(
        `${API_URL}/api/admin/b2b-loyalty/milestones/${m.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            min_purchase: Number(m.min_purchase),
            discount_percent: Number(m.discount_percent),
            label: m.label,
            is_active: m.is_active,
          }),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Update failed');
      }
      toast.success('Milestone updated');
      fetchAll();
    } catch (e) {
      toast.error(e.message || 'Update failed');
    }
  };

  const delOne = async (id) => {
    if (!confirm('Delete this milestone?')) return;
    try {
      const res = await authFetch(
        `${API_URL}/api/admin/b2b-loyalty/milestones/${id}`,
        { method: 'DELETE' }
      );
      if (!res.ok) throw new Error();
      toast.success('Deleted');
      fetchAll();
    } catch {
      toast.error('Delete failed');
    }
  };

  const updateField = (idx, key, value) => {
    setMilestones((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [key]: value };
      return next;
    });
  };

  return (
    <div className="space-y-6" data-testid="admin-loyalty-page">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/settings/b2b"
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <TrendingUp size={22} /> Quarterly Loyalty Milestones
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm max-w-2xl">
            Retailers earn an automatic bonus on their NEXT order when their
            paid-purchases in the current calendar quarter cross a milestone.
            The highest-matching milestone is applied on subtotal BEFORE the
            1.5% online-payment discount.
          </p>
        </div>
      </div>

      {/* Add new */}
      <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <h2 className="text-lg font-semibold mb-3 text-slate-800 dark:text-white">
          Add a milestone
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input
            type="number"
            placeholder="Min purchase (₹)"
            value={newMilestone.min_purchase}
            onChange={(e) =>
              setNewMilestone({ ...newMilestone, min_purchase: e.target.value })
            }
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            data-testid="new-milestone-min"
          />
          <input
            type="number"
            step="0.1"
            placeholder="Discount %"
            value={newMilestone.discount_percent}
            onChange={(e) =>
              setNewMilestone({
                ...newMilestone,
                discount_percent: e.target.value,
              })
            }
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            data-testid="new-milestone-pct"
          />
          <input
            type="text"
            placeholder="Label (optional)"
            value={newMilestone.label}
            onChange={(e) =>
              setNewMilestone({ ...newMilestone, label: e.target.value })
            }
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
          />
          <button
            onClick={add}
            className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 flex items-center gap-2"
            data-testid="new-milestone-add"
          >
            <Plus size={16} /> Add milestone
          </button>
        </div>
      </section>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <RefreshCw className="animate-spin text-slate-400" size={24} />
        </div>
      ) : milestones.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center text-slate-500">
          No milestones configured.
        </div>
      ) : (
        <div className="space-y-3">
          {milestones.map((m, idx) => (
            <div
              key={m.id}
              className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4"
              data-testid={`milestone-row-${m.id}`}
            >
              <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto_auto] gap-3 items-center">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">
                    Min purchase (₹)
                  </label>
                  <input
                    type="number"
                    value={m.min_purchase}
                    onChange={(e) =>
                      updateField(idx, 'min_purchase', e.target.value)
                    }
                    className="w-full px-3 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    {formatCurrency(m.min_purchase)}
                  </p>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">
                    Discount %
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={m.discount_percent}
                    onChange={(e) =>
                      updateField(idx, 'discount_percent', e.target.value)
                    }
                    className="w-full px-3 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">
                    Label
                  </label>
                  <input
                    type="text"
                    value={m.label || ''}
                    onChange={(e) => updateField(idx, 'label', e.target.value)}
                    className="w-full px-3 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                </div>
                <label className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={!!m.is_active}
                    onChange={(e) =>
                      updateField(idx, 'is_active', e.target.checked)
                    }
                    data-testid={`milestone-active-${m.id}`}
                  />
                  Active
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => saveOne(m)}
                    className="p-2 rounded bg-slate-800 text-white hover:bg-slate-900"
                    data-testid={`milestone-save-${m.id}`}
                  >
                    <Save size={16} />
                  </button>
                  <button
                    onClick={() => delOne(m.id)}
                    className="p-2 rounded bg-red-100 text-red-600 hover:bg-red-200"
                    data-testid={`milestone-delete-${m.id}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
