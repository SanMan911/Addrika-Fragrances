import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Tag, Gift, ShoppingCart, BarChart3, RefreshCw, Plus, Trash2, Ticket } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { toast } from 'sonner';
import RTOVouchersTab from '../tabs/RTOVouchersTab';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const AdminMarketingPage = () => {
  const { authFetch } = useOutletContext();
  
  const [activeTab, setActiveTab] = useState('discounts');
  const [discountCodes, setDiscountCodes] = useState([]);
  const [discountUsage, setDiscountUsage] = useState({ usage_logs: [], stats: {} });
  const [abandonedCarts, setAbandonedCarts] = useState([]);
  const [giftCodeStats, setGiftCodeStats] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // New discount form
  const [showNewCodeForm, setShowNewCodeForm] = useState(false);
  const [newCode, setNewCode] = useState({
    code: '',
    discountType: 'percentage',
    discountValue: 10,
    usageType: 'universal',
    maxUses: '',
    minOrderValue: 0,
    maxDiscount: '',
    expiresAt: '',
    description: ''
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [codesRes, usageRes, cartsRes, giftRes] = await Promise.all([
        authFetch(`${API_URL}/api/admin/discount-codes`),
        authFetch(`${API_URL}/api/admin/discount-code-usage`),
        authFetch(`${API_URL}/api/abandoned-carts/admin/stats`),
        authFetch(`${API_URL}/api/gift-codes/admin/stats`)
      ]);

      if (codesRes.ok) {
        const data = await codesRes.json();
        setDiscountCodes(data.codes || []);
      }
      if (usageRes.ok) {
        const data = await usageRes.json();
        setDiscountUsage(data);
      }
      if (cartsRes.ok) {
        const data = await cartsRes.json();
        setAbandonedCarts(data.carts || []);
      }
      if (giftRes.ok) {
        const data = await giftRes.json();
        setGiftCodeStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const createDiscountCode = async (e) => {
    e.preventDefault();
    try {
      const res = await authFetch(`${API_URL}/api/admin/discount-codes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: newCode.code.toUpperCase(),
          discountType: newCode.discountType,
          discountValue: parseFloat(newCode.discountValue),
          usageType: newCode.usageType,
          maxUses: newCode.maxUses ? parseInt(newCode.maxUses) : null,
          minOrderValue: parseFloat(newCode.minOrderValue) || 0,
          maxDiscount: newCode.maxDiscount ? parseFloat(newCode.maxDiscount) : null,
          expiresAt: newCode.expiresAt || null,
          description: newCode.description || null
        })
      });

      if (res.ok) {
        toast.success('Discount code created!');
        setShowNewCodeForm(false);
        setNewCode({ code: '', discountType: 'percentage', discountValue: 10, usageType: 'universal', maxUses: '', minOrderValue: 0, maxDiscount: '', expiresAt: '', description: '' });
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.detail || 'Failed to create code');
      }
    } catch (error) {
      toast.error('Failed to create discount code');
    }
  };

  const deleteDiscountCode = async (codeId) => {
    if (!window.confirm('Are you sure you want to delete this code?')) return;
    
    try {
      const res = await authFetch(`${API_URL}/api/admin/discount-codes/${codeId}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        toast.success('Discount code deleted');
        fetchData();
      } else {
        toast.error('Failed to delete code');
      }
    } catch (error) {
      toast.error('Failed to delete code');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const tabs = [
    { id: 'discounts', label: 'Discount Codes', icon: Tag },
    { id: 'rto', label: 'RTO Vouchers', icon: Ticket },
    { id: 'usage', label: 'Coupon Usage', icon: BarChart3 },
    { id: 'abandoned', label: 'Abandoned Carts', icon: ShoppingCart },
    { id: 'gift', label: 'Gift Codes', icon: Gift },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Marketing</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Discounts, coupons, and promotions</p>
        </div>
        <Button onClick={fetchData} variant="outline" disabled={loading}>
          <RefreshCw size={18} className={loading ? 'animate-spin mr-2' : 'mr-2'} />
          Refresh
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 border-b border-slate-200 dark:border-slate-700">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Discount Codes Tab */}
      {activeTab === 'discounts' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowNewCodeForm(!showNewCodeForm)}>
              <Plus size={18} className="mr-2" />
              New Code
            </Button>
          </div>

          {showNewCodeForm && (
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">Create Discount Code</h3>
              <form onSubmit={createDiscountCode} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="code">Code</Label>
                  <Input
                    id="code"
                    value={newCode.code}
                    onChange={(e) => setNewCode({...newCode, code: e.target.value.toUpperCase()})}
                    placeholder="e.g., SUMMER20"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="discountType">Type</Label>
                  <select
                    id="discountType"
                    value={newCode.discountType}
                    onChange={(e) => setNewCode({...newCode, discountType: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
                  >
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed Amount</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="discountValue">Value</Label>
                  <Input
                    id="discountValue"
                    type="number"
                    value={newCode.discountValue}
                    onChange={(e) => setNewCode({...newCode, discountValue: e.target.value})}
                    placeholder={newCode.discountType === 'percentage' ? '10' : '100'}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="minOrderValue">Min Order Value</Label>
                  <Input
                    id="minOrderValue"
                    type="number"
                    value={newCode.minOrderValue}
                    onChange={(e) => setNewCode({...newCode, minOrderValue: e.target.value})}
                    placeholder="0"
                  />
                </div>
                <div className="md:col-span-2 flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setShowNewCodeForm(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Create Code</Button>
                </div>
              </form>
            </div>
          )}

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-700/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:text-slate-200">Code</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:text-slate-200">Discount</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:text-slate-200">Min Order</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:text-slate-200">Used</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:text-slate-200">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:text-slate-200">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {discountCodes.map((code) => (
                    <tr key={code._id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <td className="px-4 py-3 font-mono font-medium text-slate-800 dark:text-white">
                        {code.code}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                        {code.discount_type === 'percentage' ? `${code.discount_value}%` : formatCurrency(code.discount_value)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                        {code.min_order_value > 0 ? formatCurrency(code.min_order_value) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                        {code.times_used || 0}{code.max_uses ? `/${code.max_uses}` : ''}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          code.is_active
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          {code.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => deleteDiscountCode(code._id)}
                          className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* RTO Vouchers Tab */}
      {activeTab === 'rto' && (
        <RTOVouchersTab />
      )}

      {/* Coupon Usage Tab */}
      {activeTab === 'usage' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <p className="text-sm text-slate-500 dark:text-slate-400">Total Uses</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{discountUsage.stats?.total_uses || 0}</p>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <p className="text-sm text-slate-500 dark:text-slate-400">Total Discount Given</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{formatCurrency(discountUsage.stats?.total_discount_amount)}</p>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <p className="text-sm text-slate-500 dark:text-slate-400">Unique Users</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{discountUsage.stats?.unique_users || 0}</p>
            </div>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-center">
            {discountUsage.usage_logs?.length || 0} usage logs recorded
          </p>
        </div>
      )}

      {/* Abandoned Carts Tab */}
      {activeTab === 'abandoned' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
          <div className="text-center">
            <ShoppingCart size={48} className="mx-auto text-slate-400 mb-4" />
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">Abandoned Cart Recovery</h3>
            <p className="text-slate-500 dark:text-slate-400">
              {abandonedCarts.length} abandoned carts tracked
            </p>
          </div>
        </div>
      )}

      {/* Gift Codes Tab */}
      {activeTab === 'gift' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg text-center">
              <Gift size={32} className="mx-auto text-pink-500 mb-2" />
              <p className="text-sm text-slate-500 dark:text-slate-400">Birthday Codes</p>
              <p className="text-xl font-bold text-slate-800 dark:text-white">
                {giftCodeStats?.birthday_codes?.pending || 0} pending
              </p>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg text-center">
              <Gift size={32} className="mx-auto text-red-500 mb-2" />
              <p className="text-sm text-slate-500 dark:text-slate-400">Anniversary Codes</p>
              <p className="text-xl font-bold text-slate-800 dark:text-white">
                {giftCodeStats?.anniversary_codes?.pending || 0} pending
              </p>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg text-center">
              <Gift size={32} className="mx-auto text-purple-500 mb-2" />
              <p className="text-sm text-slate-500 dark:text-slate-400">Festival Codes</p>
              <p className="text-xl font-bold text-slate-800 dark:text-white">
                {giftCodeStats?.festival_codes?.active || 0} active
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminMarketingPage;
