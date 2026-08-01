'use client';

import { useState } from 'react';
import { X, Save, Loader2, ShieldCheck, Upload, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { normalizeGstInput, GST_REGEX } from '../lib/formHelpers';

const API_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  '';

/**
 * Inline admin editor for a retailer document.
 *
 * Fields covered:
 *  - Business name / trade name
 *  - GSTIN + revalidate button (calls Appyflow live)
 *  - GST certificate upload (base64 for now; swap to object-storage later)
 *  - SPOC name / phone
 *  - Status  (active / pending / suspended)
 *  - Verified Partner toggle
 *
 * All writes go through PUT /api/retailers/admin/{retailer_id}. GST-cert
 * upload posts to POST /api/retailers/admin/{retailer_id}/gst-certificate
 * (added in the backend at the same time as this component).
 */
export default function RetailerEditModal({ retailer, authFetch, open, onClose, onSaved }) {
  const [form, setForm] = useState({
    business_name: retailer.business_name || '',
    trade_name: retailer.trade_name || '',
    gst_number: retailer.gst_number || '',
    spoc_name: retailer.spoc?.name || '',
    spoc_phone: retailer.spoc?.phone || '',
    status: retailer.status || 'pending',
    is_addrika_verified_partner: !!retailer.is_addrika_verified_partner,
  });
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [gstCertName, setGstCertName] = useState(
    retailer.gst_certificate_filename || null
  );

  const rid = retailer.retailer_id || retailer.id;

  if (!open) return null;

  const setF = (patch) => setForm((f) => ({ ...f, ...patch }));

  const gstOk = GST_REGEX.test((form.gst_number || '').toUpperCase());

  const revalidateGST = async () => {
    if (!gstOk) {
      toast.error('Enter a valid 15-character GSTIN before revalidating');
      return;
    }
    setVerifying(true);
    try {
      const r = await fetch(
        `${API_URL}/api/retailer-auth/waitlist/gst-lookup/${form.gst_number}`,
        { cache: 'no-store' }
      );
      const d = await r.json();
      if (r.ok && d.verified) {
        toast.success(
          `GST verified: ${d.business_name || d.legal_name} · ${d.status || 'Active'}`,
          { duration: 6000 }
        );
        setF({
          business_name: d.business_name || form.business_name,
          trade_name: d.trade_name || form.trade_name,
        });
      } else {
        toast.error(d.error || 'Could not verify GSTIN with Appyflow');
      }
    } catch (e) {
      toast.error('Network error while contacting Appyflow');
    } finally {
      setVerifying(false);
    }
  };

  const uploadGSTCertificate = async (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('GST certificate must be under 5 MB');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file, file.name);
      const r = await authFetch(
        `${API_URL}/api/retailers/admin/${rid}/documents/gst-certificate`,
        { method: 'POST', body: fd }
      );
      if (r.ok) {
        toast.success('GST certificate uploaded');
        setGstCertName(file.name);
      } else {
        const err = await r.json().catch(() => ({}));
        toast.error(err.detail || 'Upload failed');
      }
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (form.gst_number && !gstOk) {
      toast.error('GSTIN format is invalid. Fix or clear before saving.');
      return;
    }
    setSaving(true);
    try {
      const body = {
        business_name: form.business_name?.trim(),
        trade_name: form.trade_name?.trim() || null,
        gst_number: form.gst_number || null,
        spoc_name: form.spoc_name?.trim() || null,
        phone: form.spoc_phone?.trim() || null,
        status: form.status,
        is_addrika_verified_partner: !!form.is_addrika_verified_partner,
      };
      const r = await authFetch(`${API_URL}/api/retailers/admin/${rid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        toast.success('Retailer updated');
        onSaved?.();
        onClose();
      } else {
        const err = await r.json().catch(() => ({}));
        toast.error(err.detail || 'Save failed');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
      data-testid="retailer-edit-modal"
    >
      <div
        className="relative w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: '#1a1a2e', border: '1px solid rgba(212,175,55,0.3)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <h3 className="text-white text-lg font-semibold">
            Edit Retailer&nbsp;·&nbsp;<span className="text-[#D4AF37]">{retailer.business_name || rid}</span>
          </h3>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Business name / trade name */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-white/60 uppercase tracking-widest">Business name</span>
              <input
                data-testid="edit-business-name"
                value={form.business_name}
                onChange={(e) => setF({ business_name: e.target.value })}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white"
              />
            </label>
            <label className="block">
              <span className="text-xs text-white/60 uppercase tracking-widest">Trade name</span>
              <input
                value={form.trade_name}
                onChange={(e) => setF({ trade_name: e.target.value })}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white"
              />
            </label>
          </div>

          {/* GSTIN + revalidate */}
          <div>
            <span className="text-xs text-white/60 uppercase tracking-widest">GSTIN — revalidation is mandatory before saving edits</span>
            <div className="mt-1 flex gap-2">
              <input
                data-testid="edit-gst"
                value={form.gst_number}
                onChange={(e) => setF({ gst_number: normalizeGstInput(e.target.value) })}
                placeholder="22AAAAA0000A1Z5"
                className={`flex-1 px-3 py-2 rounded-lg bg-slate-800 border text-white font-mono uppercase ${
                  form.gst_number
                    ? gstOk
                      ? 'border-emerald-500/60'
                      : 'border-red-500/60'
                    : 'border-slate-700'
                }`}
              />
              <button
                type="button"
                onClick={revalidateGST}
                disabled={verifying || !gstOk}
                data-testid="edit-gst-revalidate"
                className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
                style={{ background: '#D4AF37', color: '#1a1a2e' }}
              >
                {verifying ? <Loader2 size={16} className="animate-spin inline" /> : <><RefreshCw size={14} className="inline mr-1" />Revalidate</>}
              </button>
            </div>
            {form.gst_number && !gstOk && (
              <p className="mt-1 text-xs text-red-400">Invalid GSTIN format</p>
            )}
          </div>

          {/* GST cert upload */}
          <div>
            <span className="text-xs text-white/60 uppercase tracking-widest">GST certificate (PDF/JPG/PNG, ≤5MB)</span>
            <label className="mt-1 flex items-center gap-2 cursor-pointer">
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                className="hidden"
                data-testid="edit-gst-cert-file"
                onChange={(e) => e.target.files && uploadGSTCertificate(e.target.files[0])}
              />
              <span
                className="px-3 py-2 rounded-lg text-sm inline-flex items-center gap-2"
                style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.35)' }}
              >
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {gstCertName ? `Replace (${gstCertName})` : 'Upload certificate'}
              </span>
            </label>
          </div>

          {/* SPOC name + phone */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-white/60 uppercase tracking-widest">SPOC name</span>
              <input
                data-testid="edit-spoc-name"
                value={form.spoc_name}
                onChange={(e) => setF({ spoc_name: e.target.value })}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white"
              />
            </label>
            <label className="block">
              <span className="text-xs text-white/60 uppercase tracking-widest">SPOC phone / WhatsApp</span>
              <input
                value={form.spoc_phone}
                onChange={(e) => setF({ spoc_phone: e.target.value })}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white"
              />
            </label>
          </div>

          {/* Status + verified partner */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-white/60 uppercase tracking-widest">Status</span>
              <select
                data-testid="edit-status"
                value={form.status}
                onChange={(e) => setF({ status: e.target.value })}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white"
              >
                <option value="pending">Pending</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </label>
            <label className="flex items-end gap-2 cursor-pointer">
              <input
                data-testid="edit-verified-partner"
                type="checkbox"
                checked={form.is_addrika_verified_partner}
                onChange={(e) => setF({ is_addrika_verified_partner: e.target.checked })}
                className="w-5 h-5 accent-[#D4AF37]"
              />
              <span className="text-white text-sm inline-flex items-center gap-1">
                <ShieldCheck size={16} className="text-[#D4AF37]" /> Show "Verified Partner" ribbon publicly
              </span>
            </label>
          </div>
        </div>

        <div className="px-6 py-4 flex justify-end gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-white/70 hover:text-white">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            data-testid="edit-save-btn"
            className="px-5 py-2 rounded-lg font-semibold inline-flex items-center gap-2 disabled:opacity-50"
            style={{ background: '#D4AF37', color: '#1a1a2e' }}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}
