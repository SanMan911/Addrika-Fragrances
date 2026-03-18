/**
 * Retailer Orders Page - View and manage assigned orders
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { 
  Package, ArrowLeft, Search, Filter, Eye, CheckCircle,
  Clock, Truck, MapPin, Phone, Mail, RefreshCw
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { useRetailerAuth } from '../../context/RetailerAuthContext';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const statusColors = {
  pending: { bg: '#FEF3C7', text: '#D97706' },
  confirmed: { bg: '#DBEAFE', text: '#2563EB' },
  processing: { bg: '#E0E7FF', text: '#4F46E5' },
  ready_for_pickup: { bg: '#D1FAE5', text: '#059669' },
  shipped: { bg: '#CFFAFE', text: '#0891B2' },
  delivered: { bg: '#D1FAE5', text: '#059669' },
  cancelled: { bg: '#FEE2E2', text: '#DC2626' }
};

const RetailerOrders = () => {
  const [orders, setOrders] = useState([]);
  const [statusCounts, setStatusCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [updating, setUpdating] = useState(false);
  
  const { fetchWithAuth } = useRetailerAuth();

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      let url = `${API_URL}/api/retailer-dashboard/orders?limit=50`;
      if (activeStatus) url += `&status=${activeStatus}`;
      
      const response = await fetchWithAuth(url);
      if (response.ok) {
        const data = await response.json();
        setOrders(data.orders || []);
        setStatusCounts(data.status_counts || {});
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [activeStatus, fetchWithAuth]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const updateOrderStatus = async (orderNumber, newStatus) => {
    setUpdating(true);
    try {
      const response = await fetchWithAuth(
        `${API_URL}/api/retailer-dashboard/orders/${orderNumber}/status`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus })
        }
      );

      if (response.ok) {
        toast.success(`Order marked as ${newStatus.replace('_', ' ')}`);
        fetchOrders();
        setSelectedOrder(null);
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to update order');
      }
    } catch (error) {
      toast.error('Failed to update order');
    } finally {
      setUpdating(false);
    }
  };

  const filteredOrders = orders.filter(order => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      order.order_number?.toLowerCase().includes(query) ||
      order.shipping?.name?.toLowerCase().includes(query) ||
      order.shipping?.phone?.includes(query)
    );
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'N/A';
    }
  };

  const StatusBadge = ({ status }) => {
    const colors = statusColors[status] || { bg: '#E5E7EB', text: '#6B7280' };
    return (
      <span 
        className="px-2 py-1 text-xs font-medium rounded-full capitalize"
        style={{ backgroundColor: colors.bg, color: colors.text }}
      >
        {status?.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f5f5f5' }}>
      {/* Header */}
      <header 
        className="sticky top-0 z-30 px-4 py-4"
        style={{ backgroundColor: 'white', borderBottom: '1px solid var(--border)' }}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/retailer/dashboard" className="p-2 rounded-lg hover:bg-gray-100">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-xl font-bold" style={{ color: 'var(--japanese-indigo)' }}>
              Orders
            </h1>
          </div>
          <Button variant="outline" onClick={fetchOrders} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4">
        {/* Status Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setActiveStatus(null)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              !activeStatus ? 'bg-gray-900 text-white' : 'bg-white hover:bg-gray-50'
            }`}
          >
            All ({Object.values(statusCounts).reduce((a, b) => a + b, 0)})
          </button>
          {Object.entries(statusCounts).map(([status, count]) => (
            <button
              key={status}
              onClick={() => setActiveStatus(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                activeStatus === status ? 'bg-gray-900 text-white' : 'bg-white hover:bg-gray-50'
              }`}
            >
              {status.replace('_', ' ')} ({count})
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            placeholder="Search by order number, customer name or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-white"
          />
        </div>

        {/* Orders List */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 bg-white rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl">
            <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p style={{ color: 'var(--text-subtle)' }}>No orders found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((order) => (
              <div
                key={order.order_number}
                className="bg-white rounded-xl p-4 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedOrder(order)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-semibold" style={{ color: 'var(--japanese-indigo)' }}>
                      #{order.order_number}
                    </div>
                    <div className="text-sm" style={{ color: 'var(--text-subtle)' }}>
                      {formatDate(order.created_at)}
                    </div>
                  </div>
                  <StatusBadge status={order.order_status} />
                </div>

                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span>{order.shipping?.city}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Package className="w-4 h-4 text-gray-400" />
                    <span>{order.items?.length} items</span>
                  </div>
                  <div className="font-medium" style={{ color: 'var(--metallic-gold)' }}>
                    ₹{order.total?.toLocaleString()}
                  </div>
                </div>

                {order.delivery_mode === 'self_pickup' && (
                  <div 
                    className="mt-2 px-2 py-1 text-xs rounded inline-block"
                    style={{ backgroundColor: '#DBEAFE', color: '#2563EB' }}
                  >
                    Store Pickup
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div 
            className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b sticky top-0 bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold" style={{ color: 'var(--japanese-indigo)' }}>
                    Order #{selectedOrder.order_number}
                  </h2>
                  <div className="text-sm" style={{ color: 'var(--text-subtle)' }}>
                    {formatDate(selectedOrder.created_at)}
                  </div>
                </div>
                <button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <ArrowLeft className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Status */}
              <div>
                <div className="text-sm font-medium mb-2">Status</div>
                <StatusBadge status={selectedOrder.order_status} />
              </div>

              {/* Customer Info */}
              <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--cream)' }}>
                <div className="text-sm font-medium mb-3">Customer Details</div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{selectedOrder.shipping?.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <a href={`tel:${selectedOrder.shipping?.phone}`} className="hover:underline">
                      {selectedOrder.shipping?.phone}
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span>{selectedOrder.shipping?.email}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-gray-400 mt-1" />
                    <span>
                      {selectedOrder.shipping?.address}, {selectedOrder.shipping?.city}, {selectedOrder.shipping?.state} - {selectedOrder.shipping?.pincode}
                    </span>
                  </div>
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="text-sm font-medium mb-3">Order Items</div>
                <div className="space-y-2">
                  {selectedOrder.items?.map((item, idx) => (
                    <div 
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-lg"
                      style={{ backgroundColor: 'var(--cream)' }}
                    >
                      <div>
                        <div className="font-medium">{item.name}</div>
                        <div className="text-sm" style={{ color: 'var(--text-subtle)' }}>
                          {item.size} × {item.quantity}
                        </div>
                      </div>
                      <div className="font-medium">₹{(item.price * item.quantity).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div className="flex items-center justify-between text-lg font-bold pt-4 border-t">
                <span>Total</span>
                <span style={{ color: 'var(--metallic-gold)' }}>₹{selectedOrder.total?.toLocaleString()}</span>
              </div>

              {/* Actions */}
              {selectedOrder.order_status !== 'delivered' && selectedOrder.order_status !== 'cancelled' && (
                <div className="pt-4 border-t">
                  <div className="text-sm font-medium mb-3">Update Status</div>
                  <div className="flex flex-wrap gap-2">
                    {selectedOrder.order_status === 'pending' && (
                      <Button
                        onClick={() => updateOrderStatus(selectedOrder.order_number, 'confirmed')}
                        disabled={updating}
                        style={{ backgroundColor: 'var(--japanese-indigo)' }}
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Confirm Order
                      </Button>
                    )}
                    {selectedOrder.order_status === 'confirmed' && (
                      <Button
                        onClick={() => updateOrderStatus(selectedOrder.order_number, 'processing')}
                        disabled={updating}
                        style={{ backgroundColor: 'var(--japanese-indigo)' }}
                      >
                        <Clock className="w-4 h-4 mr-2" />
                        Start Processing
                      </Button>
                    )}
                    {selectedOrder.delivery_mode === 'self_pickup' && selectedOrder.order_status === 'processing' && (
                      <Button
                        onClick={() => updateOrderStatus(selectedOrder.order_number, 'ready_for_pickup')}
                        disabled={updating}
                        style={{ backgroundColor: 'var(--japanese-indigo)' }}
                      >
                        <Package className="w-4 h-4 mr-2" />
                        Ready for Pickup
                      </Button>
                    )}
                    {(selectedOrder.order_status === 'ready_for_pickup' || 
                      (selectedOrder.delivery_mode !== 'self_pickup' && selectedOrder.order_status === 'shipped')) && (
                      <Button
                        onClick={() => updateOrderStatus(selectedOrder.order_number, 'delivered')}
                        disabled={updating}
                        style={{ backgroundColor: '#059669' }}
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Mark Delivered
                      </Button>
                    )}
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

export default RetailerOrders;
