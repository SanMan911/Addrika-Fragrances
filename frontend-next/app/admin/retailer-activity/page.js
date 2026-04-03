'use client';

import { useState, useEffect, useCallback } from 'react';
import { Activity, RefreshCw, Store, Package, DollarSign, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { authFetch } from '../layout';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://product-size-sync.preview.emergentagent.com';

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
};

export default function AdminRetailerActivityPage() {
  const [activities, setActivities] = useState([]);
  const [retailers, setRetailers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRetailer, setSelectedRetailer] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [activityRes, retailersRes] = await Promise.all([
        authFetch(`${API_URL}/api/admin/retailer-activity${selectedRetailer ? `?retailer_id=${selectedRetailer}` : ''}`),
        authFetch(`${API_URL}/api/admin/retailers`)
      ]);
      
      if (activityRes.ok) {
        const data = await activityRes.json();
        setActivities(data.activities || data || []);
      }
      if (retailersRes.ok) {
        const data = await retailersRes.json();
        setRetailers(data.retailers || data || []);
      }
    } catch (error) {
      console.error('Failed to fetch activity:', error);
      toast.error('Failed to load activity data');
    } finally {
      setLoading(false);
    }
  }, [selectedRetailer]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Retailer Activity</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Track retailer orders and performance</p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Filter */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <select
          value={selectedRetailer}
          onChange={(e) => setSelectedRetailer(e.target.value)}
          className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
        >
          <option value="">All Retailers</option>
          {retailers.map((r) => (
            <option key={r.id} value={r.id}>{r.store_name || r.storeName}</option>
          ))}
        </select>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <Package size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Orders</p>
              <p className="text-xl font-bold text-slate-800 dark:text-white">{activities.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
              <DollarSign size={20} className="text-green-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Revenue</p>
              <p className="text-xl font-bold text-slate-800 dark:text-white">
                {formatCurrency(activities.reduce((sum, a) => sum + (a.total || 0), 0))}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
              <Store size={20} className="text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Active Retailers</p>
              <p className="text-xl font-bold text-slate-800 dark:text-white">
                {new Set(activities.map(a => a.retailer_id)).size}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Activity List */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="font-semibold text-slate-800 dark:text-white">Recent Activity</h2>
        </div>
        <div className="divide-y divide-slate-200 dark:divide-slate-700">
          {activities.map((activity, idx) => (
            <div key={activity.id || idx} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center">
                  <Activity size={18} className="text-slate-500" />
                </div>
                <div>
                  <p className="font-medium text-slate-800 dark:text-white">
                    {activity.retailer_name || 'Retailer'}
                  </p>
                  <p className="text-sm text-slate-500">
                    {activity.type || 'Order'} • {activity.items_count || 0} items
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-slate-800 dark:text-white">{formatCurrency(activity.total || 0)}</p>
                <p className="text-xs text-slate-500 flex items-center gap-1 justify-end">
                  <Calendar size={12} />
                  {new Date(activity.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
        
        {activities.length === 0 && (
          <div className="p-8 text-center text-slate-500">
            No activity found
          </div>
        )}
      </div>
    </div>
  );
}
