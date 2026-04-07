'use client';

import { useState, useEffect, useCallback } from 'react';
import { TreePine, TrendingUp, Users, Calendar, RefreshCw, Download, ChevronDown, ChevronUp, DollarSign, Gift, Search } from 'lucide-react';
import { toast } from 'sonner';
import { authFetch } from '../layout';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export default function AdminTreeDonationsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [dateRange, setDateRange] = useState({
    start: '',
    end: ''
  });
  const [days, setDays] = useState(30);
  const [expandedSection, setExpandedSection] = useState('summary');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let url = `${API_URL}/api/admin/tree-donations?days=${days}`;
      if (dateRange.start && dateRange.end) {
        url = `${API_URL}/api/admin/tree-donations?start_date=${dateRange.start}&end_date=${dateRange.end}`;
      }
      
      const res = await authFetch(url);
      if (res.ok) {
        const result = await res.json();
        setData(result);
      } else {
        toast.error('Failed to fetch tree donation data');
      }
    } catch (error) {
      console.error('Error fetching tree donations:', error);
      toast.error('Error loading data');
    } finally {
      setLoading(false);
    }
  }, [days, dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDateRangeChange = () => {
    if (dateRange.start && dateRange.end) {
      fetchData();
    }
  };

  const handleQuickRange = (rangeDays) => {
    setDateRange({ start: '', end: '' });
    setDays(rangeDays);
  };

  const exportToCSV = () => {
    if (!data?.order_details?.length) {
      toast.error('No data to export');
      return;
    }
    
    const headers = ['Order Number', 'Date', 'Customer Name', 'Customer Email', 'Donation Amount', 'Order Total'];
    const rows = data.order_details.map(order => [
      order.order_number,
      new Date(order.date).toLocaleDateString('en-IN'),
      order.customer_name,
      order.customer_email,
      order.donation_amount,
      order.order_total
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tree-donations-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  };

  const formatCurrency = (amount) => {
    return `₹${(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric'
    });
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-slate-400" size={32} />
      </div>
    );
  }

  const summary = data?.summary || {};
  const dailyBreakdown = data?.daily_breakdown || [];
  const orderDetails = data?.order_details || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
            <TreePine className="text-emerald-500" size={28} />
            Tree Donation Metrics
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Track customer donations and environmental impact</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportToCSV}
            disabled={!orderDetails.length}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            <Download size={18} />
            Export CSV
          </button>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Date Range Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex gap-2">
            <button
              onClick={() => handleQuickRange(7)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                days === 7 && !dateRange.start ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
              }`}
            >
              7 Days
            </button>
            <button
              onClick={() => handleQuickRange(30)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                days === 30 && !dateRange.start ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
              }`}
            >
              30 Days
            </button>
            <button
              onClick={() => handleQuickRange(90)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                days === 90 && !dateRange.start ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
              }`}
            >
              90 Days
            </button>
            <button
              onClick={() => handleQuickRange(365)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                days === 365 && !dateRange.start ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
              }`}
            >
              1 Year
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">or</span>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="px-3 py-1.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900"
            />
            <span className="text-slate-500">to</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="px-3 py-1.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900"
            />
            <button
              onClick={handleDateRangeChange}
              disabled={!dateRange.start || !dateRange.end}
              className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm disabled:opacity-50"
            >
              Apply
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center">
              <TreePine size={20} className="text-emerald-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-emerald-600">{summary.total_trees_funded || 0}</p>
          <p className="text-sm text-slate-500 mt-1">Trees Funded</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <Users size={20} className="text-blue-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-blue-600">{summary.total_orders_with_donation || 0}</p>
          <p className="text-sm text-slate-500 mt-1">Donors</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
              <DollarSign size={20} className="text-purple-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-purple-600">{formatCurrency(summary.total_customer_donations)}</p>
          <p className="text-sm text-slate-500 mt-1">Customer Donations</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
              <Gift size={20} className="text-amber-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-amber-600">{formatCurrency(summary.total_addrika_match)}</p>
          <p className="text-sm text-slate-500 mt-1">Addrika Match</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
              <TrendingUp size={20} className="text-green-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-green-600">{formatCurrency(summary.total_combined)}</p>
          <p className="text-sm text-slate-500 mt-1">Total Impact</p>
        </div>
      </div>

      {/* Daily Breakdown */}
      {dailyBreakdown.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <button
            onClick={() => setExpandedSection(expandedSection === 'daily' ? '' : 'daily')}
            className="w-full p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50"
          >
            <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
              <Calendar size={18} />
              Daily Breakdown ({dailyBreakdown.length} days with donations)
            </h3>
            {expandedSection === 'daily' ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
          
          {expandedSection === 'daily' && (
            <div className="border-t border-slate-200 dark:border-slate-700 overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-900">
                  <tr>
                    <th className="text-left p-3 text-sm font-medium text-slate-500">Date</th>
                    <th className="text-right p-3 text-sm font-medium text-slate-500">Orders</th>
                    <th className="text-right p-3 text-sm font-medium text-slate-500">Customer</th>
                    <th className="text-right p-3 text-sm font-medium text-slate-500">Addrika Match</th>
                    <th className="text-right p-3 text-sm font-medium text-slate-500">Total</th>
                    <th className="text-right p-3 text-sm font-medium text-slate-500">Trees</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {dailyBreakdown.map((day, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                      <td className="p-3 text-slate-700 dark:text-slate-300">{day.display_date}</td>
                      <td className="p-3 text-right text-slate-600 dark:text-slate-400">{day.orders}</td>
                      <td className="p-3 text-right text-slate-600 dark:text-slate-400">{formatCurrency(day.customer_donations)}</td>
                      <td className="p-3 text-right text-amber-600">{formatCurrency(day.addrika_match)}</td>
                      <td className="p-3 text-right font-semibold text-green-600">{formatCurrency(day.total)}</td>
                      <td className="p-3 text-right">
                        <span className="inline-flex items-center gap-1 text-emerald-600">
                          <TreePine size={14} />
                          {day.trees}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Order Details */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <button
          onClick={() => setExpandedSection(expandedSection === 'orders' ? '' : 'orders')}
          className="w-full p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50"
        >
          <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
            <Search size={18} />
            Invoice Details ({orderDetails.length} orders)
          </h3>
          {expandedSection === 'orders' ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
        
        {expandedSection === 'orders' && (
          <div className="border-t border-slate-200 dark:border-slate-700 overflow-x-auto max-h-96">
            {orderDetails.length > 0 ? (
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-900 sticky top-0">
                  <tr>
                    <th className="text-left p-3 text-sm font-medium text-slate-500">Order #</th>
                    <th className="text-left p-3 text-sm font-medium text-slate-500">Date</th>
                    <th className="text-left p-3 text-sm font-medium text-slate-500">Customer</th>
                    <th className="text-right p-3 text-sm font-medium text-slate-500">Donation</th>
                    <th className="text-right p-3 text-sm font-medium text-slate-500">Order Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {orderDetails.map((order, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                      <td className="p-3 font-mono text-sm text-slate-800 dark:text-white">
                        {order.order_number}
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-400 text-sm">
                        {formatDate(order.date)}
                      </td>
                      <td className="p-3">
                        <p className="text-slate-800 dark:text-white text-sm">{order.customer_name}</p>
                        <p className="text-slate-500 text-xs">{order.customer_email}</p>
                      </td>
                      <td className="p-3 text-right">
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                          <TreePine size={14} />
                          {formatCurrency(order.donation_amount)}
                        </span>
                      </td>
                      <td className="p-3 text-right text-slate-600 dark:text-slate-400">
                        {formatCurrency(order.order_total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-slate-500">
                No tree donations found in the selected date range
              </div>
            )}
          </div>
        )}
      </div>

      {/* Empty State */}
      {!loading && summary.total_orders_with_donation === 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center">
          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <TreePine size={32} className="text-emerald-500" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">No Tree Donations Yet</h3>
          <p className="text-slate-500 max-w-md mx-auto">
            Tree donations will appear here once customers start adding the ₹5 donation at checkout. 
            Each donation is matched by Addrika to plant a tree together!
          </p>
        </div>
      )}
    </div>
  );
}
