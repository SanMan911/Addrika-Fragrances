'use client';

import { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Loader2,
  AlertCircle,
  CheckCircle2,
  IdCard,
  KeyRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { authFetch } from '../app/admin/layout';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

/**
 * Reusable KYC widget — wraps Sandbox API PAN + Aadhaar OTP eKYC.
 * Gracefully degrades when the backend reports `enabled: false`
 * (i.e. SANDBOX_API_KEY/SECRET still placeholders).
 *
 * Props:
 *   waitlistId? string  — persists result on retailer_waitlist row
 *   retailerId? string  — persists result on retailers row
 *   admin?     bool     — if true, calls /api/admin/kyc/* (auth-gated);
 *                          else calls /api/retailer-auth/kyc/* (public)
 *   defaultPan? string  — pre-fill PAN field
 *   onComplete? fn      — invoked after PAN ✓ + Aadhaar ✓
 */
export default function KYCVerificationCard({
  waitlistId,
  retailerId,
  admin = false,
  defaultPan = '',
  onComplete,
}) {
  const base = admin ? '/api/admin/kyc' : '/api/retailer-auth/kyc';
  const fetcher = admin ? authFetch : (u, o) => fetch(u, o);

  const [enabled, setEnabled] = useState(null);
  const [pan, setPan] = useState(defaultPan);
  const [panLoading, setPanLoading] = useState(false);
  const [panResult, setPanResult] = useState(null);

  const [aadhaar, setAadhaar] = useState('');
  const [otp, setOtp] = useState('');
  const [refId, setRefId] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [aadhaarResult, setAadhaarResult] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetcher(`${API_URL}${base}/status`);
        if (!r.ok) {
          setEnabled(false);
          return;
        }
        const data = await r.json();
        setEnabled(!!data.enabled);
      } catch {
        setEnabled(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin]);

  const verifyPan = async () => {
    const v = (pan || '').toUpperCase().trim();
    if (v.length !== 10) {
      toast.error('PAN must be exactly 10 characters');
      return;
    }
    setPanLoading(true);
    try {
      const res = await fetcher(`${API_URL}${base}/pan/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pan_number: v,
          waitlist_id: waitlistId,
          retailer_id: retailerId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.detail || 'PAN verification failed');
        return;
      }
      setPanResult(data);
      if (data.verified) toast.success('PAN verified');
      else toast.warning(data.error || 'PAN could not be verified');
    } catch {
      toast.error('PAN verification failed');
    } finally {
      setPanLoading(false);
    }
  };

  const generateOtp = async () => {
    const v = (aadhaar || '').replace(/\s|-/g, '').trim();
    if (v.length !== 12 || !/^\d{12}$/.test(v)) {
      toast.error('Aadhaar must be exactly 12 digits');
      return;
    }
    setOtpLoading(true);
    try {
      const res = await fetcher(`${API_URL}${base}/aadhaar/otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aadhaar_number: v }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.detail || 'OTP request failed');
        return;
      }
      setRefId(data.reference_id);
      toast.success('OTP sent to your Aadhaar-linked mobile');
    } catch {
      toast.error('OTP request failed');
    } finally {
      setOtpLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!refId) {
      toast.error('Generate OTP first');
      return;
    }
    if (!/^\d{6}$/.test(otp)) {
      toast.error('OTP must be 6 digits');
      return;
    }
    setVerifyLoading(true);
    try {
      const res = await fetcher(`${API_URL}${base}/aadhaar/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference_id: refId,
          otp,
          waitlist_id: waitlistId,
          retailer_id: retailerId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.detail || 'OTP verify failed');
        return;
      }
      setAadhaarResult(data);
      if (data.verified) {
        toast.success('Aadhaar verified');
        if (panResult?.verified && onComplete) onComplete();
      } else {
        toast.warning(data.error || 'Could not verify');
      }
    } catch {
      toast.error('OTP verify failed');
    } finally {
      setVerifyLoading(false);
    }
  };

  if (enabled === null) {
    return (
      <div
        className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg flex items-center gap-2 text-sm text-slate-500"
        data-testid="kyc-card-loading"
      >
        <Loader2 className="animate-spin" size={14} /> Checking KYC service…
      </div>
    );
  }

  if (!enabled) {
    return (
      <div
        className="p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-800 dark:text-amber-200 flex items-start gap-2"
        data-testid="kyc-card-disabled"
      >
        <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium">KYC service not yet activated</p>
          <p className="text-xs mt-0.5 opacity-80">
            Add <code>SANDBOX_API_KEY</code> + <code>SANDBOX_API_SECRET</code>{' '}
            in <code>backend/.env</code> to enable PAN + Aadhaar verification.
            <br />
            Get free credentials at{' '}
            <a
              href="https://app.sandbox.co.in/signup"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              app.sandbox.co.in
            </a>
            .
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 space-y-4"
      data-testid="kyc-card"
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
        <ShieldCheck size={16} className="text-emerald-600" />
        KYC Verification
      </div>

      {/* PAN block */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1">
          <IdCard size={12} /> PAN Number
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={pan}
            onChange={(e) => setPan(e.target.value.toUpperCase())}
            placeholder="ABCDE1234F"
            maxLength={10}
            className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-900 outline-none focus:border-emerald-500 uppercase tracking-wider"
            data-testid="kyc-pan-input"
            disabled={panResult?.verified}
          />
          <button
            type="button"
            onClick={verifyPan}
            disabled={panLoading || panResult?.verified}
            className="px-3 py-1.5 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white"
            data-testid="kyc-pan-verify-btn"
          >
            {panLoading ? (
              <Loader2 className="animate-spin" size={14} />
            ) : panResult?.verified ? (
              <CheckCircle2 size={14} />
            ) : (
              'Verify'
            )}
          </button>
        </div>
        {panResult && panResult.verified && (
          <p
            className="text-xs text-emerald-700 dark:text-emerald-400"
            data-testid="kyc-pan-result"
          >
            ✓ {panResult.full_name || 'Valid'}
            {panResult.status ? ` (${panResult.status})` : ''}
          </p>
        )}
        {panResult && !panResult.verified && (
          <p className="text-xs text-amber-700">
            {panResult.error || 'Could not verify PAN'}
          </p>
        )}
      </div>

      {/* Aadhaar block */}
      <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-700">
        <label className="text-xs font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1">
          <KeyRound size={12} /> Aadhaar OTP eKYC
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={aadhaar}
            onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, ''))}
            placeholder="12-digit Aadhaar"
            maxLength={12}
            inputMode="numeric"
            className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-900 outline-none focus:border-emerald-500 tracking-wider"
            data-testid="kyc-aadhaar-input"
            disabled={!!refId}
          />
          <button
            type="button"
            onClick={generateOtp}
            disabled={otpLoading || !!refId}
            className="px-3 py-1.5 text-sm rounded-lg bg-slate-700 hover:bg-slate-800 disabled:opacity-50 text-white whitespace-nowrap"
            data-testid="kyc-aadhaar-otp-btn"
          >
            {otpLoading ? (
              <Loader2 className="animate-spin" size={14} />
            ) : refId ? (
              'Sent'
            ) : (
              'Send OTP'
            )}
          </button>
        </div>
        {refId && !aadhaarResult?.verified && (
          <div className="flex gap-2">
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="6-digit OTP"
              maxLength={6}
              inputMode="numeric"
              className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-900 outline-none focus:border-emerald-500 tracking-widest text-center"
              data-testid="kyc-otp-input"
            />
            <button
              type="button"
              onClick={verifyOtp}
              disabled={verifyLoading}
              className="px-3 py-1.5 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white"
              data-testid="kyc-otp-verify-btn"
            >
              {verifyLoading ? <Loader2 className="animate-spin" size={14} /> : 'Verify OTP'}
            </button>
          </div>
        )}
        {aadhaarResult && aadhaarResult.verified && (
          <p
            className="text-xs text-emerald-700 dark:text-emerald-400"
            data-testid="kyc-aadhaar-result"
          >
            ✓ {aadhaarResult.name}
            {aadhaarResult.aadhaar_last_4
              ? ` · XXXX-XXXX-${aadhaarResult.aadhaar_last_4}`
              : ''}
          </p>
        )}
      </div>
    </div>
  );
}
