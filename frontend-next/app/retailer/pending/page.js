'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Clock, LogOut, RefreshCw, Mail, ShieldAlert } from 'lucide-react';
import { useRetailerAuth } from '../../../context/RetailerAuthContext';
import BRAND from '../../../lib/brand.config';

export default function RetailerPendingPage() {
  const router = useRouter();
  const { retailer, isAuthenticated, isLoading, logout, checkAuth } = useRetailerAuth();
  const [refreshing, setRefreshing] = useState(false);

  // If not logged in, bounce to login
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/retailer/login');
    }
  }, [isLoading, isAuthenticated, router]);

  // If verified, jump to dashboard
  useEffect(() => {
    if (
      !isLoading &&
      isAuthenticated &&
      retailer &&
      (retailer.status === 'verified' || retailer.status === 'active')
    ) {
      router.replace('/retailer/dashboard');
    }
  }, [isLoading, isAuthenticated, retailer, router]);

  // Poll every 30s for a status change (verification / revoke / suspend)
  useEffect(() => {
    if (!isAuthenticated) return;
    const t = setInterval(() => checkAuth(), 30000);
    return () => clearInterval(t);
  }, [isAuthenticated, checkAuth]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await checkAuth();
    setTimeout(() => setRefreshing(false), 600);
  };

  const handleLogout = async () => {
    await logout();
    router.push('/retailer/login');
  };

  if (isLoading || !retailer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#2B3A4A]">
        <div className="w-12 h-12 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isRevoked = retailer.status === 'revoked';

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#2B3A4A]" data-testid="retailer-pending-screen">
      <div className="w-full max-w-lg p-8 rounded-2xl shadow-2xl bg-[#F5F0E8] text-center">
        <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-5 ${isRevoked ? 'bg-amber-500' : 'bg-[#D4AF37]'}`}>
          {isRevoked ? (
            <ShieldAlert className="w-10 h-10 text-white" />
          ) : (
            <Clock className="w-10 h-10 text-white" />
          )}
        </div>

        <h1 className="text-3xl font-bold text-[#2B3A4A] mb-2" data-testid="pending-title">
          {isRevoked ? 'Account access revoked' : 'Under Processing'}
        </h1>

        <p className="text-gray-700 mb-6 leading-relaxed" data-testid="pending-body">
          {isRevoked ? (
            <>
              An admin has revoked your account access. Please wait for a fresh
              review — you&apos;ll be able to sign back in once we&apos;ve
              re-approved your details.
            </>
          ) : (
            <>
              Hi {retailer.name?.split(' ')[0] || 'there'}, thanks for signing
              up. Your registration and GST certificate are under review by our
              team. We usually respond within <strong>1 business day</strong>.
              You&apos;ll receive an email as soon as your account is approved.
            </>
          )}
        </p>

        <div className="bg-white/70 rounded-xl p-4 mb-6 text-left">
          <p className="text-xs font-semibold text-[#2B3A4A] uppercase tracking-wider mb-2">
            Your submission
          </p>
          <dl className="text-sm space-y-1">
            <div className="flex justify-between">
              <dt className="text-gray-600">Business</dt>
              <dd className="text-[#2B3A4A] font-medium">
                {retailer.business_name || retailer.name || '—'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Email</dt>
              <dd className="text-[#2B3A4A] font-medium">{retailer.email}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Status</dt>
              <dd className={`font-semibold ${isRevoked ? 'text-amber-700' : 'text-[#D4AF37]'}`}>
                {isRevoked ? 'Revoked' : 'Under Review'}
              </dd>
            </div>
          </dl>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#2B3A4A] text-white font-medium hover:bg-[#1a252f] disabled:opacity-60"
            data-testid="pending-refresh-btn"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Checking…' : 'Check status'}
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-[#2B3A4A] text-[#2B3A4A] font-medium hover:bg-[#2B3A4A] hover:text-white"
            data-testid="pending-logout-btn"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>

        <p className="mt-6 text-xs text-gray-500 flex items-center justify-center gap-1">
          <Mail className="w-3.5 h-3.5" />
          Questions?{' '}
          <a
            href="mailto:contact.us@centraders.com"
            className="text-[#D4AF37] font-medium hover:underline ml-1"
          >
            contact.us@centraders.com
          </a>
        </p>

        <div className="mt-6 pt-5 border-t border-gray-300 text-xs text-gray-500">
          <Link href="/" className="hover:underline text-[#2B3A4A]">
            ← Back to {BRAND.name}
          </Link>
        </div>
      </div>
    </div>
  );
}
