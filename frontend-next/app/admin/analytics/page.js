'use client';

import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, DollarSign, Package, Users, Calendar, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { authFetch } from '../layout';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
};

const StatCard = ({ title, value, icon: Icon, color, change }) => (
  <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">{title}</p>
        <p className="text-2xl font-bold text-slate-800 dark:text-white">{value}</p>
        {change && (
          <p className={`text-sm mt-1 ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {change >= 0 ? '↑' : '↓'} {Math.abs(change)}% vs last month
          </p>
        )}
      </div>
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon size={24} className="text-white" />
      </div>
    </div>
  </div>
);

export default function AdminAnalyticsPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('month');

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_URL}/api/admin/analytics?range=${dateRange}`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-slate-400" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Analytics</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Track your business performance</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
          >
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
            <option value="quarter">Last 3 Months</option>
            <option value="year">Last Year</option>
          </select>
          <button
            onClick={fetchAnalytics}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Revenue"
          value={formatCurrency(stats?.revenue?.total || 0)}
          icon={DollarSign}
          color="bg-green-500"
          change={stats?.revenue?.change}
        />
        <StatCard
          title="Total Orders"
          value={stats?.orders?.total || 0}
          icon={Package}
          color="bg-blue-500"
          change={stats?.orders?.change}
        />
        <StatCard
          title="New Users"
          value={stats?.users?.new || 0}
          icon={Users}
          color="bg-purple-500"
          change={stats?.users?.change}
        />
        <StatCard
          title="Avg Order Value"
          value={formatCurrency(stats?.revenue?.average || 0)}
          icon={TrendingUp}
          color="bg-amber-500"
        />
      </div>

      {/* Order Status Distribution */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">Order Status Distribution</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
          {['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'rto'].map(status => (
            <div key={status} className="text-center p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
              <p className="text-2xl font-bold text-slate-800 dark:text-white">
                {stats?.orders?.by_status?.[status] || 0}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 capitalize">{status}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Top Products */}
      {stats?.top_products && stats.top_products.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">Top Products</h2>
          <div className="space-y-3">
            {stats.top_products.map((product, idx) => (
              <div key={product.id || idx} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center text-amber-600 font-bold">
                    {idx + 1}
                  </span>
                  <span className="font-medium text-slate-800 dark:text-white">{product.name}</span>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-slate-800 dark:text-white">{product.quantity_sold} sold</p>
                  <p className="text-sm text-slate-500">{formatCurrency(product.revenue)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
