'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle2, AlertTriangle, Lock, ShieldCheck } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import Link from 'next/link';
import KYCVerificationCard from '../../../components/KYCVerificationCard';

const API_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  '';

function SetupPasswordInner() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') || '';

  const [status, setStatus] = useState({ state: 'checking' });
  const [pwd, setPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState('password'); // 'password' | 'kyc' | 'done'

  useEffect(() => {
    if (!token) {
      setStatus({ state: 'invalid', reason: 'Missing invitation token in link' });
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          `${API_URL}/api/retailer-auth/setup-password/validate/${token}`
        );
        const data = await res.json();
        if (!data.valid) {
          setStatus({ state: 'invalid', reason: data.reason || 'Invalid link' });
          return;
        }
        setStatus({ state: 'valid', ...data });
      } catch {
        setStatus({ state: 'invalid', reason: 'Could not validate link' });
      }
    })();
  }, [token]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (pwd.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (pwd !== confirm) {
      toast.error('Passwords do not match');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/retailer-auth/setup-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: pwd }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.detail || 'Setup failed');
        return;
      }
      toast.success('Password set — let\'s verify your identity');
      setStep('kyc');
    } catch {
      toast.error('Setup failed');
    } finally {
      setSubmitting(false);
    }
  };

  const finishOnboarding = () => {
    setStep('done');
    setTimeout(() => router.push('/retailer/login'), 1500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#2B3A4A] p-4">
      <Toaster position="top-center" richColors />
      <div className="bg-[#F5EFE0] rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <div className={`inline-flex items-center justify-center w-14 h-14 rounded-full mb-3 ${step === 'kyc' ? 'bg-emerald-600' : step === 'done' ? 'bg-emerald-600' : 'bg-[#D4AF37]'}`}>
            {step === 'kyc' ? (
              <ShieldCheck className="w-7 h-7 text-white" />
            ) : step === 'done' ? (
              <CheckCircle2 className="w-7 h-7 text-white" />
            ) : (
              <Lock className="w-7 h-7 text-white" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-[#2B3A4A]">
            {step === 'kyc' ? 'Verify your identity' : step === 'done' ? "You're all set" : 'Set your password'}
          </h1>
          {step === 'password' && (
            <p className="text-xs text-gray-500 mt-1">Step 1 of 2 · Account security</p>
          )}
          {step === 'kyc' && (
            <p className="text-xs text-gray-500 mt-1">Step 2 of 2 · KYC verification</p>
          )}
        </div>

        {status.state === 'checking' && (
          <p className="text-sm text-center text-gray-600">Validating your invitation…</p>
        )}

        {status.state === 'invalid' && (
          <div data-testid="setup-invalid" className="text-center">
            <div className="inline-flex p-3 rounded-full bg-amber-100 mb-3">
              <AlertTriangle className="text-amber-600" size={24} />
            </div>
            <p className="font-medium text-[#2B3A4A] mb-2">{status.reason}</p>
            <Link
              href="/retailer/login"
              className="text-sm text-[#D4AF37] underline"
            >
              Back to retailer login
            </Link>
          </div>
        )}

        {status.state === 'valid' && step === 'password' && (
          <form onSubmit={onSubmit} className="space-y-4" data-testid="setup-form">
            <div className="text-center -mt-2 mb-2">
              <p className="text-sm text-gray-700">
                Welcome <b>{status.business_name}</b>
              </p>
              <p className="text-xs text-gray-500">{status.email}</p>
            </div>
            <input
              type="password"
              placeholder="New password (min 8 chars)"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-[#D4AF37] outline-none"
              required
              minLength={8}
              data-testid="setup-password-input"
              autoComplete="new-password"
            />
            <input
              type="password"
              placeholder="Confirm password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-[#D4AF37] outline-none"
              required
              minLength={8}
              data-testid="setup-password-confirm"
              autoComplete="new-password"
            />
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-lg bg-[#2B3A4A] text-white font-medium hover:bg-[#1e3a52] disabled:opacity-50"
              data-testid="setup-submit"
            >
              {submitting ? 'Setting password…' : 'Set password & continue'}
            </button>
            <p className="text-xs text-center text-gray-500 inline-flex items-center justify-center gap-1 w-full">
              <CheckCircle2 size={12} className="text-emerald-500" />
              Your password is encrypted and never stored in plain text.
            </p>
          </form>
        )}

        {status.state === 'valid' && step === 'kyc' && (
          <div data-testid="setup-kyc-step" className="space-y-4">
            <p className="text-sm text-gray-700 text-center">
              One last step — verify your <b>PAN</b> and <b>Aadhaar</b> so we can
              activate your account immediately. Both are securely processed
              via Sandbox API and never stored in plaintext.
            </p>
            <KYCVerificationCard
              retailerId={status.retailer_id}
              onComplete={finishOnboarding}
            />
            <button
              type="button"
              onClick={finishOnboarding}
              className="w-full py-2.5 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100"
              data-testid="setup-kyc-skip"
            >
              Skip for now &middot; complete later from your dashboard
            </button>
          </div>
        )}

        {status.state === 'valid' && step === 'done' && (
          <div className="text-center" data-testid="setup-done">
            <p className="text-sm text-gray-700 mb-1">
              Account ready, <b>{status.business_name}</b>.
            </p>
            <p className="text-xs text-gray-500">
              Redirecting you to login…
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SetupPasswordPage() {
  return (
    <Suspense fallback={null}>
      <SetupPasswordInner />
    </Suspense>
  );
}
