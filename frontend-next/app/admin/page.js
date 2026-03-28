'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Package, Users, DollarSign, MessageSquare, Star, AlertTriangle,
  TrendingUp, ArrowRight, RefreshCw
} from 'lucide-react';
import { useAdmin, authFetch } from './layout';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const StatCard = ({ title, value, icon: Icon, color, link, subValue }) => (
  <Link
    href={link}
    className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 hover:shadow-lg transition-all group"
    data-testid={`stat-card-${title.toLowerCase().replace(/\s/g, '-')}`}
  >
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">{title}</p>
        <p className="text-3xl font-bold text-slate-800 dark:text-white">{value}</p>
        {subValue && (
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{subValue}</p>
        )}
      </div>
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon size={24} className="text-white" />
      </div>
    </div>
    <div className="mt-4 flex items-center text-sm text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200">
      <span>View details</span>
      <ArrowRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
    </div>
  </Link>
);

export default function AdminOverviewPage() {
  const [stats, setStats] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, ordersRes] = await Promise.all([
        authFetch(`${API_URL}/api/admin/stats`),
        authFetch(`${API_URL}/api/admin/orders?limit=5`)
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        setRecentOrders(ordersData.orders || []);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      processing: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      shipped: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
      delivered: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      rto: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
    };
    return colors[status] || 'bg-slate-100 text-slate-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-slate-400" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Dashboard Overview</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Welcome back! Here&apos;s what&apos;s happening.</p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
          data-testid="refresh-overview"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Orders"
          value={stats?.orders?.total || 0}
          subValue={`${stats?.orders?.pending || 0} pending`}
          icon={Package}
          color="bg-blue-500"
          link="/admin/orders"
        />
        <StatCard
          title="Total Revenue"
          value={formatCurrency(stats?.revenue?.total || 0)}
          icon={DollarSign}
          color="bg-green-500"
          link="/admin/analytics"
        />
        <StatCard
          title="Total Users"
          value={stats?.users?.total || 0}
          icon={Users}
          color="bg-purple-500"
          link="/admin/users"
        />
        <StatCard
          title="Pending Reviews"
          value={stats?.reviews?.pending || 0}
          icon={Star}
          color="bg-amber-500"
          link="/admin/content"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          title="Pending Inquiries"
          value={stats?.inquiries?.pending || 0}
          subValue={`${stats?.inquiries?.total || 0} total`}
          icon={MessageSquare}
          color="bg-teal-500"
          link="/admin/inquiries"
        />
        <StatCard
          title="Low Stock Alerts"
          value={stats?.inventory?.low_stock_alerts || 0}
          icon={AlertTriangle}
          color="bg-red-500"
          link="/admin/inventory"
        />
        <Link
          href="/admin/analytics"
          className="bg-gradient-to-br from-slate-800 to-slate-900 dark:from-slate-700 dark:to-slate-800 rounded-xl p-6 text-white hover:shadow-lg transition-all group"
        >
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp size={24} className="text-amber-400" />
            <span className="font-semibold">View Analytics</span>
          </div>
          <p className="text-sm text-slate-300">Track revenue trends, order stats, and more</p>
          <div className="mt-4 flex items-center text-sm text-slate-400 group-hover:text-white">
            <span>Open analytics</span>
            <ArrowRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>
      </div>

      {/* Recent Orders */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Recent Orders</h2>
          <Link
            href="/admin/orders"
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            View all <ArrowRight size={14} />
          </Link>
        </div>
        
        {recentOrders.length > 0 ? (
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {recentOrders.map((order) => (
              <div
                key={order.order_number || order.orderNumber || order.order_id}
                className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center">
                    <Package size={20} className="text-slate-500" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-800 dark:text-white">
                      {order.order_number || order.orderNumber || order.order_id?.slice(-8)}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {order.shipping?.name || order.billing?.name || 'Customer'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-slate-800 dark:text-white">
                    {formatCurrency(order.pricing?.final_total || order.total || 0)}
                  </p>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.order_status || order.orderStatus)}`}>
                    {(order.order_status || order.orderStatus || 'pending').toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400">
            No orders yet
          </div>
        )}
      </div>
    </div>
  );
}
