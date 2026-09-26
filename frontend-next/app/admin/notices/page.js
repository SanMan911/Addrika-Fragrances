'use client';

import { useState, useEffect, useCallback } from 'react';
import { MailCheck, Loader2, Send, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { authFetch } from '../layout';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export default function AdminNoticesPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await authFetch(`${API_URL}/api/admin/retailer-notices/gstin-login`);
      if (!res.ok) throw new Error('Failed to load notice status');
      setData(await res.json());
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const send = async () => {
    if (!window.confirm(`Send the GSTIN login notice to ${data.pending_count} retailer(s)?`)) return;
    setSending(true);
    try {
      const res = await authFetch(`${API_URL}/api/admin/retailer-notices/gstin-login/send`, { method: 'POST' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.detail || 'Send failed');
      toast.success(body.message);
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-400 p-6">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading notices…
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6" data-testid="admin-notices-page">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <MailCheck className="text-[#D4AF37]" size={22} /> Retailer Notices
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          One-off announcements to your B2B retailers. Each retailer is stamped once sent, so nobody gets it twice.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div>
            <h2 className="font-semibold text-slate-800 dark:text-white">“Your GSTIN is now your login ID”</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Subject: {data.subject}</p>
            <div className="flex items-center gap-4 mt-3 text-sm">
              <span className="text-amber-400 font-semibold" data-testid="notice-pending-count">
                {data.pending_count} pending
              </span>
              <span className="text-emerald-400 font-semibold" data-testid="notice-sent-count">
                {data.sent_count} already sent
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPreview((s) => !s)}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-600 text-slate-300 hover:bg-slate-700/40 flex items-center gap-1.5"
              data-testid="notice-preview-toggle"
            >
              {showPreview ? <EyeOff size={14} /> : <Eye size={14} />}
              {showPreview ? 'Hide preview' : 'Preview email'}
            </button>
            <button
              onClick={send}
              disabled={sending || data.pending_count === 0}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#D4AF37] text-[#1a1410] hover:brightness-110 disabled:opacity-50 flex items-center gap-1.5"
              data-testid="notice-send-btn"
            >
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Send to {data.pending_count}
            </button>
          </div>
        </div>

        {showPreview && (
          <div className="rounded-xl overflow-hidden border border-slate-700" data-testid="notice-preview">
            <iframe
              title="Notice preview"
              srcDoc={data.preview_html}
              className="w-full h-[520px] bg-white"
            />
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-5">
          <h3 className="text-sm font-semibold text-amber-400 mb-3">Pending ({data.pending_count})</h3>
          {data.pending_count === 0 ? (
            <p className="text-xs text-slate-500">Everyone eligible has been notified.</p>
          ) : (
            <div className="space-y-1.5" data-testid="notice-pending-list">
              {data.pending.map((r) => (
                <div key={r.retailer_id} className="flex items-center justify-between text-xs px-3 py-2 rounded bg-slate-900/40">
                  <span className="text-slate-300 truncate">{r.business_name || r.name}</span>
                  <span className="font-mono text-slate-500">{r.gst_number}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-5">
          <h3 className="text-sm font-semibold text-emerald-400 mb-3">Sent ({data.sent_count})</h3>
          {data.sent_count === 0 ? (
            <p className="text-xs text-slate-500">Nothing sent yet.</p>
          ) : (
            <div className="space-y-1.5" data-testid="notice-sent-list">
              {data.sent.map((r) => (
                <div key={r.retailer_id} className="flex items-center justify-between text-xs px-3 py-2 rounded bg-slate-900/40">
                  <span className="text-slate-300 truncate flex items-center gap-1.5">
                    <CheckCircle2 size={12} className="text-emerald-400" />
                    {r.business_name || r.name}
                  </span>
                  <span className="text-slate-500">
                    {r.gstin_login_notice_sent_at
                      ? new Date(r.gstin_login_notice_sent_at).toLocaleDateString()
                      : '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
