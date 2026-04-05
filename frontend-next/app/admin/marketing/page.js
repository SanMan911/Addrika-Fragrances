'use client';

import { useState, useEffect, useCallback } from 'react';
import { Tag, Gift, Percent, RefreshCw, Plus, Trash2, Copy, X } from 'lucide-react';
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

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const handleCreateCoupon = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      // Backend expects camelCase field names
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

  const handleDeleteCoupon = async (couponCode) => {
    if (!confirm(`Delete coupon ${couponCode}?`)) return;
    
    try {
      const res = await authFetch(`${API_URL}/api/admin/discount-codes/${couponCode}`, {
        method: 'DELETE'
      });
      
      if (res.ok) {
        toast.success('Coupon deleted');
        fetchData();
      } else {
        throw new Error('Failed to delete');
      }
    } catch (error) {
      toast.error('Failed to delete coupon');
    }
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
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage coupons and gift codes</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCouponForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg"
          >
            <Plus size={18} />
            Create Coupon
          </button>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setActiveTab('coupons')}
          className={`px-4 py-2 font-medium transition-colors ${
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
          onClick={() => setActiveTab('gift-codes')}
          className={`px-4 py-2 font-medium transition-colors ${
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
              key={coupon.id || coupon.code}
              className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                    <Tag size={20} className="text-purple-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-mono font-bold text-slate-800 dark:text-white">{coupon.code}</h3>
                      <button
                        onClick={() => copyToClipboard(coupon.code)}
                        className="p-1 hover:bg-slate-100 rounded"
                      >
                        <Copy size={14} className="text-slate-400" />
                      </button>
                    </div>
                    <p className="text-sm text-slate-500">
                      {coupon.discount_type === 'percentage' 
                        ? `${coupon.discount_value}% off`
                        : `₹${coupon.discount_value} off`
                      }
                      {coupon.min_order_value && ` (Min: ₹${coupon.min_order_value})`}
                    </p>
                  </div>
                </div>
                <div className="text-right flex items-center gap-2">
                  <div>
                    <p className="text-sm text-slate-500">
                      Used: {coupon.usage_count || 0} / {coupon.usage_limit || '∞'}
                    </p>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      coupon.is_active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {coupon.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteCoupon(coupon.code)}
                    className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg text-red-500"
                    title="Delete coupon"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          
          {coupons.length === 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border p-8 text-center text-slate-500">
              No coupons found
            </div>
          )}
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
                        className="p-1 hover:bg-slate-100 rounded"
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
                      ? 'bg-slate-100 text-slate-600' 
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {code.is_redeemed ? 'Redeemed' : 'Available'}
                  </span>
                </div>
              </div>
            </div>
          ))}
          
          {giftCodes.length === 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border p-8 text-center text-slate-500">
              No gift codes found
            </div>
          )}
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
