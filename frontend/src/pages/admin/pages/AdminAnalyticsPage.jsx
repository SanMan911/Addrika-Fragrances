import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { TrendingUp, TrendingDown, RefreshCw, DollarSign, Package, BarChart3 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, AreaChart, Area
} from 'recharts';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const AdminAnalyticsPage = () => {
  const { authFetch } = useOutletContext();
  
  const [revenueTrends, setRevenueTrends] = useState({ data: [], summary: {} });
  const [orderStats, setOrderStats] = useState({ status_distribution: {}, payment_distribution: {} });
  const [period, setPeriod] = useState('daily');
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const [trendsRes, statsRes] = await Promise.all([
        authFetch(`${API_URL}/api/admin/revenue-trends?period=${period}&days=${days}`),
        authFetch(`${API_URL}/api/admin/order-stats?days=${days}`)
      ]);

      if (trendsRes.ok) {
        const trendsData = await trendsRes.json();
        setRevenueTrends(trendsData);
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setOrderStats(statsData);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  }, [authFetch, period, days]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const statusColors = {
    pending: '#f59e0b',
    confirmed: '#3b82f6',
    processing: '#8b5cf6',
    shipped: '#6366f1',
    delivered: '#22c55e',
    cancelled: '#ef4444',
    rto: '#f97316'
  };

  const paymentColors = {
    Online: '#3b82f6',
    UPI: '#8b5cf6',
    COD: '#f59e0b',
    'Pay at Store': '#22c55e'
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Analytics</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Revenue trends and order statistics</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last year</option>
          </select>
          <Button onClick={fetchAnalytics} variant="outline" disabled={loading}>
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Total Revenue</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-white mt-1">
                {formatCurrency(revenueTrends.summary?.total_revenue)}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/30">
              <DollarSign size={24} className="text-green-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Total Orders</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-white mt-1">
                {revenueTrends.summary?.total_orders || 0}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Package size={24} className="text-blue-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Avg Order Value</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-white mt-1">
                {formatCurrency(revenueTrends.summary?.avg_order_value)}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900/30">
              <BarChart3 size={24} className="text-purple-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Growth</p>
              <p className={`text-2xl font-bold mt-1 ${
                (revenueTrends.summary?.growth_percentage || 0) >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {revenueTrends.summary?.growth_percentage >= 0 ? '+' : ''}
                {revenueTrends.summary?.growth_percentage || 0}%
              </p>
            </div>
            <div className={`p-3 rounded-lg ${
              (revenueTrends.summary?.growth_percentage || 0) >= 0 
                ? 'bg-green-100 dark:bg-green-900/30' 
                : 'bg-red-100 dark:bg-red-900/30'
            }`}>
              {(revenueTrends.summary?.growth_percentage || 0) >= 0 
                ? <TrendingUp size={24} className="text-green-600" />
                : <TrendingDown size={24} className="text-red-600" />
              }
            </div>
          </div>
        </div>
      </div>

      {/* Revenue Chart */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">Revenue Trend</h2>
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <RefreshCw className="animate-spin text-slate-400" size={32} />
          </div>
        ) : revenueTrends.data?.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={revenueTrends.data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
              <Tooltip 
                formatter={(value) => [formatCurrency(value), 'Revenue']}
                contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px' }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fill="#3b82f680" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-64 flex items-center justify-center text-slate-500">
            No data available for the selected period
          </div>
        )}
      </div>

      {/* Order Status & Payment Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Order Status Distribution */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">Order Status Distribution</h2>
          <div className="space-y-3">
            {Object.entries(orderStats.status_distribution || {}).map(([status, data]) => {
              const total = Object.values(orderStats.status_distribution || {}).reduce((sum, s) => sum + (s.count || 0), 0);
              const percentage = total > 0 ? ((data.count || 0) / total * 100).toFixed(1) : 0;
              
              return (
                <div key={status} className="flex items-center gap-3">
                  <div className="w-24 text-sm font-medium text-slate-600 dark:text-slate-300 capitalize">
                    {status}
                  </div>
                  <div className="flex-1 h-6 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: statusColors[status] || '#64748b'
                      }}
                    />
                  </div>
                  <div className="w-20 text-right text-sm font-medium text-slate-800 dark:text-white">
                    {data.count || 0} ({percentage}%)
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Payment Distribution */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">Payment Method Distribution</h2>
          <div className="space-y-3">
            {Object.entries(orderStats.payment_distribution || {}).map(([method, data]) => {
              const total = Object.values(orderStats.payment_distribution || {}).reduce((sum, s) => sum + (s.count || 0), 0);
              const percentage = total > 0 ? ((data.count || 0) / total * 100).toFixed(1) : 0;
              
              return (
                <div key={method} className="flex items-center gap-3">
                  <div className="w-24 text-sm font-medium text-slate-600 dark:text-slate-300">
                    {method}
                  </div>
                  <div className="flex-1 h-6 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: paymentColors[method] || '#64748b'
                      }}
                    />
                  </div>
                  <div className="w-28 text-right text-sm font-medium text-slate-800 dark:text-white">
                    {formatCurrency(data.revenue || 0)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAnalyticsPage;
