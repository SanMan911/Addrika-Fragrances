'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { 
  Store, Package, TrendingUp, DollarSign, Clock, ShoppingBag,
  ChevronRight, RefreshCw, AlertTriangle, CheckCircle, Upload, FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { useRetailerAuth } from '../../../context/RetailerAuthContext';
import WalkthroughModal from '../../../components/WalkthroughModal';
const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

function KycNudge({ fetchWithAuth }) {
  const [kyc, setKyc] = useState(null);
  const [busy, setBusy] = useState('');
  const load = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/retailer-auth/kyc/status`);
      if (res.ok) setKyc(await res.json());
    } catch { /* ignore */ }
  }, [fetchWithAuth]);
  useEffect(() => { load(); }, [load]);
  const upload = async (docType, file) => {
    if (!file) return;
    setBusy(docType);
    try {
      const fd = new FormData();
      fd.append('doc_type', docType);
      fd.append('file', file);
      const res = await fetchWithAuth(`${API_URL}/api/retailer-auth/kyc/upload`, { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || 'Upload failed');
      toast.success(`${docType === 'gst_certificate' ? 'GST certificate' : 'SPOC Aadhaar'} uploaded ✓`);
      setKyc(data.kyc);
      if (data.kyc?.reactivated) toast.success('Account reactivated — thanks for completing your KYC!');
    } catch (e) {
      toast.error(e.message || 'Upload failed');
    } finally {
      setBusy('');
    }
  };
  if (!kyc || kyc.complete) return null;
  const dl = kyc.days_left;
  const overdue = dl !== null && dl < 0;
  const UploadTile = ({ docType, label, done }) => (
    <label
      className={`flex-1 min-w-[200px] cursor-pointer flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border transition ${done ? 'bg-emerald-50 text-emerald-700 border-emerald-300 cursor-default' : 'bg-white text-[#2B3A4A] border-[#2B3A4A]/30 hover:border-[#D4AF37]'}`}
      data-testid={`kyc-upload-${docType}`}
    >
      {done ? <CheckCircle className="w-4 h-4" /> : (busy === docType ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />)}
      {done ? `${label} uploaded` : busy === docType ? 'Uploading…' : `Upload ${label}`}
      {!done && (
        <input
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => upload(docType, e.target.files?.[0])}
        />
      )}
    </label>
  );
  return (
    <div
      className={`rounded-xl p-4 border ${overdue ? 'bg-red-50 border-red-300' : 'bg-amber-50 border-amber-300'}`}
      data-testid="kyc-nudge"
    >
      <div className="flex items-center gap-2 mb-1">
        {overdue ? <AlertTriangle className="text-red-600" size={20} /> : <FileText className="text-amber-600" size={20} />}
        <h2 className={`font-semibold ${overdue ? 'text-red-800' : 'text-amber-800'}`}>
          Complete your KYC documents
        </h2>
      </div>
      <p className={`text-sm mb-3 ${overdue ? 'text-red-700' : 'text-amber-700'}`} data-testid="kyc-days-left">
        Please upload your <b>GST Certificate</b> and your <b>SPOC (Single Point of Contact) Aadhaar</b>.
        {overdue
          ? ' Your 30-day window has passed — upload now to lift the suspension and restore full access.'
          : dl !== null
            ? ` You have ${dl} day${dl === 1 ? '' : 's'} left — accounts without both documents are automatically suspended after 30 days.`
            : ' Accounts without both documents are automatically suspended after 30 days.'}
      </p>
      <div className="flex flex-wrap gap-3">
        <UploadTile docType="gst_certificate" label="GST Certificate" done={kyc.gst_certificate} />
        <UploadTile docType="spoc_aadhaar" label="SPOC Aadhaar" done={kyc.spoc_aadhaar} />
      </div>
    </div>
  );
}
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
};
const MetricCard = ({ icon: Icon, label, value, subtext, color }) => (
  <div className="p-5 rounded-xl bg-white border border-gray-200">
    <div className="flex items-center gap-3 mb-3">
      <div className="p-2 rounded-lg" style={{ backgroundColor: `${color}20` }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <span className="text-sm font-medium text-gray-500">{label}</span>
    </div>
    <div className="text-3xl font-bold text-[#2B3A4A]">{value}</div>
    {subtext && (
      <div className="text-sm mt-1 text-gray-500">{subtext}</div>
    )}
  </div>
);
export default function RetailerDashboardPage() {
  const { retailer, fetchWithAuth } = useRetailerAuth();
  const [metrics, setMetrics] = useState(null);
  const [profileSummary, setProfileSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [metricsRes, profileRes] = await Promise.all([
        fetchWithAuth(`${API_URL}/api/retailer-dashboard/performance`),
        fetchWithAuth(`${API_URL}/api/retailers/profile/summary`)
      ]);
      
      if (metricsRes.ok) {
        const data = await metricsRes.json();
        setMetrics(data.metrics || data);
      }
      
      if (profileRes.ok) {
        const data = await profileRes.json();
        setProfileSummary(data.profile_summary || data);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <WalkthroughModal retailer={retailer} />
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#2B3A4A]">
            Welcome, {retailer?.store_name || retailer?.storeName || 'Partner'}!
          </h1>
          <p className="text-gray-500 mt-1">Here&apos;s your store performance at a glance</p>
          {(retailer?.gst_number || retailer?.username) && (
            <p className="text-xs text-gray-500 mt-2" data-testid="retailer-login-id">
              Your login ID:{' '}
              <span className="font-mono tracking-wider font-semibold text-[#2B3A4A]">
                {retailer.gst_number || retailer.username}
              </span>
              <span className="text-gray-400"> · sign in with your GSTIN</span>
            </p>
          )}
          {retailer?.status === 'active' && (retailer?.legal_name || retailer?.trade_name || retailer?.business_name) && (
            <div className="flex flex-wrap gap-2 mt-3" data-testid="dashboard-gst-chips">
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300"
                data-testid="dashboard-legal-name-chip"
              >
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span className="uppercase tracking-wide text-[10px] text-emerald-600">Legal Name</span>
                {retailer.legal_name || retailer.trade_name || retailer.business_name}
              </span>
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#D4AF37]/10 text-[#2B3A4A] border border-[#D4AF37]/40"
                data-testid="dashboard-trade-name-chip"
              >
                <CheckCircle className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span className="uppercase tracking-wide text-[10px] text-[#b8912e]">Trade Name</span>
                {retailer.trade_name || retailer.business_name}
              </span>
            </div>
          )}
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>
      {/* KYC document nudge (GST cert + SPOC Aadhaar, 30-day window) */}
      <KycNudge fetchWithAuth={fetchWithAuth} />
      {/* Alerts */}
      {profileSummary?.alerts?.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="text-yellow-600" size={20} />
            <h2 className="font-semibold text-yellow-800">Action Required</h2>
          </div>
          <ul className="space-y-1 text-sm text-yellow-700">
            {profileSummary.alerts.map((alert, idx) => (
              <li key={idx} className="flex items-center gap-2">
                <span>•</span>
                <span>{alert}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={Package}
          label="Total Orders"
          value={metrics?.total_orders || 0}
          subtext={`${metrics?.pending_orders || 0} pending`}
          color="#3B82F6"
        />
        <MetricCard
          icon={DollarSign}
          label="Total Revenue"
          value={formatCurrency(metrics?.total_revenue || 0)}
          color="#10B981"
        />
        <MetricCard
          icon={TrendingUp}
          label="This Month"
          value={formatCurrency(metrics?.monthly_revenue || 0)}
          subtext={`${metrics?.monthly_orders || 0} orders`}
          color="#8B5CF6"
        />
        <MetricCard
          icon={ShoppingBag}
          label="Avg Order Value"
          value={formatCurrency(metrics?.avg_order_value || 0)}
          color="#F59E0B"
        />
      </div>
      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link
          href="/retailer/orders"
          className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-md transition-shadow group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-blue-100">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-[#2B3A4A]">View Orders</h3>
                <p className="text-sm text-gray-500">Manage customer orders</p>
              </div>
            </div>
            <ChevronRight className="text-gray-400 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>
        <Link
          href="/retailer/b2b"
          className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-md transition-shadow group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-purple-100">
                <ShoppingBag className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-[#2B3A4A]">B2B Orders</h3>
                <p className="text-sm text-gray-500">Place wholesale orders</p>
              </div>
            </div>
            <ChevronRight className="text-gray-400 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>
        <Link
          href="/retailer/leaderboard"
          className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-md transition-shadow group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-amber-100">
                <TrendingUp className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-[#2B3A4A]">Leaderboard</h3>
                <p className="text-sm text-gray-500">See your ranking</p>
              </div>
            </div>
            <ChevronRight className="text-gray-400 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>
      </div>
      {/* Profile Completion */}
      {profileSummary?.completion_percentage < 100 && (
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-[#2B3A4A]">Profile Completion</h2>
            <span className="text-sm font-medium text-[#D4AF37]">
              {profileSummary.completion_percentage || 0}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
            <div 
              className="bg-[#D4AF37] h-2 rounded-full transition-all"
              style={{ width: `${profileSummary.completion_percentage || 0}%` }}
            />
          </div>
          <p className="text-sm text-gray-500">
            Complete your profile to unlock all features and improve your store visibility.
          </p>
        </div>
      )}
    </div>
  );
}
