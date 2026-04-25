'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, Mail, Phone, MapPin, FileText, UserPlus, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { authFetch } from '../../layout';
import KYCVerificationCard from '../../../../components/KYCVerificationCard';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const STATUS_OPTIONS = ['new', 'contacted', 'onboarded', 'archived'];
const STATUS_COLORS = {
  new: 'bg-blue-100 text-blue-800',
  contacted: 'bg-amber-100 text-amber-800',
  onboarded: 'bg-emerald-100 text-emerald-800',
  archived: 'bg-slate-100 text-slate-600',
};

export default function AdminB2BWaitlistPage() {
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({});
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedKyc, setExpandedKyc] = useState({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const url = `${API_URL}/api/admin/b2b-waitlist${filter ? `?status=${filter}` : ''}`;
      const res = await authFetch(url);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setItems(data.items || []);
      setCounts(data.status_counts || {});
    } catch (e) {
      toast.error('Failed to load waitlist');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateStatus = async (id, status) => {
    try {
      const res = await authFetch(
        `${API_URL}/api/admin/b2b-waitlist/${id}/status`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        }
      );
      if (!res.ok) throw new Error();
      toast.success(`Marked as ${status}`);
      fetchData();
    } catch {
      toast.error('Failed to update status');
    }
  };

  const onboardRetailer = async (id, businessName) => {
    if (
      !confirm(
        `Onboard "${businessName}" as a B2B retailer?\n\nWe'll create their account using verified GST data and email them a one-click "set your password" link (24h validity).`
      )
    )
      return;
    try {
      const res = await authFetch(
        `${API_URL}/api/admin/b2b-waitlist/${id}/onboard`,
        { method: 'POST' }
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.detail || 'Onboarding failed');
        return;
      }
      toast.success(
        `Onboarded as ${data.retailer_id} — invite email sent`
      );
      fetchData();
    } catch {
      toast.error('Onboarding failed');
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-waitlist-page">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/b2b"
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
            B2B Retailer Waitlist
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
            Captured from the &quot;Coming Soon&quot; retailer login screen.
          </p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilter('')}
          className={`px-3 py-1.5 text-sm rounded-lg ${
            filter === '' ? 'bg-slate-800 text-white' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700'
          }`}
        >
          All ({items.length})
        </button>
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 text-sm rounded-lg capitalize ${
              filter === s ? 'bg-slate-800 text-white' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700'
            }`}
          >
            {s} ({counts[s] || 0})
          </button>
        ))}
        <button
          onClick={fetchData}
          className="ml-auto px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-1"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <RefreshCw className="animate-spin text-slate-400" size={24} />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center text-slate-500">
          No waitlist entries yet.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((w) => (
            <div
              key={w.id}
              className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5"
              data-testid={`waitlist-item-${w.id}`}
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
                    {w.business_name}
                  </h3>
                  <p className="text-sm text-slate-500">{w.contact_name}</p>
                </div>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[w.status] || STATUS_COLORS.new}`}
                >
                  {w.status}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-sm text-slate-600 dark:text-slate-300 mb-3">
                <span className="flex items-center gap-1">
                  <Mail size={14} /> {w.email}
                </span>
                <span className="flex items-center gap-1">
                  <Phone size={14} /> {w.phone}
                </span>
                {w.city && (
                  <span className="flex items-center gap-1">
                    <MapPin size={14} /> {w.city}
                  </span>
                )}
                {w.gst_number && (
                  <span className="flex items-center gap-1">
                    <FileText size={14} /> {w.gst_number}
                  </span>
                )}
              </div>
              {w.message && (
                <p className="text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 p-3 rounded-lg mb-3">
                  {w.message}
                </p>
              )}
              <div className="flex gap-2 flex-wrap items-center">
                {!w.retailer_id && (
                  <button
                    onClick={() => onboardRetailer(w.id, w.business_name)}
                    className="px-3 py-1 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white inline-flex items-center gap-1 font-medium"
                    data-testid={`waitlist-onboard-${w.id}`}
                  >
                    <UserPlus size={12} /> Onboard as Retailer
                  </button>
                )}
                {w.retailer_id && (
                  <Link
                    href={`/admin/b2b/retailers/${w.retailer_id}`}
                    className="px-3 py-1 text-xs rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 inline-flex items-center gap-1"
                    data-testid={`waitlist-view-retailer-${w.id}`}
                  >
                    View {w.retailer_id}
                  </Link>
                )}
                {STATUS_OPTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => updateStatus(w.id, s)}
                    disabled={w.status === s}
                    className={`px-3 py-1 text-xs rounded-lg capitalize ${
                      w.status === s
                        ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-default'
                        : 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200'
                    }`}
                    data-testid={`waitlist-mark-${s}-${w.id}`}
                  >
                    Mark {s}
                  </button>
                ))}
                <button
                  onClick={() =>
                    setExpandedKyc((prev) => ({ ...prev, [w.id]: !prev[w.id] }))
                  }
                  className="px-3 py-1 text-xs rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 inline-flex items-center gap-1 ml-auto"
                  data-testid={`waitlist-kyc-toggle-${w.id}`}
                >
                  <ShieldCheck size={12} />
                  KYC
                  {expandedKyc[w.id] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  {(w.pan_verified || w.aadhaar_verified) && (
                    <span className="ml-1 text-[10px] bg-emerald-600 text-white rounded-full px-1.5">
                      {[w.pan_verified && 'PAN', w.aadhaar_verified && 'AADHAAR']
                        .filter(Boolean)
                        .join('+')}
                    </span>
                  )}
                </button>
              </div>
              {expandedKyc[w.id] && (
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                  <KYCVerificationCard
                    waitlistId={w.id}
                    admin
                    onComplete={fetchData}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
