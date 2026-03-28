'use client';

import { useState, useEffect, useCallback } from 'react';
import { Settings, Save, RefreshCw, Mail, Store, Truck, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { authFetch } from '../layout';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState({
    store_name: 'Addrika',
    store_email: '',
    store_phone: '',
    shipping_free_threshold: 499,
    shipping_charge: 49,
    gst_percentage: 18,
    order_prefix: 'ADD',
    enable_cod: true,
    enable_razorpay: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_URL}/api/admin/settings`);
      if (res.ok) {
        const data = await res.json();
        setSettings(prev => ({ ...prev, ...data }));
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await authFetch(`${API_URL}/api/admin/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      
      if (res.ok) {
        toast.success('Settings saved successfully');
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
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
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Settings</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage store configuration</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50"
        >
          <Save size={18} className={saving ? 'animate-spin' : ''} />
          Save Changes
        </button>
      </div>

      {/* Store Settings */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
          <Store size={20} />
          Store Information
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Store Name</label>
            <input
              type="text"
              value={settings.store_name}
              onChange={(e) => handleChange('store_name', e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Contact Email</label>
            <input
              type="email"
              value={settings.store_email}
              onChange={(e) => handleChange('store_email', e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Contact Phone</label>
            <input
              type="tel"
              value={settings.store_phone}
              onChange={(e) => handleChange('store_phone', e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Order Prefix</label>
            <input
              type="text"
              value={settings.order_prefix}
              onChange={(e) => handleChange('order_prefix', e.target.value.toUpperCase())}
              className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
            />
          </div>
        </div>
      </div>

      {/* Shipping Settings */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
          <Truck size={20} />
          Shipping
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Free Shipping Threshold (₹)</label>
            <input
              type="number"
              value={settings.shipping_free_threshold}
              onChange={(e) => handleChange('shipping_free_threshold', parseInt(e.target.value) || 0)}
              className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Shipping Charge (₹)</label>
            <input
              type="number"
              value={settings.shipping_charge}
              onChange={(e) => handleChange('shipping_charge', parseInt(e.target.value) || 0)}
              className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
            />
          </div>
        </div>
      </div>

      {/* Payment Settings */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
          <CreditCard size={20} />
          Payment
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">GST Percentage (%)</label>
            <input
              type="number"
              value={settings.gst_percentage}
              onChange={(e) => handleChange('gst_percentage', parseInt(e.target.value) || 0)}
              className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
            />
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.enable_razorpay}
                onChange={(e) => handleChange('enable_razorpay', e.target.checked)}
                className="w-4 h-4 text-amber-500 rounded"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">Enable Razorpay</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.enable_cod}
                onChange={(e) => handleChange('enable_cod', e.target.checked)}
                className="w-4 h-4 text-amber-500 rounded"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">Enable COD</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
