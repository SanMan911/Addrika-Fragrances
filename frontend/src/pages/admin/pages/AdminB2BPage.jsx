/**
 * AdminB2BPage - Admin B2B Management Dashboard
 * Tabs: Orders, Vouchers, Credit Notes, Self-Pickup
 */
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Package, Ticket, CreditCard, Award, Search, Filter,
  ChevronRight, Clock, CheckCircle, XCircle, Truck, 
  RotateCcw, Edit, Plus, Eye, Download, Users,
  TrendingUp, AlertCircle, RefreshCw
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Order status configuration
const ORDER_STATUSES = {
  ordered: { label: 'Ordered', color: '#6B7280', bg: '#F3F4F6', icon: Clock },
  confirmed: { label: 'Confirmed', color: '#2563EB', bg: '#DBEAFE', icon: CheckCircle },
  processing: { label: 'Processing', color: '#7C3AED', bg: '#EDE9FE', icon: RefreshCw },
  packaging: { label: 'Packaging', color: '#EA580C', bg: '#FED7AA', icon: Package },
  shipped: { label: 'Shipped', color: '#0891B2', bg: '#CFFAFE', icon: Truck },
  delivered: { label: 'Delivered', color: '#16A34A', bg: '#DCFCE7', icon: CheckCircle },
  returned: { label: 'Returned', color: '#DC2626', bg: '#FEE2E2', icon: RotateCcw },
  modified: { label: 'Modified', color: '#CA8A04', bg: '#FEF3C7', icon: Edit }
};

const CN_REASONS = [
  'Goods Returned',
  'Damaged Pickup',
  'Self-Pick by Customer',
  'Shipped to Customer',
  'Quality Issue',
  'Price Adjustment',
  'Other'
];

const AdminB2BPage = () => {
  const [activeTab, setActiveTab] = useState('orders');
  const [loading, setLoading] = useState(false);
  
  // Orders state
  const [orders, setOrders] = useState([]);
  const [orderStatusCounts, setOrderStatusCounts] = useState({});
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderStatusFilter, setOrderStatusFilter] = useState('');
  
  // Vouchers state
  const [vouchers, setVouchers] = useState([]);
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [voucherForm, setVoucherForm] = useState({
    code: '',
    discount_type: 'percentage',
    discount_value: '',
    max_discount: '',
    min_order: '',
    retailer_id: '',
    max_uses: '',
    expires_at: ''
  });
  
  // Credit Notes state
  const [creditNotes, setCreditNotes] = useState([]);
  const [cnSummary, setCnSummary] = useState({});
  const [showCNModal, setShowCNModal] = useState(false);
  const [cnForm, setCnForm] = useState({
    retailer_id: '',
    amount: '',
    reason: '',
    notes: ''
  });
  const [retailers, setRetailers] = useState([]);
  
  // Self-Pickup state
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardPeriod, setLeaderboardPeriod] = useState('quarter');
  const [pickupSummary, setPickupSummary] = useState({});

  // Fetch with credentials
  const fetchWithAuth = async (url, options = {}) => {
    return fetch(url, {
      ...options,
      credentials: 'include'
    });
  };

  // Fetch orders
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (orderStatusFilter) params.set('status', orderStatusFilter);
      
      const response = await fetchWithAuth(
        `${API_URL}/api/admin/b2b/orders?${params.toString()}`
      );
      if (response.ok) {
        const data = await response.json();
        setOrders(data.orders || []);
        setOrderStatusCounts(data.status_counts || {});
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
    }
  }, [orderStatusFilter]);

  // Fetch vouchers
  const fetchVouchers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchWithAuth(`${API_URL}/api/admin/b2b/vouchers`);
      if (response.ok) {
        const data = await response.json();
        setVouchers(data.vouchers || []);
      }
    } catch (error) {
      console.error('Failed to fetch vouchers:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch credit notes
  const fetchCreditNotes = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchWithAuth(`${API_URL}/api/admin/b2b/credit-notes`);
      if (response.ok) {
        const data = await response.json();
        setCreditNotes(data.credit_notes || []);
        setCnSummary(data.summary || {});
      }
    } catch (error) {
      console.error('Failed to fetch credit notes:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch leaderboard
  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchWithAuth(
        `${API_URL}/api/admin/b2b/self-pickup/leaderboard?period=${leaderboardPeriod}`
      );
      if (response.ok) {
        const data = await response.json();
        setLeaderboard(data.leaderboard || []);
        setPickupSummary({ period_label: data.period_label });
      }
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    } finally {
      setLoading(false);
    }
  }, [leaderboardPeriod]);

  // Fetch retailers for dropdown
  const fetchRetailers = useCallback(async () => {
    try {
      const response = await fetchWithAuth(`${API_URL}/api/retailers/admin/list`);
      if (response.ok) {
        const data = await response.json();
        setRetailers(data.retailers || []);
      }
    } catch (error) {
      console.error('Failed to fetch retailers:', error);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'orders') fetchOrders();
    else if (activeTab === 'vouchers') fetchVouchers();
    else if (activeTab === 'credit-notes') {
      fetchCreditNotes();
      fetchRetailers();
    }
    else if (activeTab === 'self-pickup') fetchLeaderboard();
  }, [activeTab, fetchOrders, fetchVouchers, fetchCreditNotes, fetchLeaderboard, fetchRetailers]);

  // Update order status
  const updateOrderStatus = async (orderId, newStatus, note = '') => {
    try {
      const response = await fetchWithAuth(
        `${API_URL}/api/admin/b2b/orders/${orderId}/status`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus, note })
        }
      );
      
      if (response.ok) {
        toast.success(`Order status updated to ${newStatus}`);
        fetchOrders();
        setSelectedOrder(null);
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to update status');
      }
    } catch (error) {
      toast.error('Failed to update order status');
    }
  };

  // Create voucher
  const createVoucher = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...voucherForm,
        discount_value: parseFloat(voucherForm.discount_value),
        max_discount: voucherForm.max_discount ? parseFloat(voucherForm.max_discount) : null,
        min_order: voucherForm.min_order ? parseFloat(voucherForm.min_order) : null,
        max_uses: voucherForm.max_uses ? parseInt(voucherForm.max_uses) : null,
        retailer_id: voucherForm.retailer_id || null,
        expires_at: voucherForm.expires_at || null
      };
      
      const response = await fetchWithAuth(`${API_URL}/api/admin/b2b/vouchers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        const data = await response.json();
        toast.success(`Voucher ${data.code} created!`);
        setShowVoucherModal(false);
        setVoucherForm({
          code: '', discount_type: 'percentage', discount_value: '',
          max_discount: '', min_order: '', retailer_id: '', max_uses: '', expires_at: ''
        });
        fetchVouchers();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to create voucher');
      }
    } catch (error) {
      toast.error('Failed to create voucher');
    }
  };

  // Deactivate voucher
  const deactivateVoucher = async (code) => {
    if (!window.confirm(`Deactivate voucher ${code}?`)) return;
    
    try {
      const response = await fetchWithAuth(
        `${API_URL}/api/admin/b2b/vouchers/${code}/deactivate`,
        { method: 'PUT' }
      );
      
      if (response.ok) {
        toast.success('Voucher deactivated');
        fetchVouchers();
      } else {
        toast.error('Failed to deactivate voucher');
      }
    } catch (error) {
      toast.error('Failed to deactivate voucher');
    }
  };

  // Create credit note
  const createCreditNote = async (e) => {
    e.preventDefault();
    try {
      const response = await fetchWithAuth(`${API_URL}/api/admin/b2b/credit-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          retailer_id: cnForm.retailer_id,
          amount: parseFloat(cnForm.amount),
          reason: cnForm.reason,
          notes: cnForm.notes || null
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        toast.success(`Credit Note ${data.code} created and emailed!`);
        setShowCNModal(false);
        setCnForm({ retailer_id: '', amount: '', reason: '', notes: '' });
        fetchCreditNotes();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to create credit note');
      }
    } catch (error) {
      toast.error('Failed to create credit note');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return 'N/A';
    }
  };

  const StatusBadge = ({ status }) => {
    const config = ORDER_STATUSES[status] || ORDER_STATUSES.ordered;
    const Icon = config.icon;
    return (
      <span 
        className="px-2 py-1 text-xs font-medium rounded-full flex items-center gap-1 w-fit"
        style={{ backgroundColor: config.bg, color: config.color }}
      >
        <Icon size={12} />
        {config.label}
      </span>
    );
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">B2B Management</h1>
        <p className="text-slate-500 mt-1">Manage wholesale orders, vouchers, credit notes & retailer performance</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-slate-200 dark:border-slate-700 pb-4 overflow-x-auto">
        {[
          { id: 'orders', label: 'Orders', icon: Package, count: orders.length },
          { id: 'vouchers', label: 'Vouchers', icon: Ticket, count: vouchers.length },
          { id: 'credit-notes', label: 'Credit Notes', icon: CreditCard, count: creditNotes.length },
          { id: 'self-pickup', label: 'Self-Pickup', icon: Award }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
            data-testid={`tab-${tab.id}`}
          >
            <tab.icon size={18} />
            {tab.label}
            {tab.count !== undefined && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-slate-200 dark:bg-slate-700">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Orders Tab */}
      {activeTab === 'orders' && (
        <div>
          {/* Status Filter Pills */}
          <div className="flex gap-2 mb-4 flex-wrap">
            <button
              onClick={() => setOrderStatusFilter('')}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
                !orderStatusFilter
                  ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-800'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              All ({Object.values(orderStatusCounts).reduce((a, b) => a + b, 0)})
            </button>
            {Object.entries(ORDER_STATUSES).map(([status, config]) => (
              <button
                key={status}
                onClick={() => setOrderStatusFilter(status)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
                  orderStatusFilter === status
                    ? 'ring-2 ring-offset-2'
                    : ''
                }`}
                style={{ 
                  backgroundColor: config.bg, 
                  color: config.color,
                  ringColor: config.color
                }}
              >
                {config.label} ({orderStatusCounts[status] || 0})
              </button>
            ))}
          </div>

          {/* Orders Table */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-900">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600 dark:text-slate-300">Order ID</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600 dark:text-slate-300">Retailer</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600 dark:text-slate-300">Date</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-slate-600 dark:text-slate-300">Amount</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-slate-600 dark:text-slate-300">Status</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-slate-600 dark:text-slate-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">Loading...</td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">No orders found</td>
                  </tr>
                ) : orders.map(order => (
                  <tr key={order.order_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm text-amber-600">{order.order_id}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-slate-800 dark:text-white">{order.billing_address?.business_name}</p>
                        <p className="text-xs text-slate-500">{order.retailer_email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                      {formatDate(order.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800 dark:text-white">
                      {formatCurrency(order.grand_total)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={order.order_status} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedOrder(order)}
                        data-testid={`view-order-${order.order_id}`}
                      >
                        <Eye size={14} className="mr-1" />
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Vouchers Tab */}
      {activeTab === 'vouchers' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Retailer Vouchers</h2>
            <Button onClick={() => setShowVoucherModal(true)} data-testid="create-voucher-btn">
              <Plus size={16} className="mr-2" />
              Create Voucher
            </Button>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-900">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600 dark:text-slate-300">Code</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600 dark:text-slate-300">Type</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600 dark:text-slate-300">Value</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600 dark:text-slate-300">Usage</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600 dark:text-slate-300">Expires</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-slate-600 dark:text-slate-300">Status</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-slate-600 dark:text-slate-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {vouchers.map(voucher => (
                  <tr key={voucher.code} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-3">
                      <span className="font-mono font-semibold text-amber-600">{voucher.code}</span>
                    </td>
                    <td className="px-4 py-3 text-sm capitalize">{voucher.discount_type}</td>
                    <td className="px-4 py-3 font-semibold">
                      {voucher.discount_type === 'percentage' 
                        ? `${voucher.discount_value}%`
                        : formatCurrency(voucher.discount_value)
                      }
                      {voucher.max_discount && (
                        <span className="text-xs text-slate-500 ml-1">(max {formatCurrency(voucher.max_discount)})</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {voucher.used_count || 0} / {voucher.max_uses || '∞'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                      {voucher.expires_at ? formatDate(voucher.expires_at) : 'Never'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        voucher.is_active 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {voucher.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {voucher.is_active && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:bg-red-50"
                          onClick={() => deactivateVoucher(voucher.code)}
                        >
                          Deactivate
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Credit Notes Tab */}
      {activeTab === 'credit-notes' && (
        <div>
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
              <p className="text-sm text-slate-500">Total Issued</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">
                {formatCurrency(cnSummary.total_issued || 0)}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
              <p className="text-sm text-slate-500">Total Redeemed</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(cnSummary.total_used || 0)}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
              <p className="text-sm text-slate-500">Outstanding</p>
              <p className="text-2xl font-bold text-amber-600">
                {formatCurrency((cnSummary.total_issued || 0) - (cnSummary.total_used || 0))}
              </p>
            </div>
          </div>

          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Credit Notes</h2>
            <Button onClick={() => setShowCNModal(true)} data-testid="create-cn-btn">
              <Plus size={16} className="mr-2" />
              Issue Credit Note
            </Button>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-900">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600 dark:text-slate-300">Code</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600 dark:text-slate-300">Retailer</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600 dark:text-slate-300">Reason</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-slate-600 dark:text-slate-300">Amount</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-slate-600 dark:text-slate-300">Balance</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600 dark:text-slate-300">Expires</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-slate-600 dark:text-slate-300">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {creditNotes.map(cn => (
                  <tr key={cn.code} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-3">
                      <span className="font-mono font-semibold text-blue-600">{cn.code}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-slate-800 dark:text-white">{cn.retailer_name}</p>
                        <p className="text-xs text-slate-500">{cn.retailer_email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">{cn.reason}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatCurrency(cn.amount)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-600">
                      {formatCurrency(cn.balance)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                      {formatDate(cn.expires_at)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        cn.status === 'active' 
                          ? 'bg-green-100 text-green-700' 
                          : cn.status === 'used'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {cn.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Self-Pickup Tab */}
      {activeTab === 'self-pickup' && (
        <div>
          {/* Period Filter */}
          <div className="flex gap-2 mb-6">
            {['month', 'quarter', 'year', 'all'].map(period => (
              <button
                key={period}
                onClick={() => setLeaderboardPeriod(period)}
                className={`px-4 py-2 rounded-lg font-medium capitalize transition-all ${
                  leaderboardPeriod === period
                    ? 'bg-amber-500 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                {period === 'all' ? 'All Time' : `This ${period}`}
              </button>
            ))}
          </div>

          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
              Self-Pickup Leaderboard - {pickupSummary.period_label}
            </h2>
            <p className="text-slate-500 text-sm">Rankings for Star Retailer selection</p>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-900">
                <tr>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-slate-600 dark:text-slate-300">Rank</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600 dark:text-slate-300">Retailer</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-slate-600 dark:text-slate-300">Pickups</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-slate-600 dark:text-slate-300">Items</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-slate-600 dark:text-slate-300">Status</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-slate-600 dark:text-slate-300">Star Eligible</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {leaderboard.map(retailer => (
                  <tr key={retailer.retailer_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-3 text-center">
                      <span className={`w-8 h-8 rounded-full inline-flex items-center justify-center font-bold ${
                        retailer.rank === 1 ? 'bg-amber-500 text-white' :
                        retailer.rank === 2 ? 'bg-slate-400 text-white' :
                        retailer.rank === 3 ? 'bg-amber-700 text-white' :
                        'bg-slate-200 text-slate-600'
                      }`}>
                        {retailer.rank}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-slate-800 dark:text-white">{retailer.retailer_name}</p>
                        <p className="text-xs text-slate-500">{retailer.city}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center font-semibold">{retailer.total_pickups}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-lg font-bold text-amber-600">{retailer.total_items}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex gap-1 justify-center">
                        {retailer.is_verified_partner && (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">Verified</span>
                        )}
                        {retailer.recognition_level !== 'None' && (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700">
                            {retailer.recognition_level}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {retailer.eligible_for_star ? (
                        <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700 flex items-center gap-1 w-fit mx-auto">
                          <CheckCircle size={12} />
                          Eligible
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs rounded-full bg-slate-100 text-slate-500">
                          {50 - retailer.total_items} more items
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono text-amber-600">{selectedOrder.order_id}</p>
                  <h3 className="text-xl font-bold text-slate-800 dark:text-white">
                    {selectedOrder.billing_address?.business_name}
                  </h3>
                </div>
                <StatusBadge status={selectedOrder.order_status} />
              </div>
            </div>

            <div className="p-6">
              {/* Order Items */}
              <div className="mb-6">
                <h4 className="font-semibold mb-3 text-slate-800 dark:text-white">Order Items</h4>
                <div className="space-y-2">
                  {selectedOrder.items?.map((item, idx) => (
                    <div key={idx} className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-700">
                      <span>{item.name} ({item.net_weight}) × {item.quantity_boxes} boxes</span>
                      <span className="font-semibold">{formatCurrency(item.line_total)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span className="text-amber-600">{formatCurrency(selectedOrder.grand_total)}</span>
                  </div>
                </div>
              </div>

              {/* Status History */}
              <div className="mb-6">
                <h4 className="font-semibold mb-3 text-slate-800 dark:text-white">Status History</h4>
                <div className="space-y-2">
                  {selectedOrder.status_history?.map((history, idx) => (
                    <div key={idx} className="flex items-center gap-3 text-sm">
                      <StatusBadge status={history.status} />
                      <span className="text-slate-500">{formatDate(history.timestamp)}</span>
                      {history.note && <span className="text-slate-600">- {history.note}</span>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Update Status */}
              <div className="mb-6">
                <h4 className="font-semibold mb-3 text-slate-800 dark:text-white">Update Status</h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(ORDER_STATUSES).map(([status, config]) => (
                    <button
                      key={status}
                      onClick={() => updateOrderStatus(selectedOrder.order_id, status)}
                      disabled={selectedOrder.order_status === status}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        selectedOrder.order_status === status
                          ? 'opacity-50 cursor-not-allowed'
                          : 'hover:opacity-80'
                      }`}
                      style={{ backgroundColor: config.bg, color: config.color }}
                    >
                      {config.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setSelectedOrder(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Voucher Modal */}
      {showVoucherModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-xl font-bold text-slate-800 dark:text-white">Create Voucher</h3>
            </div>

            <form onSubmit={createVoucher} className="p-6 space-y-4">
              <div>
                <Label>Voucher Code (optional - auto-generate if empty)</Label>
                <Input
                  value={voucherForm.code}
                  onChange={(e) => setVoucherForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  placeholder="RV-XXXXXX"
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Discount Type *</Label>
                  <select
                    value={voucherForm.discount_type}
                    onChange={(e) => setVoucherForm(prev => ({ ...prev, discount_type: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600"
                    required
                  >
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed Amount</option>
                  </select>
                </div>
                <div>
                  <Label>Value * {voucherForm.discount_type === 'percentage' ? '(%)' : '(₹)'}</Label>
                  <Input
                    type="number"
                    value={voucherForm.discount_value}
                    onChange={(e) => setVoucherForm(prev => ({ ...prev, discount_value: e.target.value }))}
                    placeholder={voucherForm.discount_type === 'percentage' ? '10' : '500'}
                    className="mt-1"
                    required
                  />
                </div>
              </div>

              {voucherForm.discount_type === 'percentage' && (
                <div>
                  <Label>Max Discount (₹) - optional</Label>
                  <Input
                    type="number"
                    value={voucherForm.max_discount}
                    onChange={(e) => setVoucherForm(prev => ({ ...prev, max_discount: e.target.value }))}
                    placeholder="1000"
                    className="mt-1"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Min Order (₹)</Label>
                  <Input
                    type="number"
                    value={voucherForm.min_order}
                    onChange={(e) => setVoucherForm(prev => ({ ...prev, min_order: e.target.value }))}
                    placeholder="5000"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Max Uses</Label>
                  <Input
                    type="number"
                    value={voucherForm.max_uses}
                    onChange={(e) => setVoucherForm(prev => ({ ...prev, max_uses: e.target.value }))}
                    placeholder="Unlimited"
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label>Expires On</Label>
                <Input
                  type="date"
                  value={voucherForm.expires_at}
                  onChange={(e) => setVoucherForm(prev => ({ ...prev, expires_at: e.target.value }))}
                  className="mt-1"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setShowVoucherModal(false)} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" className="flex-1 bg-amber-500 hover:bg-amber-600">
                  Create Voucher
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Credit Note Modal */}
      {showCNModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-xl font-bold text-slate-800 dark:text-white">Issue Credit Note</h3>
            </div>

            <form onSubmit={createCreditNote} className="p-6 space-y-4">
              <div>
                <Label>Retailer *</Label>
                <select
                  value={cnForm.retailer_id}
                  onChange={(e) => setCnForm(prev => ({ ...prev, retailer_id: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600"
                  required
                >
                  <option value="">Select Retailer</option>
                  {retailers.map(r => (
                    <option key={r.retailer_id} value={r.retailer_id}>
                      {r.business_name || r.trade_name} ({r.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label>Amount (₹) *</Label>
                <Input
                  type="number"
                  value={cnForm.amount}
                  onChange={(e) => setCnForm(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="Enter amount"
                  className="mt-1"
                  required
                />
              </div>

              <div>
                <Label>Reason *</Label>
                <select
                  value={cnForm.reason}
                  onChange={(e) => setCnForm(prev => ({ ...prev, reason: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600"
                  required
                >
                  <option value="">Select Reason</option>
                  {CN_REASONS.map(reason => (
                    <option key={reason} value={reason}>{reason}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label>Notes (optional)</Label>
                <textarea
                  value={cnForm.notes}
                  onChange={(e) => setCnForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Additional notes..."
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600"
                  rows={3}
                />
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm text-blue-700 dark:text-blue-400">
                  <strong>Note:</strong> Credit note will be valid for 45 days. An email with the CN code will be sent to the retailer.
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setShowCNModal(false)} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" className="flex-1 bg-blue-500 hover:bg-blue-600">
                  Issue Credit Note
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminB2BPage;
