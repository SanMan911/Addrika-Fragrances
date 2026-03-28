'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Package, Search, Filter, Eye, Check, X, Truck,
  RefreshCw, Loader2, ChevronDown
} from 'lucide-react';
import { toast } from 'sonner';
import { authFetch } from '../layout';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const statusOptions = [
  { value: '', label: 'All Status' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'processing', label: 'Processing' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'rto', label: 'RTO' }
];

const dateRangeOptions = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Last 7 Days' },
  { value: 'month', label: 'Last 30 Days' },
  { value: 'quarter', label: 'Last 3 Months' }
];

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

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
};

const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [dateRangeFilter, setDateRangeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [statusChangeModal, setStatusChangeModal] = useState(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_URL}/api/admin/orders?limit=200`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Filter orders
  const filteredOrders = useMemo(() => {
    let filtered = [...orders];
    
    if (statusFilter) {
      filtered = filtered.filter(o => 
        (o.order_status || o.orderStatus) === statusFilter
      );
    }
    
    if (dateRangeFilter !== 'all') {
      const now = new Date();
      let startDate = new Date();
      
      switch (dateRangeFilter) {
        case 'today':
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(now.getMonth() - 1);
          break;
        case 'quarter':
          startDate.setMonth(now.getMonth() - 3);
          break;
        default:
          break;
      }
      
      filtered = filtered.filter(o => {
        const orderDate = new Date(o.created_at || o.createdAt);
        return orderDate >= startDate;
      });
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(o =>
        (o.order_number || o.orderNumber || o.order_id || '').toLowerCase().includes(query) ||
        (o.shipping?.name || '').toLowerCase().includes(query) ||
        (o.shipping?.email || '').toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [orders, statusFilter, dateRangeFilter, searchQuery]);

  const handleStatusChange = async (orderId, newStatus) => {
    setIsUpdatingStatus(true);
    try {
      const res = await authFetch(
        `${API_URL}/api/admin/orders/${encodeURIComponent(orderId)}/status?status=${encodeURIComponent(newStatus)}`,
        { method: 'PATCH' }
      );
      
      if (res.ok) {
        toast.success(`Order status updated to ${newStatus}`);
        setOrders(prev => prev.map(o => 
          (o.order_id === orderId || o.orderId === orderId) 
            ? { ...o, order_status: newStatus, orderStatus: newStatus }
            : o
        ));
        setStatusChangeModal(null);
      } else {
        throw new Error('Failed to update status');
      }
    } catch (error) {
      toast.error('Failed to update order status');
    } finally {
      setIsUpdatingStatus(false);
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
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Orders</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {filteredOrders.length} orders found
          </p>
        </div>
        <button
          onClick={fetchOrders}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          data-testid="refresh-orders"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search orders..."
              className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
              data-testid="search-orders"
            />
          </div>
          
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
            data-testid="filter-status"
          >
            {statusOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          
          {/* Date Range */}
          <select
            value={dateRangeFilter}
            onChange={(e) => setDateRangeFilter(e.target.value)}
            className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
            data-testid="filter-date-range"
          >
            {dateRangeOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-900/50">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-600 dark:text-slate-400">Order</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-600 dark:text-slate-400">Customer</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-600 dark:text-slate-400">Date</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-600 dark:text-slate-400">Status</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-slate-600 dark:text-slate-400">Amount</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-slate-600 dark:text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {filteredOrders.map((order) => {
                const orderId = order.order_id || order.orderId;
                const orderNumber = order.order_number || order.orderNumber || orderId?.slice(-8);
                const status = order.order_status || order.orderStatus || 'pending';
                
                return (
                  <tr key={orderId} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center">
                          <Package size={18} className="text-slate-500" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-800 dark:text-white">{orderNumber}</p>
                          <p className="text-xs text-slate-500">{order.items?.length || 0} items</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-800 dark:text-white">{order.shipping?.name || 'N/A'}</p>
                      <p className="text-xs text-slate-500">{order.shipping?.email || order.shipping?.phone || ''}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                      {formatDate(order.created_at || order.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
                        {status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-800 dark:text-white">
                      {formatCurrency(order.pricing?.final_total || order.total || 0)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400"
                          title="View Details"
                          data-testid={`view-order-${orderId}`}
                        >
                          <Eye size={18} />
                        </button>
                        <select
                          value={status}
                          onChange={(e) => {
                            const newStatus = e.target.value;
                            setStatusChangeModal({ orderId, newStatus, currentStatus: status });
                          }}
                          className="px-2 py-1 text-sm border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-900"
                          data-testid={`status-select-${orderId}`}
                        >
                          {statusOptions.filter(s => s.value).map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {filteredOrders.length === 0 && (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400">
            No orders found
          </div>
        )}
      </div>

      {/* Status Change Confirmation Modal */}
      {statusChangeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">
              Confirm Status Change
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              Change order status from <strong>{statusChangeModal.currentStatus}</strong> to{' '}
              <strong>{statusChangeModal.newStatus}</strong>?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setStatusChangeModal(null)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={() => handleStatusChange(statusChangeModal.orderId, statusChangeModal.newStatus)}
                disabled={isUpdatingStatus}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {isUpdatingStatus && <Loader2 size={16} className="animate-spin" />}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                Order #{selectedOrder.order_number || selectedOrder.orderNumber || selectedOrder.order_id?.slice(-8)}
              </h3>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Customer Info */}
              <div>
                <h4 className="font-medium text-slate-800 dark:text-white mb-2">Customer</h4>
                <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4">
                  <p className="font-medium">{selectedOrder.shipping?.name || 'N/A'}</p>
                  <p className="text-sm text-slate-500">{selectedOrder.shipping?.email}</p>
                  <p className="text-sm text-slate-500">{selectedOrder.shipping?.phone}</p>
                </div>
              </div>
              
              {/* Shipping Address */}
              {selectedOrder.shipping && (
                <div>
                  <h4 className="font-medium text-slate-800 dark:text-white mb-2">Shipping Address</h4>
                  <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 text-sm">
                    <p>{selectedOrder.shipping.address}</p>
                    <p>{selectedOrder.shipping.city}, {selectedOrder.shipping.state} - {selectedOrder.shipping.pincode}</p>
                  </div>
                </div>
              )}
              
              {/* Items */}
              <div>
                <h4 className="font-medium text-slate-800 dark:text-white mb-2">Items</h4>
                <div className="space-y-2">
                  {selectedOrder.items?.map((item, idx) => (
                    <div key={idx} className="flex justify-between bg-slate-50 dark:bg-slate-900 rounded-lg p-4">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-slate-500">{item.size} × {item.quantity}</p>
                      </div>
                      <p className="font-medium">{formatCurrency(item.price * item.quantity)}</p>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Pricing */}
              <div>
                <h4 className="font-medium text-slate-800 dark:text-white mb-2">Payment</h4>
                <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{formatCurrency(selectedOrder.pricing?.subtotal || selectedOrder.total || 0)}</span>
                  </div>
                  {selectedOrder.pricing?.discount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount</span>
                      <span>-{formatCurrency(selectedOrder.pricing.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Shipping</span>
                    <span>{formatCurrency(selectedOrder.pricing?.shipping || 0)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg border-t pt-2">
                    <span>Total</span>
                    <span>{formatCurrency(selectedOrder.pricing?.final_total || selectedOrder.total || 0)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
