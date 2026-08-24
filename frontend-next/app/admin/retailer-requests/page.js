'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  RefreshCw,
  Mail,
  Phone,
  FileText,
  CheckCircle2,
  XCircle,
  Ban,
  Undo2,
  Trash2,
  StickyNote,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Clock,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import { authFetch } from '../layout';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const STATUSES = [
  { key: '', label: 'All', color: 'bg-slate-100 text-slate-700' },
  { key: 'under_processing', label: 'Under Processing', color: 'bg-amber-100 text-amber-800' },
  { key: 'verified', label: 'Verified', color: 'bg-emerald-100 text-emerald-800' },
  { key: 'revoked', label: 'Revoked', color: 'bg-orange-100 text-orange-800' },
  { key: 'suspended', label: 'Suspended', color: 'bg-red-100 text-red-800' },
];

const STATUS_STYLE = {
  under_processing: 'bg-amber-100 text-amber-800',
  verified: 'bg-emerald-100 text-emerald-800',
  revoked: 'bg-orange-100 text-orange-800',
  suspended: 'bg-red-100 text-red-800',
  active: 'bg-emerald-100 text-emerald-800',
};

const STATUS_ICON = {
  under_processing: Clock,
  verified: ShieldCheck,
  revoked: Undo2,
  suspended: Ban,
  active: ShieldCheck,
};

export default function AdminRetailerRequestsPage() {
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({});
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const url = `${API_URL}/api/admin/retailer-requests${filter ? `?status=${filter}` : ''}`;
      const res = await authFetch(url);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setItems(data.items || []);
      setCounts(data.status_counts || {});
    } catch {
      toast.error('Failed to load retailer requests');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const doAction = async (path, opts, successMsg) => {
    try {
      const res = await authFetch(`${API_URL}/api/admin/retailer-requests${path}`, opts);
      const ctype = res.headers.get('content-type') || '';
      const data = ctype.includes('json') ? await res.json().catch(() => ({})) : {};
      if (!res.ok) {
        toast.error(data.detail || `Action failed (${res.status})`);
        return null;
      }
      toast.success(successMsg);
      await fetchData();
      return data;
    } catch {
      toast.error('Network error');
      return null;
    }
  };

  const approve = (r) =>
    confirm(`Approve ${r.business_name} (${r.gst_number})?\n\nRetailer will get dashboard access immediately.`) &&
    doAction(`/${r.retailer_id}/approve`, { method: 'POST' }, 'Retailer approved');

  const revoke = (r) => {
    const reason = prompt(`Revoke access for ${r.business_name}?\n\nOptional reason (shown in audit log):`) ?? null;
    if (reason === null) return;
    doAction(
      `/${r.retailer_id}/revoke`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason || null }),
      },
      'Retailer access revoked'
    );
  };

  const suspend = (r) => {
    const reason = prompt(`Suspend ${r.business_name}?\n\nEnter a reason (required, retailer sees this at login):`);
    if (!reason || reason.trim().length < 3) {
      if (reason !== null) toast.error('Please provide a reason (min 3 chars)');
      return;
    }
    doAction(
      `/${r.retailer_id}/suspend`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      },
      'Retailer suspended'
    );
  };

  const unsuspend = (r) =>
    confirm(`Move ${r.business_name} back to Under Processing for a fresh review?`) &&
    doAction(`/${r.retailer_id}/unsuspend`, { method: 'POST' }, 'Moved to Under Processing');

  const addNote = (r) => {
    const body = prompt(`Add a note to ${r.business_name}:`);
    if (!body || !body.trim()) return;
    doAction(
      `/${r.retailer_id}/notes`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: body.trim() }),
      },
      'Note added'
    );
  };

  const deleteRequest = (r) => {
    if (
      !confirm(
        `Permanently delete ${r.business_name}?\n\nThis removes their account, sessions and all notes. The GST certificate becomes inaccessible.`
      )
    )
      return;
    doAction(`/${r.retailer_id}`, { method: 'DELETE' }, 'Retailer deleted');
  };

  const viewCertificate = (r) => {
    // Uses admin session cookie — opens in a new tab
    window.open(`${API_URL}/api/admin/retailer-requests/${r.retailer_id}/certificate`, '_blank', 'noopener');
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8" data-testid="admin-retailer-requests">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Admin
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-7 h-7 text-[#D4AF37]" />
              Retailer KYC Requests
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Self-registered retailers awaiting manual verification. Approve to grant dashboard access.
            </p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            data-testid="refresh-btn"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Status pills */}
        <div className="flex flex-wrap gap-2 mb-6" data-testid="status-filters">
          {STATUSES.map((s) => {
            const count = s.key === '' ? Object.values(counts).reduce((a, b) => a + b, 0) : counts[s.key] || 0;
            const active = filter === s.key;
            return (
              <button
                key={s.key || 'all'}
                onClick={() => setFilter(s.key)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                  active ? 'bg-[#2B3A4A] text-white shadow' : `${s.color} hover:opacity-80`
                }`}
                data-testid={`filter-${s.key || 'all'}`}
              >
                {s.label} <span className="ml-1 opacity-70">({count})</span>
              </button>
            );
          })}
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 border-4 border-[#2B3A4A] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center border border-slate-200">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">
              No retailer requests{filter ? ` with status "${filter.replace('_', ' ')}"` : ''}.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((r) => {
              const StatusIcon = STATUS_ICON[r.status] || Clock;
              const isOpen = expandedId === r.retailer_id;
              return (
                <div
                  key={r.retailer_id}
                  className="bg-white rounded-xl border border-slate-200 overflow-hidden"
                  data-testid={`row-${r.retailer_id}`}
                >
                  <div className="p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="text-lg font-semibold text-slate-900 truncate">
                            {r.business_name}
                          </h3>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                              STATUS_STYLE[r.status] || 'bg-slate-100 text-slate-600'
                            }`}
                            data-testid={`status-${r.retailer_id}`}
                          >
                            <StatusIcon className="w-3 h-3" />
                            {r.status.replace('_', ' ')}
                          </span>
                          {r.gst_verified ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-50 text-emerald-700 font-medium">
                              <CheckCircle2 className="w-3 h-3" /> GST OK
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-50 text-amber-800 font-medium">
                              <ShieldAlert className="w-3 h-3" /> GST unverified
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
                          <span className="flex items-center gap-1">
                            <Mail className="w-3.5 h-3.5" /> {r.email}
                          </span>
                          <span className="flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5" /> {r.country_code} {r.phone}
                          </span>
                          <span className="font-mono text-xs text-slate-700">{r.gst_number}</span>
                          {r.city && <span>{r.city}, {r.state}</span>}
                        </div>
                        {r.status === 'suspended' && r.suspended_reason && (
                          <p className="mt-2 text-xs text-red-700 bg-red-50 rounded px-2 py-1 inline-block">
                            <strong>Suspended:</strong> {r.suspended_reason}
                          </p>
                        )}
                        {r.status === 'revoked' && r.revoked_reason && (
                          <p className="mt-2 text-xs text-orange-700 bg-orange-50 rounded px-2 py-1 inline-block">
                            <strong>Revoked:</strong> {r.revoked_reason}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        {r.has_certificate && (
                          <button
                            onClick={() => viewCertificate(r)}
                            title="View GST certificate"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs bg-slate-100 text-slate-700 hover:bg-slate-200"
                            data-testid={`view-cert-${r.retailer_id}`}
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> Cert
                          </button>
                        )}
                        {r.status !== 'verified' && (
                          <button
                            onClick={() => approve(r)}
                            title="Approve KYC"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs bg-emerald-600 text-white hover:bg-emerald-700"
                            data-testid={`approve-${r.retailer_id}`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                          </button>
                        )}
                        {r.status === 'verified' && (
                          <button
                            onClick={() => revoke(r)}
                            title="Revoke verification"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs bg-orange-600 text-white hover:bg-orange-700"
                            data-testid={`revoke-${r.retailer_id}`}
                          >
                            <Undo2 className="w-3.5 h-3.5" /> Revoke
                          </button>
                        )}
                        {r.status !== 'suspended' ? (
                          <button
                            onClick={() => suspend(r)}
                            title="Suspend (blocks login)"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs bg-red-600 text-white hover:bg-red-700"
                            data-testid={`suspend-${r.retailer_id}`}
                          >
                            <Ban className="w-3.5 h-3.5" /> Suspend
                          </button>
                        ) : (
                          <button
                            onClick={() => unsuspend(r)}
                            title="Unsuspend"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs bg-amber-600 text-white hover:bg-amber-700"
                            data-testid={`unsuspend-${r.retailer_id}`}
                          >
                            <Undo2 className="w-3.5 h-3.5" /> Unsuspend
                          </button>
                        )}
                        <button
                          onClick={() => addNote(r)}
                          title="Add a note"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs bg-slate-100 text-slate-700 hover:bg-slate-200"
                          data-testid={`note-${r.retailer_id}`}
                        >
                          <StickyNote className="w-3.5 h-3.5" /> Note
                        </button>
                        <button
                          onClick={() => deleteRequest(r)}
                          title="Delete request"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs bg-white border border-red-300 text-red-700 hover:bg-red-50"
                          data-testid={`delete-${r.retailer_id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setExpandedId(isOpen ? null : r.retailer_id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                          data-testid={`toggle-${r.retailer_id}`}
                        >
                          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="border-t border-slate-100 bg-slate-50 px-4 sm:px-5 py-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Details</p>
                          <dl className="space-y-1">
                            <div className="flex justify-between gap-2"><dt className="text-slate-600">Retailer ID</dt><dd className="font-mono text-slate-800">{r.retailer_id}</dd></div>
                            <div className="flex justify-between gap-2"><dt className="text-slate-600">Trade name</dt><dd className="text-slate-800">{r.trade_name || '—'}</dd></div>
                            <div className="flex justify-between gap-2"><dt className="text-slate-600">Address</dt><dd className="text-slate-800">{r.address || '—'}</dd></div>
                            <div className="flex justify-between gap-2"><dt className="text-slate-600">Pincode</dt><dd className="text-slate-800">{r.pincode || '—'}</dd></div>
                            <div className="flex justify-between gap-2"><dt className="text-slate-600">Created</dt><dd className="text-slate-800">{r.created_at?.slice(0, 19).replace('T', ' ') || '—'}</dd></div>
                            {r.verified_at && (
                              <div className="flex justify-between gap-2"><dt className="text-slate-600">Verified at</dt><dd className="text-slate-800">{r.verified_at?.slice(0, 19).replace('T', ' ')}</dd></div>
                            )}
                            {r.certificate_filename && (
                              <div className="flex justify-between gap-2"><dt className="text-slate-600">Certificate</dt><dd className="text-slate-800 truncate">{r.certificate_filename}</dd></div>
                            )}
                          </dl>
                        </div>

                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase mb-1">
                            Notes ({r.admin_notes?.length || 0})
                          </p>
                          {(!r.admin_notes || r.admin_notes.length === 0) ? (
                            <p className="text-slate-500 italic">No notes yet.</p>
                          ) : (
                            <ul className="space-y-2 max-h-60 overflow-y-auto pr-1" data-testid={`notes-${r.retailer_id}`}>
                              {[...r.admin_notes].reverse().map((n) => (
                                <li
                                  key={n.id}
                                  className={`text-xs p-2 rounded ${
                                    n.kind === 'audit' ? 'bg-slate-100 text-slate-700' : 'bg-white border border-slate-200 text-slate-800'
                                  }`}
                                >
                                  <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
                                    <span>{n.author}</span>
                                    <span>{n.created_at?.slice(0, 19).replace('T', ' ')}</span>
                                  </div>
                                  {n.body}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
