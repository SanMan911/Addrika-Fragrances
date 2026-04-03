'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { 
  Store, Package, TrendingUp, DollarSign, Clock, ShoppingBag,
  ChevronRight, RefreshCw, AlertTriangle, CheckCircle
} from 'lucide-react';
import { useRetailerAuth } from '../../../context/RetailerAuthContext';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://product-size-sync.preview.emergentagent.com';
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
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#2B3A4A]">
            Welcome, {retailer?.store_name || retailer?.storeName || 'Partner'}!
          </h1>
          <p className="text-gray-500 mt-1">Here&apos;s your store performance at a glance</p>
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
