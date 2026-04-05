'use client';

import { useState, useEffect, useCallback } from 'react';
import { Tag, Gift, Percent, RefreshCw, Plus, Trash2, Copy, X, BarChart3, TrendingUp, Users, ShoppingCart, Eye, ChevronDown, ChevronUp, Calendar, DollarSign, Hash } from 'lucide-react';
import { toast } from 'sonner';
import { authFetch } from '../layout';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const initialCouponForm = {
  code: '',
  discount_type: 'percentage',
  discount_value: '',
  min_order_value: '',
  max_discount: '',
  usage_limit: '',
  valid_from: '',
  valid_until: '',
  is_active: true
};

export default function AdminMarketingPage() {
  const [activeTab, setActiveTab] = useState('coupons');
  const [coupons, setCoupons] = useState([]);
  const [giftCodes, setGiftCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCouponForm, setShowCouponForm] = useState(false);
  const [couponForm, setCouponForm] = useState(initialCouponForm);
  const [submitting, setSubmitting] = useState(false);
  
  // Analytics state
  const [performance, setPerformance] = useState([]);
  const [performanceSummary, setPerformanceSummary] = useState(null);
  const [usageLogs, setUsageLogs] = useState([]);
  const [usageStats, setUsageStats] = useState(null);
  const [selectedCouponForDetails, setSelectedCouponForDetails] = useState(null);
  const [couponUsageDetails, setCouponUsageDetails] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [expandedCoupon, setExpandedCoupon] = useState(null);
  
  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [couponsRes, giftCodesRes] = await Promise.all([
        authFetch(`${API_URL}/api/admin/discount-codes`),
        authFetch(`${API_URL}/api/admin/gift-codes`)
      ]);
      
      if (couponsRes.ok) {
        const data = await couponsRes.json();
        setCoupons(data.codes || data.coupons || data || []);
      }
      if (giftCodesRes.ok) {
        const data = await giftCodesRes.json();
        setGiftCodes(data.codes || data || []);
      }
    } catch (error) {
      console.error('Failed to fetch marketing data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAnalytics = useCallback(async () => {
    try {
      const [perfRes, usageRes] = await Promise.all([
        authFetch(`${API_URL}/api/admin/discount-code-performance`),
        authFetch(`${API_URL}/api/admin/discount-code-usage?limit=100`)
      ]);
      
      if (perfRes.ok) {
        const data = await perfRes.json();
        setPerformance(data.performance || []);
        setPerformanceSummary(data.summary || null);
      }
      if (usageRes.ok) {
        const data = await usageRes.json();
        setUsageLogs(data.usage_logs || []);
        setUsageStats(data.stats || null);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    }
  }, []);

  const fetchCouponUsageDetails = async (couponCode) => {
    setLoadingDetails(true);
    try {
      const res = await authFetch(`${API_URL}/api/admin/discount-code-usage?code=${couponCode}&limit=100`);
      if (res.ok) {
        const data = await res.json();
        setCouponUsageDetails(data.usage_logs || []);
        setSelectedCouponForDetails(couponCode);
      }
    } catch (error) {
      console.error('Failed to fetch coupon details:', error);
      toast.error('Failed to load coupon usage details');
    } finally {
      setLoadingDetails(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (activeTab === 'analytics') {
      fetchAnalytics();
    }
  }, [activeTab, fetchAnalytics]);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const handleCreateCoupon = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      const payload = {
        code: couponForm.code.toUpperCase(),
        discountType: couponForm.discount_type,
        discountValue: parseFloat(couponForm.discount_value),
        minOrderValue: couponForm.min_order_value ? parseFloat(couponForm.min_order_value) : 0,
        maxDiscount: couponForm.max_discount ? parseFloat(couponForm.max_discount) : null,
        maxUses: couponForm.usage_limit ? parseInt(couponForm.usage_limit) : null,
        usageType: 'universal',
        expiresAt: couponForm.valid_until || null,
        description: `${couponForm.discount_type === 'percentage' ? couponForm.discount_value + '%' : '₹' + couponForm.discount_value} discount`
      };
      
      const res = await authFetch(`${API_URL}/api/admin/discount-codes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        toast.success('Coupon created successfully!');
        setShowCouponForm(false);
        setCouponForm(initialCouponForm);
        fetchData();
      } else {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to create coupon');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to create coupon');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCoupon = async (coupon) => {
    if (deleteConfirmText !== coupon.code) {
      toast.error('Please type the coupon code to confirm deletion');
      return;
    }
    
    try {
      // Use _id if available, otherwise use code
      const deleteId = coupon._id || coupon.code;
      const res = await authFetch(`${API_URL}/api/admin/discount-codes/${deleteId}`, {
        method: 'DELETE'
      });
      
      if (res.ok) {
        toast.success(`Coupon ${coupon.code} deleted successfully`);
        setShowDeleteConfirm(null);
        setDeleteConfirmText('');
        fetchData();
      } else {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to delete');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to delete coupon');
    }
  };

  const handleToggleCoupon = async (coupon) => {
    try {
      const toggleId = coupon._id || coupon.code;
      const res = await authFetch(`${API_URL}/api/admin/discount-codes/${toggleId}/toggle`, {
        method: 'PATCH'
      });
      
      if (res.ok) {
        const data = await res.json();
        toast.success(data.message);
        fetchData();
      } else {
        throw new Error('Failed to toggle status');
      }
    } catch (error) {
      toast.error('Failed to update coupon status');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount) => {
    return `₹${(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Marketing</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage coupons, gift codes & analytics</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCouponForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg"
            data-testid="create-coupon-btn"
          >
            <Plus size={18} />
            Create Coupon
          </button>
          <button
            onClick={() => { fetchData(); if (activeTab === 'analytics') fetchAnalytics(); }}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
        <button
          onClick={() => setActiveTab('coupons')}
          className={`px-4 py-2 font-medium transition-colors whitespace-nowrap ${
            activeTab === 'coupons'
              ? 'text-amber-600 border-b-2 border-amber-600'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <span className="flex items-center gap-2">
            <Percent size={18} />
            Coupons ({coupons.length})
          </span>
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-4 py-2 font-medium transition-colors whitespace-nowrap ${
            activeTab === 'analytics'
              ? 'text-amber-600 border-b-2 border-amber-600'
              : 'text-slate-500 hover:text-slate-700'
          }`}
          data-testid="analytics-tab"
        >
          <span className="flex items-center gap-2">
            <BarChart3 size={18} />
            Analytics
          </span>
        </button>
        <button
          onClick={() => setActiveTab('gift-codes')}
          className={`px-4 py-2 font-medium transition-colors whitespace-nowrap ${
            activeTab === 'gift-codes'
              ? 'text-amber-600 border-b-2 border-amber-600'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <span className="flex items-center gap-2">
            <Gift size={18} />
            Gift Codes ({giftCodes.length})
          </span>
        </button>
      </div>

      {/* Coupons Tab */}
      {activeTab === 'coupons' && (
        <div className="space-y-4">
          {coupons.map((coupon) => (
            <div
              key={coupon._id || coupon.code}
              className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4"
              data-testid={`coupon-card-${coupon.code}`}
            >
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                    <Tag size={20} className="text-purple-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-mono font-bold text-slate-800 dark:text-white">{coupon.code}</h3>
                      <button
                        onClick={() => copyToClipboard(coupon.code)}
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                      >
                        <Copy size={14} className="text-slate-400" />
                      </button>
                    </div>
                    <p className="text-sm text-slate-500">
                      {coupon.discount_type === 'percentage' 
                        ? `${coupon.discount_value}% off`
                        : `₹${coupon.discount_value} off`
                      }
                      {coupon.min_order_value > 0 && ` (Min: ₹${coupon.min_order_value})`}
                      {coupon.max_discount && ` (Max: ₹${coupon.max_discount})`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm text-slate-500">
                      Used: <span className="font-semibold">{coupon.times_used || 0}</span> / {coupon.max_uses || '∞'}
                    </p>
                    <button
                      onClick={() => handleToggleCoupon(coupon)}
                      className={`text-xs px-2 py-1 rounded-full cursor-pointer transition-colors ${
                        coupon.is_active 
                          ? 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400' 
                          : 'bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400'
                      }`}
                    >
                      {coupon.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      setExpandedCoupon(expandedCoupon === coupon.code ? null : coupon.code);
                      if (expandedCoupon !== coupon.code) {
                        fetchCouponUsageDetails(coupon.code);
                      }
                    }}
                    className="p-2 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg text-blue-600"
                    title="View usage details"
                  >
                    <Eye size={16} />
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(coupon)}
                    className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg text-red-500"
                    title="Delete coupon"
                    data-testid={`delete-coupon-${coupon.code}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              
              {/* Expanded Usage Details */}
              {expandedCoupon === coupon.code && (
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                    <BarChart3 size={16} />
                    Usage History
                  </h4>
                  {loadingDetails ? (
                    <div className="flex items-center justify-center py-4">
                      <RefreshCw className="animate-spin text-slate-400" size={20} />
                    </div>
                  ) : couponUsageDetails.length > 0 ? (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {couponUsageDetails.map((usage, idx) => (
                        <div key={idx} className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3 text-sm">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-slate-700 dark:text-slate-300">
                                {usage.email || usage.user_email || 'Unknown User'}
                              </p>
                              <p className="text-slate-500 text-xs">
                                Order: {usage.order_id || 'N/A'}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-green-600">-{formatCurrency(usage.discount_amount)}</p>
                              <p className="text-slate-500 text-xs">Cart: {formatCurrency(usage.cart_total)}</p>
                            </div>
                          </div>
                          <p className="text-slate-400 text-xs mt-1">{formatDate(usage.used_at)}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500 text-sm py-4 text-center">No usage history found</p>
                  )}
                </div>
              )}
            </div>
          ))}
          
          {coupons.length === 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center text-slate-500">
              No coupons found. Create one to get started!
            </div>
          )}
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Summary Cards */}
          {performanceSummary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                    <Hash size={20} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Total Uses</p>
                    <p className="text-xl font-bold text-slate-800 dark:text-white">
                      {performanceSummary.total_orders_with_discount || 0}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                    <ShoppingCart size={20} className="text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Total Cart Value</p>
                    <p className="text-xl font-bold text-slate-800 dark:text-white">
                      {formatCurrency(performanceSummary.total_cart_value)}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                    <TrendingUp size={20} className="text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Total Discount Given</p>
                    <p className="text-xl font-bold text-slate-800 dark:text-white">
                      {formatCurrency(performanceSummary.total_discount_given)}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                    <Users size={20} className="text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Unique Customers</p>
                    <p className="text-xl font-bold text-slate-800 dark:text-white">
                      {performanceSummary.total_customers || 0}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Performance Table */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                <BarChart3 size={18} />
                Coupon Performance
              </h3>
            </div>
            {performance.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 dark:bg-slate-900">
                    <tr>
                      <th className="text-left p-3 text-sm font-medium text-slate-500">Code</th>
                      <th className="text-right p-3 text-sm font-medium text-slate-500">Uses</th>
                      <th className="text-right p-3 text-sm font-medium text-slate-500">Customers</th>
                      <th className="text-right p-3 text-sm font-medium text-slate-500">Cart Value</th>
                      <th className="text-right p-3 text-sm font-medium text-slate-500">Discount Given</th>
                      <th className="text-right p-3 text-sm font-medium text-slate-500">Net Revenue</th>
                      <th className="text-right p-3 text-sm font-medium text-slate-500">Avg Cart</th>
                      <th className="text-center p-3 text-sm font-medium text-slate-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {performance.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                        <td className="p-3">
                          <span className="font-mono font-bold text-slate-800 dark:text-white">{item.code}</span>
                          <p className="text-xs text-slate-500">
                            {item.discount_type === 'percentage' ? `${item.discount_value}%` : `₹${item.discount_value}`}
                          </p>
                        </td>
                        <td className="p-3 text-right font-semibold text-slate-700 dark:text-slate-300">
                          {item.total_uses}
                        </td>
                        <td className="p-3 text-right text-slate-600 dark:text-slate-400">
                          {item.unique_customers}
                        </td>
                        <td className="p-3 text-right text-slate-600 dark:text-slate-400">
                          {formatCurrency(item.total_cart_value)}
                        </td>
                        <td className="p-3 text-right text-red-600 font-medium">
                          -{formatCurrency(item.total_discount_given)}
                        </td>
                        <td className="p-3 text-right text-green-600 font-semibold">
                          {formatCurrency(item.net_revenue)}
                        </td>
                        <td className="p-3 text-right text-slate-600 dark:text-slate-400">
                          {formatCurrency(item.avg_cart_value)}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            item.is_active
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                          }`}>
                            {item.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500">
                No coupon usage data yet. Usage will appear here after customers use coupons.
              </div>
            )}
          </div>

          {/* Recent Usage Logs */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                <Calendar size={18} />
                Recent Usage (Invoice Details)
              </h3>
            </div>
            {usageLogs.length > 0 ? (
              <div className="divide-y divide-slate-200 dark:divide-slate-700 max-h-96 overflow-y-auto">
                {usageLogs.map((log, idx) => (
                  <div key={idx} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-900/50">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-amber-600">{log.code}</span>
                          <span className="text-slate-500">•</span>
                          <span className="text-sm text-slate-600 dark:text-slate-400">
                            {log.email || log.user_email || 'Guest'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Order ID: {log.order_id || 'N/A'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-green-600">-{formatCurrency(log.discount_amount)}</p>
                        <p className="text-sm text-slate-500">Cart: {formatCurrency(log.cart_total)}</p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">{formatDate(log.used_at)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500">
                No usage logs yet
              </div>
            )}
          </div>
        </div>
      )}

      {/* Gift Codes Tab */}
      {activeTab === 'gift-codes' && (
        <div className="space-y-4">
          {giftCodes.map((code) => (
            <div
              key={code.id || code.code}
              className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
                    <Gift size={20} className="text-amber-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-mono font-bold text-slate-800 dark:text-white">{code.code}</h3>
                      <button
                        onClick={() => copyToClipboard(code.code)}
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                      >
                        <Copy size={14} className="text-slate-400" />
                      </button>
                    </div>
                    <p className="text-sm text-slate-500">
                      Value: ₹{code.value}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    code.is_redeemed 
                      ? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400' 
                      : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                  }`}>
                    {code.is_redeemed ? 'Redeemed' : 'Available'}
                  </span>
                </div>
              </div>
            </div>
          ))}
          
          {giftCodes.length === 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center text-slate-500">
              No gift codes found
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-red-600 flex items-center gap-2">
                <Trash2 size={20} />
                Delete Coupon
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-slate-600 dark:text-slate-400">
                Are you sure you want to delete the coupon <span className="font-mono font-bold text-slate-800 dark:text-white">{showDeleteConfirm.code}</span>?
              </p>
              <p className="text-sm text-red-500">
                This action cannot be undone. All usage history will be preserved but the coupon will no longer be usable.
              </p>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Type <span className="font-mono">{showDeleteConfirm.code}</span> to confirm:
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value.toUpperCase())}
                  placeholder="Type coupon code here"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white font-mono"
                  data-testid="delete-confirm-input"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(null);
                    setDeleteConfirmText('');
                  }}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteCoupon(showDeleteConfirm)}
                  disabled={deleteConfirmText !== showDeleteConfirm.code}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="confirm-delete-btn"
                >
                  Delete Coupon
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Coupon Modal */}
      {showCouponForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                Create New Coupon
              </h3>
              <button
                onClick={() => setShowCouponForm(false)}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateCoupon} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Coupon Code *</label>
                <input
                  type="text"
                  required
                  value={couponForm.code}
                  onChange={(e) => setCouponForm({...couponForm, code: e.target.value.toUpperCase()})}
                  placeholder="e.g., SAVE20"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white font-mono"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Discount Type *</label>
                  <select
                    value={couponForm.discount_type}
                    onChange={(e) => setCouponForm({...couponForm, discount_type: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (₹)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Discount Value * {couponForm.discount_type === 'percentage' ? '(%)' : '(₹)'}
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max={couponForm.discount_type === 'percentage' ? 100 : 10000}
                    value={couponForm.discount_value}
                    onChange={(e) => setCouponForm({...couponForm, discount_value: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Min Order Value (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={couponForm.min_order_value}
                    onChange={(e) => setCouponForm({...couponForm, min_order_value: e.target.value})}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Max Discount (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={couponForm.max_discount}
                    onChange={(e) => setCouponForm({...couponForm, max_discount: e.target.value})}
                    placeholder="No limit"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Usage Limit</label>
                <input
                  type="number"
                  min="1"
                  value={couponForm.usage_limit}
                  onChange={(e) => setCouponForm({...couponForm, usage_limit: e.target.value})}
                  placeholder="Unlimited"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Valid From</label>
                  <input
                    type="datetime-local"
                    value={couponForm.valid_from}
                    onChange={(e) => setCouponForm({...couponForm, valid_from: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Valid Until</label>
                  <input
                    type="datetime-local"
                    value={couponForm.valid_until}
                    onChange={(e) => setCouponForm({...couponForm, valid_until: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                  />
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={couponForm.is_active}
                  onChange={(e) => setCouponForm({...couponForm, is_active: e.target.checked})}
                  className="w-4 h-4 rounded border-slate-300"
                />
                <label htmlFor="is_active" className="text-sm text-slate-700 dark:text-slate-300">Active immediately</label>
              </div>
              
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowCouponForm(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Coupon'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
