'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle2, AlertTriangle, Lock } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import Link from 'next/link';

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
      toast.success('Password set — redirecting to login…');
      setTimeout(() => router.push('/retailer/login'), 1200);
    } catch {
      toast.error('Setup failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#2B3A4A] p-4">
      <Toaster position="top-center" richColors />
      <div className="bg-[#F5EFE0] rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-3 bg-[#D4AF37]">
            <Lock className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[#2B3A4A]">Set your password</h1>
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

        {status.state === 'valid' && (
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
