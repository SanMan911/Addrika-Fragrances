'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Sparkles, Edit2, EyeOff, Save, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { authFetch } from '../layout';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const STAT_LABELS = {
  lifetime_orders: 'Lifetime orders',
  lifetime_gmv_inr: 'Lifetime GMV (₹)',
  monthly_order_streak: 'Consecutive months ordering',
  active_months: 'Total active months',
};

const AROMA_TONES = {
  cedar: 'bg-amber-100 text-amber-900 border-amber-300',
  sandalwood: 'bg-orange-100 text-orange-900 border-orange-300',
  oudh: 'bg-purple-100 text-purple-900 border-purple-300',
  musk: 'bg-rose-100 text-rose-900 border-rose-300',
  amber: 'bg-yellow-100 text-yellow-900 border-yellow-300',
  kewda: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  rose: 'bg-pink-100 text-pink-900 border-pink-300',
};

const emptyForm = {
  name: '',
  aroma_tag: 'sandalwood',
  stat: 'lifetime_orders',
  threshold: 5,
  description: '',
  order: 100,
  is_active: true,
};

export default function AdminMilestonesPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // milestone_id or 'new' or null
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_URL}/api/admin/milestones`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRows(data.milestones || []);
    } catch (e) {
      toast.error('Failed to load milestones');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const startEdit = (m) => {
    setEditing(m.id);
    setForm({
      name: m.name || '',
      aroma_tag: m.aroma_tag || 'sandalwood',
      stat: m.stat || 'lifetime_orders',
      threshold: m.threshold || 0,
      description: m.description || '',
      order: m.order ?? 100,
      is_active: m.is_active !== false,
    });
  };

  const startNew = () => { setEditing('new'); setForm(emptyForm); };

  const cancel = () => { setEditing(null); setForm(emptyForm); };

  const save = async () => {
    setSaving(true);
    try {
      const url = editing === 'new'
        ? `${API_URL}/api/admin/milestones`
        : `${API_URL}/api/admin/milestones/${editing}`;
      const res = await authFetch(url, {
        method: editing === 'new' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, threshold: Number(form.threshold), order: Number(form.order) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
      toast.success(editing === 'new' ? 'Milestone created' : 'Milestone updated');
      cancel();
      load();
    } catch (e) {
      toast.error(e.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const deactivate = async (m) => {
    if (!window.confirm(
      `Deactivate "${m.name}"?\n\n` +
      `Retailers who already earned this tag KEEP it — the achievement timestamp is immutable audit history. Deactivation just prevents new retailers from earning this milestone.`,
    )) return;
    try {
      const res = await authFetch(`${API_URL}/api/admin/milestones/${m.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success('Milestone deactivated');
      load();
    } catch (e) {
      toast.error(e.message || 'Failed');
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-milestones-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Sparkles size={22} className="text-amber-500" /> Patron Milestones
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Configure the aroma-themed patron tags retailers unlock as they grow with Addrika.
              <br/>
              <span className="text-xs italic">Achievement timestamps are immutable — audit history is preserved even after edits or deactivation.</span>
            </p>
          </div>
        </div>
        <button
          onClick={startNew}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold"
          data-testid="new-milestone-btn"
        >
          <Plus size={16} /> New Milestone
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-slate-500">Loading…</div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/40 text-slate-600 dark:text-slate-300 text-left">
              <tr>
                <th className="px-4 py-3">Tag</th>
                <th className="px-4 py-3">Stat</th>
                <th className="px-4 py-3 text-right">Threshold</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3 text-right">Order</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {rows.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40" data-testid={`milestone-row-${m.id}`}>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${AROMA_TONES[m.aroma_tag] || 'bg-slate-100 text-slate-700 border-slate-300'}`}>
                      <Sparkles size={10} /> {m.name}
                    </span>
                    <div className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">{m.aroma_tag}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{STAT_LABELS[m.stat] || m.stat}</td>
                  <td className="px-4 py-3 text-right font-semibold">{Number(m.threshold).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 max-w-md">{m.description}</td>
                  <td className="px-4 py-3 text-right text-slate-400 text-xs">{m.order}</td>
                  <td className="px-4 py-3">
                    {m.is_active ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Active</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Retired</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      <button
                        onClick={() => startEdit(m)}
                        className="p-2 rounded hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                        data-testid={`edit-milestone-${m.id}`}
                      >
                        <Edit2 size={14} />
                      </button>
                      {m.is_active && (
                        <button
                          onClick={() => deactivate(m)}
                          className="p-2 rounded hover:bg-rose-100 dark:hover:bg-rose-900/30 text-rose-700 dark:text-rose-300"
                          data-testid={`deactivate-milestone-${m.id}`}
                          title="Deactivate (retailers keep already-earned tags)"
                        >
                          <EyeOff size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={cancel}>
          <div
            className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 max-w-lg w-full"
            onClick={(e) => e.stopPropagation()}
            data-testid="milestone-form-modal"
          >
            <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                {editing === 'new' ? 'New Milestone' : 'Edit Milestone'}
              </h3>
              <button onClick={cancel} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              <Field label="Tag name" testid="milestone-name">
                <input
                  value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Kewda Guardian"
                  className="w-full px-3 py-2 rounded-lg bg-slate-900/60 dark:bg-slate-900/60 border border-slate-600 text-white text-sm"
                />
              </Field>
              <Field label="Aroma family (used to theme the badge colour)" testid="milestone-aroma">
                <select
                  value={form.aroma_tag} onChange={(e) => setForm({ ...form, aroma_tag: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900/60 dark:bg-slate-900/60 border border-slate-600 text-white text-sm"
                >
                  {Object.keys(AROMA_TONES).map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </Field>
              <Field label="Stat" testid="milestone-stat">
                <select
                  value={form.stat} onChange={(e) => setForm({ ...form, stat: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900/60 dark:bg-slate-900/60 border border-slate-600 text-white text-sm"
                >
                  {Object.entries(STAT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              <Field label="Threshold" testid="milestone-threshold">
                <input
                  type="number" min={0}
                  value={form.threshold}
                  onChange={(e) => setForm({ ...form, threshold: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900/60 dark:bg-slate-900/60 border border-slate-600 text-white text-sm"
                />
              </Field>
              <Field label="Description (shown on retailer profile)" testid="milestone-description">
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="input resize-none"
                />
              </Field>
              <Field label="Display order (lower = shown first)" testid="milestone-order">
                <input
                  type="number" min={0}
                  value={form.order}
                  onChange={(e) => setForm({ ...form, order: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900/60 dark:bg-slate-900/60 border border-slate-600 text-white text-sm"
                />
              </Field>
              {editing !== 'new' && (
                <label className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  />
                  Active — retailers can still earn this
                </label>
              )}
            </div>
            <div className="p-5 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
              <button onClick={cancel} className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300">Cancel</button>
              <button
                onClick={save}
                disabled={saving || !form.name.trim()}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold flex items-center gap-2 disabled:opacity-50"
                data-testid="save-milestone-btn"
              >
                <Save size={14} /> {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children, testid }) {
  return (
    <div data-testid={testid}>
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">{label}</label>
      {children}
    </div>
  );
}
