import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Package, Search, Filter, Trash2, Eye, Check, X, Truck,
  RefreshCw, Loader2, ChevronDown, RotateCcw, AlertTriangle
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const AdminOrdersPage = () => {
  const { authFetch } = useOutletContext();
  
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [dateRangeFilter, setDateRangeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showRestoreForm, setShowRestoreForm] = useState(false);
  
  // Modals
  const [statusChangeModal, setStatusChangeModal] = useState(null);
  const [shippingModalOrder, setShippingModalOrder] = useState(null);
  const [rtoVoucherModal, setRtoVoucherModal] = useState(null);
  const [rtoVoucherPercentage, setRtoVoucherPercentage] = useState(100);
  const [cartSnapshotModal, setCartSnapshotModal] = useState(null);
  
  // Loading states
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [generatingRtoVoucher, setGeneratingRtoVoucher] = useState(false);
  const [loadingCartSnapshot, setLoadingCartSnapshot] = useState(false);
  const [syncingOrderId, setSyncingOrderId] = useState(null);
  
  // ShipRocket status
  const [shiprocketStatus, setShiprocketStatus] = useState(null);

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
  }, [authFetch]);

  const fetchShiprocketStatus = useCallback(async () => {
    try {
      const res = await authFetch(`${API_URL}/api/admin/shiprocket/status`);
      if (res.ok) {
        const data = await res.json();
        setShiprocketStatus(data);
      }
    } catch (error) {
      console.error('Failed to fetch ShipRocket status:', error);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchOrders();
    fetchShiprocketStatus();
  }, [fetchOrders, fetchShiprocketStatus]);

  // Filter orders
  const filteredOrders = useMemo(() => {
    let filtered = [...orders];
    
    // Status filter
    if (statusFilter) {
      filtered = filtered.filter(o => 
        (o.order_status || o.orderStatus) === statusFilter
      );
    }
    
    // Date range filter
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
        case 'year':
          startDate.setFullYear(now.getFullYear() - 1);
          break;
        default:
          break;
      }
      
      filtered = filtered.filter(o => {
        const orderDate = new Date(o.created_at || o.createdAt);
        return orderDate >= startDate;
      });
    }
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(o =>
        (o.order_number || o.orderNumber || '').toLowerCase().includes(query) ||
        (o.shipping?.name || '').toLowerCase().includes(query) ||
        (o.shipping?.email || '').toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [orders, statusFilter, dateRangeFilter, searchQuery]);

  const handleStatusChange = (orderId, newStatus, orderDetails) => {
    if (newStatus === 'shipped') {
      setShippingModalOrder({ orderId, ...orderDetails });
      return;
    }
    setStatusChangeModal({ orderId, newStatus, orderDetails });
  };

  const confirmStatusChange = async () => {
    if (!statusChangeModal) return;
    
    const { orderId, newStatus } = statusChangeModal;
    setIsUpdatingStatus(true);
    
    try {
      const res = await authFetch(
        `${API_URL}/api/admin/orders/${encodeURIComponent(orderId)}/status?status=${encodeURIComponent(newStatus)}`,
        { method: 'PATCH' }
      );
      
      if (res.ok) {
        toast.success(`Order status updated to ${newStatus}`);
        setStatusChangeModal(null);
        fetchOrders();
      } else {
        const errorData = await res.json().catch(() => ({}));
        toast.error(errorData.detail || 'Failed to update status');
      }
    } catch (error) {
      console.error('Error updating order status:', error);
      toast.error('Failed to update status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const updateOrderStatusWithShipping = async (orderId, status, carrierName, trackingNumber) => {
    try {
      const params = new URLSearchParams({
        status,
        ...(carrierName && { carrier_name: carrierName }),
        ...(trackingNumber && { tracking_number: trackingNumber })
      });
      
      const res = await authFetch(
        `${API_URL}/api/admin/orders/${encodeURIComponent(orderId)}/status?${params}`,
        { method: 'PATCH' }
      );
      
      if (res.ok) {
        toast.success(`Order shipped! Tracking: ${trackingNumber}`);
        setShippingModalOrder(null);
        fetchOrders();
      } else {
        const errorData = await res.json().catch(() => ({}));
        toast.error(errorData.detail || 'Failed to update status');
      }
    } catch (error) {
      console.error('Error updating order status:', error);
      toast.error('Failed to update status');
    }
  };

  const generateRtoVoucher = async () => {
    if (!rtoVoucherModal) return;
    
    setGeneratingRtoVoucher(true);
    try {
      const res = await authFetch(
        `${API_URL}/api/admin/orders/${encodeURIComponent(rtoVoucherModal.orderNumber)}/generate-rto-voucher`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ percentage: rtoVoucherPercentage })
        }
      );
      
      if (res.ok) {
        const data = await res.json();
        toast.success(`RTO Voucher Generated: ${data.voucher_code} (₹${data.voucher_value})`, { duration: 8000 });
        setRtoVoucherModal(null);
        setRtoVoucherPercentage(100);
        fetchOrders();
      } else {
        const errorData = await res.json().catch(() => ({}));
        toast.error(errorData.detail || 'Failed to generate voucher');
      }
    } catch (error) {
      console.error('Error generating RTO voucher:', error);
      toast.error('Failed to generate voucher');
    } finally {
      setGeneratingRtoVoucher(false);
    }
  };

  const viewCartSnapshot = async (orderNumber) => {
    setLoadingCartSnapshot(true);
    try {
      const res = await authFetch(`${API_URL}/api/admin/orders/${encodeURIComponent(orderNumber)}/cart-snapshot`);
      if (res.ok) {
        const data = await res.json();
        setCartSnapshotModal(data);
      } else {
        toast.error('Failed to load cart snapshot');
      }
    } catch (error) {
      console.error('Error loading cart snapshot:', error);
      toast.error('Failed to load cart snapshot');
    } finally {
      setLoadingCartSnapshot(false);
    }
  };

  const syncToShiprocket = async (orderNumber) => {
    setSyncingOrderId(orderNumber);
    try {
      const res = await authFetch(
        `${API_URL}/api/admin/orders/${encodeURIComponent(orderNumber)}/sync-shiprocket`,
        { method: 'POST' }
      );
      
      if (res.ok) {
        const data = await res.json();
        toast.success(data.message);
        fetchOrders();
        fetchShiprocketStatus();
      } else {
        const errorData = await res.json().catch(() => ({}));
        toast.error(errorData.detail || 'Failed to sync to ShipRocket');
      }
    } catch (error) {
      console.error('Error syncing to ShipRocket:', error);
      toast.error('Failed to sync to ShipRocket');
    } finally {
      setSyncingOrderId(null);
    }
  };

  const deleteOrder = async (orderNumber) => {
    if (!window.confirm(`Are you sure you want to delete order ${orderNumber}?`)) return;
    
    try {
      const res = await authFetch(
        `${API_URL}/api/admin/orders/${encodeURIComponent(orderNumber)}?force=true`,
        { method: 'DELETE' }
      );
      
      if (res.ok) {
        toast.success('Order deleted');
        fetchOrders();
      } else {
        const errorData = await res.json().catch(() => ({}));
        toast.error(errorData.detail || 'Failed to delete order');
      }
    } catch (error) {
      console.error('Error deleting order:', error);
      toast.error('Failed to delete order');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      processing: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      shipped: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
      delivered: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      rto: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
      ready_for_pickup: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
      collected: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
    };
    return colors[status] || 'bg-slate-100 text-slate-800';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Orders</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Manage and track all orders ({filteredOrders.length} shown)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowRestoreForm(!showRestoreForm)}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RotateCcw size={18} />
            Restore Order
          </Button>
          <Button
            onClick={fetchOrders}
            variant="outline"
            className="flex items-center gap-2"
            disabled={loading}
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            Refresh
          </Button>
        </div>
      </div>

      {/* ShipRocket Status Bar */}
      {shiprocketStatus && (
        <div className={`rounded-lg p-3 flex items-center gap-3 ${
          shiprocketStatus.connected
            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
        }`}>
          <Truck size={20} className={shiprocketStatus.connected ? 'text-green-600' : 'text-red-600'} />
          <span className={`font-medium ${shiprocketStatus.connected ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
            ShipRocket: {shiprocketStatus.connected ? 'Connected' : 'Not Connected'}
          </span>
          {shiprocketStatus.connected && shiprocketStatus.stats && (
            <>
              <span className="text-slate-400">•</span>
              <span className="text-slate-600 dark:text-slate-400">
                {shiprocketStatus.stats.orders_synced} synced
              </span>
              {shiprocketStatus.stats.orders_pending_sync > 0 && (
                <>
                  <span className="text-slate-400">•</span>
                  <span className="text-orange-600 dark:text-orange-400">
                    {shiprocketStatus.stats.orders_pending_sync} pending
                  </span>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                type="text"
                placeholder="Search orders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="order-search"
              />
            </div>
          </div>
          
          {/* Date Range */}
          <select
            value={dateRangeFilter}
            onChange={(e) => setDateRangeFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
            data-testid="date-filter"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
          </select>
          
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
            data-testid="status-filter"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="processing">Processing</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="rto">RTO</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:text-slate-200">Order #</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:text-slate-200">Customer</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:text-slate-200">Date</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:text-slate-200">Total</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:text-slate-200">Payment</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:text-slate-200">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:text-slate-200">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center">
                    <RefreshCw className="animate-spin mx-auto text-slate-400" size={24} />
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                    No orders found
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const orderNumber = order.order_number || order.orderNumber;
                  const status = order.order_status || order.orderStatus;
                  const paymentStatus = order.payment_status || order.paymentStatus;
                  
                  return (
                    <tr key={orderNumber} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm font-medium text-slate-800 dark:text-white">
                          {orderNumber}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-slate-800 dark:text-white text-sm">
                            {order.shipping?.name || order.billing?.name || 'N/A'}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {order.shipping?.email || order.billing?.email || ''}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                        {formatDate(order.created_at || order.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-slate-800 dark:text-white">
                          {formatCurrency(order.pricing?.final_total || order.total)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          paymentStatus === 'paid' || paymentStatus === 'completed'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                        }`}>
                          {(paymentStatus || 'pending').toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
                            {(status || 'pending').toUpperCase()}
                          </span>
                          <select
                            value=""
                            onChange={(e) => handleStatusChange(orderNumber, e.target.value, order)}
                            className="text-xs px-2 py-1 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
                          >
                            <option value="">Change...</option>
                            <option value="pending">Pending</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="processing">Processing</option>
                            <option value="shipped">Shipped</option>
                            <option value="delivered">Delivered</option>
                            <option value="rto">RTO</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => viewCartSnapshot(orderNumber)}
                            className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
                            title="View Cart"
                          >
                            <Eye size={16} className="text-slate-500" />
                          </button>
                          
                          {/* RTO Voucher button */}
                          {status === 'rto' && !order.rto_voucher_generated && (
                            <button
                              onClick={() => setRtoVoucherModal({ orderNumber, total: order.pricing?.final_total || order.total })}
                              className="p-1.5 rounded hover:bg-orange-100 dark:hover:bg-orange-900/30 text-orange-600"
                              title="Generate RTO Voucher"
                            >
                              <AlertTriangle size={16} />
                            </button>
                          )}
                          
                          {/* Sync to ShipRocket */}
                          {!order.shiprocket_order_id && paymentStatus === 'paid' && (
                            <button
                              onClick={() => syncToShiprocket(orderNumber)}
                              disabled={syncingOrderId === orderNumber}
                              className="p-1.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600"
                              title="Sync to ShipRocket"
                            >
                              {syncingOrderId === orderNumber ? (
                                <Loader2 size={16} className="animate-spin" />
                              ) : (
                                <Truck size={16} />
                              )}
                            </button>
                          )}
                          
                          <button
                            onClick={() => deleteOrder(orderNumber)}
                            className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600"
                            title="Delete Order"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Status Change Confirmation Modal */}
      {statusChangeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">
              Confirm Status Change
            </h3>
            <p className="text-slate-600 dark:text-slate-300 mb-6">
              Are you sure you want to change the order status to <strong>{statusChangeModal.newStatus}</strong>?
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setStatusChangeModal(null)}>
                Cancel
              </Button>
              <Button
                onClick={confirmStatusChange}
                disabled={isUpdatingStatus}
                className="bg-slate-800 text-white"
              >
                {isUpdatingStatus ? <Loader2 className="animate-spin" size={18} /> : 'Confirm'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Shipping Details Modal */}
      {shippingModalOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">
              Shipping Details
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                updateOrderStatusWithShipping(
                  shippingModalOrder.orderId,
                  'shipped',
                  formData.get('carrier'),
                  formData.get('tracking')
                );
              }}
              className="space-y-4"
            >
              <div>
                <Label htmlFor="carrier">Carrier Name</Label>
                <Input id="carrier" name="carrier" placeholder="e.g., BlueDart, DTDC" required />
              </div>
              <div>
                <Label htmlFor="tracking">Tracking Number</Label>
                <Input id="tracking" name="tracking" placeholder="Enter tracking number" required />
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setShippingModalOrder(null)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-slate-800 text-white">
                  Mark as Shipped
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RTO Voucher Generation Modal */}
      {rtoVoucherModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">
              Generate RTO Voucher
            </h3>
            <p className="text-slate-600 dark:text-slate-300 mb-4">
              Order Total: <strong>{formatCurrency(rtoVoucherModal.total)}</strong>
            </p>
            <div className="mb-6">
              <Label htmlFor="percentage">Refund Percentage</Label>
              <select
                id="percentage"
                value={rtoVoucherPercentage}
                onChange={(e) => setRtoVoucherPercentage(Number(e.target.value))}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
              >
                <option value={50}>50% - ₹{Math.round(rtoVoucherModal.total * 0.5)}</option>
                <option value={60}>60% - ₹{Math.round(rtoVoucherModal.total * 0.6)}</option>
                <option value={70}>70% - ₹{Math.round(rtoVoucherModal.total * 0.7)}</option>
                <option value={80}>80% - ₹{Math.round(rtoVoucherModal.total * 0.8)}</option>
                <option value={90}>90% - ₹{Math.round(rtoVoucherModal.total * 0.9)}</option>
                <option value={100}>100% - ₹{rtoVoucherModal.total}</option>
              </select>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setRtoVoucherModal(null)}>
                Cancel
              </Button>
              <Button
                onClick={generateRtoVoucher}
                disabled={generatingRtoVoucher}
                className="bg-orange-600 text-white hover:bg-orange-700"
              >
                {generatingRtoVoucher ? <Loader2 className="animate-spin" size={18} /> : 'Generate Voucher'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Cart Snapshot Modal */}
      {cartSnapshotModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                Cart Snapshot - {cartSnapshotModal.order_number}
              </h3>
              <button
                onClick={() => setCartSnapshotModal(null)}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {cartSnapshotModal.cart_snapshot?.items_detail?.map((item, idx) => (
                <div key={idx} className="flex items-center gap-4 p-3 mb-2 rounded-lg bg-slate-50 dark:bg-slate-700/50">
                  <div className="flex-1">
                    <p className="font-medium text-slate-800 dark:text-white">{item.product_name}</p>
                    <p className="text-sm text-slate-500">{item.size} × {item.quantity}</p>
                  </div>
                  <p className="font-semibold">{formatCurrency(item.line_total)}</p>
                </div>
              ))}
              
              {cartSnapshotModal.cart_snapshot?.pricing_breakdown && (
                <div className="mt-4 p-4 bg-slate-100 dark:bg-slate-700 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(cartSnapshotModal.cart_snapshot.pricing_breakdown.subtotal)}</span>
                  </div>
                  {cartSnapshotModal.cart_snapshot.pricing_breakdown.coupon_discount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Discount:</span>
                      <span>-{formatCurrency(cartSnapshotModal.cart_snapshot.pricing_breakdown.coupon_discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span>Shipping:</span>
                    <span>{formatCurrency(cartSnapshotModal.cart_snapshot.pricing_breakdown.shipping_charge)}</span>
                  </div>
                  <div className="flex justify-between font-bold pt-2 border-t border-slate-300 dark:border-slate-600">
                    <span>Total:</span>
                    <span>{formatCurrency(cartSnapshotModal.cart_snapshot.pricing_breakdown.final_total)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminOrdersPage;
