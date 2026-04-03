'use client';

import { useState, useEffect, useCallback } from 'react';
import { Tag, Gift, Percent, RefreshCw, Plus, Trash2, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { authFetch } from '../layout';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://product-size-sync.preview.emergentagent.com';

export default function AdminMarketingPage() {
  const [activeTab, setActiveTab] = useState('coupons');
  const [coupons, setCoupons] = useState([]);
  const [giftCodes, setGiftCodes] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [couponsRes, giftCodesRes] = await Promise.all([
        authFetch(`${API_URL}/api/admin/coupons`),
        authFetch(`${API_URL}/api/admin/gift-codes`)
      ]);
      
      if (couponsRes.ok) {
        const data = await couponsRes.json();
        setCoupons(data.coupons || data || []);
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
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
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
                <div className="text-right">
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
    </div>
  );
}
