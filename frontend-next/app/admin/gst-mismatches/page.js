'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ShieldAlert, RefreshCw, CheckCircle2, Store, Mail, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { authFetch } from '../layout';

const API_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  '';

const VERDICT_LABEL = {
  match: 'matches',
  mismatch: 'DIFFERENT',
  indeterminate: 'could not compare',
};

const MismatchRow = ({ label, entered, record, verdict, icon: Icon }) => (
  <tr className={verdict === 'mismatch' ? 'text-red-700 dark:text-red-400' : 'text-slate-600 dark:text-slate-300'}>
    <td className="py-1.5 pr-3 whitespace-nowrap">
      <span className="flex items-center gap-1.5 font-sans">
        <Icon size={13} />
        {label}
      </span>
    </td>
    <td className="py-1.5 pr-3 font-mono break-all">{entered || '—'}</td>
    <td className="py-1.5 pr-3 font-mono break-all">{record || '—'}</td>
    <td className={`py-1.5 font-sans text-[11px] font-bold whitespace-nowrap ${
      verdict === 'mismatch' ? 'text-red-600 dark:text-red-400'
        : verdict === 'match' ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-amber-600 dark:text-amber-400'
    }`}>
      {VERDICT_LABEL[verdict] || verdict || '—'}
    </td>
  </tr>
);

export default function AdminGstMismatchesPage() {
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({ pending: 0, reviewed: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [saving, setSaving] = useState('');

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const qs = filter === 'all' ? '' : `?reviewed=${filter === 'reviewed'}`;
      const res = await authFetch(`${API_URL}/api/retailers/admin/gst-contact-mismatches${qs}`);
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setRows(data.retailers || []);
      setCounts(data.counts || { pending: 0, reviewed: 0, total: 0 });
    } catch {
      toast.error('Could not load the mismatch queue');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const toggleReviewed = async (retailer, next) => {
    const rid = retailer.retailer_id;
    setSaving(rid);
    try {
      const res = await authFetch(`${API_URL}/api/retailers/admin/${rid}/gst-contact-review`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewed: next }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success(next ? 'Marked as reviewed' : 'Moved back to pending');
      fetchRows();
    } catch {
      toast.error('Could not update review status');
    } finally {
      setSaving('');
    }
  };

  const tabs = useMemo(() => ([
    { key: 'pending', label: `Needs review (${counts.pending})` },
    { key: 'reviewed', label: `Reviewed (${counts.reviewed})` },
    { key: 'all', label: `All (${counts.total})` },
  ]), [counts]);

  return (
    <div className="space-y-6" data-testid="admin-gst-mismatches-page">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <ShieldAlert className="text-amber-500" size={24} />
          GST Contact Mismatches
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
          Retailers who proved ownership of their GST-registered email by OTP, but whose entered mobile
          or email differs from the GST record. Tick each one once you&apos;ve checked it.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            data-testid={`mismatch-tab-${t.key}`}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              filter === t.key
                ? 'bg-amber-600 text-white'
                : 'border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
        <button
          onClick={fetchRows}
          disabled={loading}
          data-testid="mismatch-refresh"
          className="ml-auto flex items-center gap-2 px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <RefreshCw className="animate-spin text-slate-400" size={28} />
        </div>
      ) : rows.length === 0 ? (
        <div
          className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-10 text-center"
          data-testid="mismatch-empty"
        >
          <CheckCircle2 className="mx-auto text-emerald-500 mb-3" size={32} />
          <p className="text-slate-600 dark:text-slate-300 font-medium">
            {filter === 'pending' ? 'Nothing waiting for review' : 'No records here'}
          </p>
          <p className="text-slate-400 text-sm mt-1">
            Mismatches appear automatically when a retailer registers with details that differ from their GST record.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((r) => {
            const chk = r.gst_contact_check || {};
            const reviewed = Boolean(r.gst_contact_mismatch_reviewed);
            return (
              <div
                key={r.retailer_id}
                className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5"
                data-testid={`mismatch-card-${r.retailer_id}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                      <Store size={18} className="text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-slate-800 dark:text-white truncate">
                        {r.business_name || r.trade_name || 'Unnamed store'}
                      </h3>
                      <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                        {r.gst_number} · {r.retailer_id}
                      </p>
                      {r.manual_review_reason && (
                        <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                          {r.manual_review_reason}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-2 py-1 rounded-full text-[11px] font-semibold ${
                      r.status === 'active'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                    }`}>
                      {(r.status || 'pending').toUpperCase()}
                    </span>
                    <button
                      onClick={() => toggleReviewed(r, !reviewed)}
                      disabled={saving === r.retailer_id}
                      data-testid={`mismatch-review-toggle-${r.retailer_id}`}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition disabled:opacity-50 ${
                        reviewed
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 hover:opacity-90'
                      }`}
                    >
                      <CheckCircle2 size={15} />
                      {reviewed ? 'Reviewed' : 'Mark reviewed'}
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs" data-testid={`mismatch-table-${r.retailer_id}`}>
                    <thead>
                      <tr className="text-slate-500 dark:text-slate-400 text-left border-b border-slate-200 dark:border-slate-700">
                        <th className="font-medium pb-1.5 pr-3">Field</th>
                        <th className="font-medium pb-1.5 pr-3">They entered</th>
                        <th className="font-medium pb-1.5 pr-3">GST record (IDSPay)</th>
                        <th className="font-medium pb-1.5">Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      <MismatchRow
                        label="Mobile" icon={Phone}
                        entered={chk.entered_mobile} record={chk.gst_mobile} verdict={chk.mobile_verdict}
                      />
                      <MismatchRow
                        label="Email" icon={Mail}
                        entered={chk.entered_email} record={chk.gst_email} verdict={chk.email_verdict}
                      />
                    </tbody>
                  </table>
                </div>

                {reviewed && r.gst_contact_mismatch_reviewed_at && (
                  <p className="text-[11px] text-slate-400 mt-3">
                    Reviewed {new Date(r.gst_contact_mismatch_reviewed_at).toLocaleString('en-IN')}
                    {r.gst_contact_mismatch_reviewed_by ? ` by ${r.gst_contact_mismatch_reviewed_by}` : ''}
                  </p>
                )}

                <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-slate-200 dark:border-slate-700">
                  <a
                    href={`/admin/b2b/retailers/${r.retailer_id}`}
                    className="px-3 py-1.5 rounded-lg text-sm bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-200"
                    data-testid={`mismatch-open-${r.retailer_id}`}
                  >
                    Open retailer
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
