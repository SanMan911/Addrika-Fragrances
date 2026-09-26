'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, Loader2, Lock, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

function ResetPasswordInner() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') || '';

  const [state, setState] = useState('checking'); // checking | ready | invalid | done
  const [info, setInfo] = useState({});
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const strength = (() => {
    const p = password;
    if (!p) return null;
    let score = 0;
    if (p.length >= 8) score += 1;
    if (p.length >= 12) score += 1;
    if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score += 1;
    if (/[0-9]/.test(p)) score += 1;
    if (/[^A-Za-z0-9]/.test(p)) score += 1;
    if (/^[0-9]+$/.test(p) || new Set(p).size <= 2) score = 1;
    const labels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong', 'Strong'];
    const colors = ['#e11d48', '#e11d48', '#f59e0b', '#eab308', '#22c55e', '#22c55e'];
    return { score, label: labels[score], color: colors[score] };
  })();

  useEffect(() => {
    if (!token) {
      setState('invalid');
      setInfo({ reason: 'This reset link is missing its token' });
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/retailer-auth/reset-password/validate/${token}`);
        const data = await res.json();
        if (data.valid) {
          setInfo(data);
          setState('ready');
        } else {
          setInfo({ reason: data.reason || 'This reset link is invalid or has expired' });
          setState('invalid');
        }
      } catch {
        setInfo({ reason: 'Could not verify this link. Please try again.' });
        setState('invalid');
      }
    })();
  }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (strength && strength.score <= 1) {
      toast.error('That password is too weak — mix letters, numbers and a symbol');
      return;
    }
    if (password !== confirm) {
      toast.error('Both passwords must match');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/retailer-auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.detail === 'string' ? data.detail : 'Could not reset your password');
        if (res.status === 400) setState('invalid');
        return;
      }
      setState('done');
      setTimeout(() => router.push('/retailer/login'), 4000);
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16" style={{ background: '#F5EFE0' }}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8" data-testid="retailer-reset-password-page">
        {state === 'checking' && (
          <div className="flex items-center gap-3 text-gray-600" data-testid="reset-checking">
            <Loader2 className="w-5 h-5 animate-spin" /> Verifying your reset link…
          </div>
        )}

        {state === 'invalid' && (
          <div className="text-center" data-testid="reset-invalid">
            <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center mb-4 bg-rose-100">
              <ShieldAlert className="w-7 h-7 text-rose-600" />
            </div>
            <h1 className="text-2xl font-bold text-[#2B3A4A]" style={{ fontFamily: "'Playfair Display', serif" }}>
              Link no longer valid
            </h1>
            <p className="text-sm text-gray-600 mt-3">{info.reason}</p>
            <Link
              href="/retailer/forgot-password"
              className="inline-block mt-6 px-6 py-3 rounded-xl font-bold text-sm"
              style={{ background: '#2B3A4A', color: '#F5EFE0' }}
              data-testid="reset-request-again"
            >
              Request a new link
            </Link>
          </div>
        )}

        {state === 'done' && (
          <div className="text-center" data-testid="reset-success">
            <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center mb-4 bg-emerald-100">
              <CheckCircle2 className="w-7 h-7 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-bold text-[#2B3A4A]" style={{ fontFamily: "'Playfair Display', serif" }}>
              Password updated
            </h1>
            <p className="text-sm text-gray-600 mt-3">
              Sign in with your GSTIN and your new password. All other devices have been signed out.
            </p>
            <Link
              href="/retailer/login"
              className="inline-block mt-6 px-6 py-3 rounded-xl font-bold text-sm"
              style={{ background: 'linear-gradient(135deg, #D4AF37 0%, #a8842b 100%)', color: '#1a1410' }}
              data-testid="reset-go-login"
            >
              Go to login
            </Link>
          </div>
        )}

        {state === 'ready' && (
          <>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5" style={{ background: 'rgba(212,175,55,0.15)' }}>
              <Lock className="w-6 h-6 text-[#8a6d1f]" />
            </div>
            <h1 className="text-2xl font-bold text-[#2B3A4A]" style={{ fontFamily: "'Playfair Display', serif" }}>
              Set a new password
            </h1>
            <p className="text-sm text-gray-600 mt-2">
              {info.business_name ? `${info.business_name} · ` : ''}
              <span className="font-mono tracking-wider">{info.gst_number}</span>
            </p>

            <form onSubmit={submit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="pw" className="block text-sm font-medium text-gray-700 mb-1">New password</label>
                <input
                  id="pw"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full px-4 py-3 bg-white text-[#2B3A4A] placeholder:text-gray-400 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent outline-none"
                  data-testid="reset-password-input"
                />
                {strength && (
                  <div className="mt-2" data-testid="reset-password-strength">
                    <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${(strength.score / 5) * 100}%`, background: strength.color }}
                      />
                    </div>
                    <p className="text-xs mt-1 font-medium" style={{ color: strength.color }}>
                      {strength.label}
                      {strength.score <= 1 ? ' — mix letters, numbers and a symbol' : ''}
                    </p>
                  </div>
                )}
              </div>
              <div>
                <label htmlFor="pw2" className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
                <input
                  id="pw2"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Type it again"
                  className="w-full px-4 py-3 bg-white text-[#2B3A4A] placeholder:text-gray-400 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent outline-none"
                  data-testid="reset-confirm-input"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60 transition-transform hover:-translate-y-0.5"
                style={{ background: 'linear-gradient(135deg, #D4AF37 0%, #a8842b 100%)', color: '#1a1410' }}
                data-testid="reset-submit-btn"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
                Save new password
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default function RetailerResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordInner />
    </Suspense>
  );
}
