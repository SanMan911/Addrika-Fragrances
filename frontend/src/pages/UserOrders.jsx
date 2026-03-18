import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Package, ArrowLeft, Trash2, Eye, Clock, CheckCircle, XCircle, Truck, AlertTriangle, Loader2 } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const statusIcons = {
  pending: Clock,
  confirmed: CheckCircle,
  processing: Package,
  shipped: Truck,
  delivered: CheckCircle,
  cancelled: XCircle
};

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-blue-100 text-blue-700',
  processing: 'bg-purple-100 text-purple-700',
  shipped: 'bg-indigo-100 text-indigo-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700'
};

const UserOrders = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clearingHistory, setClearingHistory] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login?redirect=/orders');
      return;
    }

    const fetchOrders = async () => {
      try {
        const sessionToken = localStorage.getItem('addrika_session_token');
        const response = await fetch(`${API_URL}/api/user/orders`, {
          credentials: 'include',
          headers: sessionToken ? { 'Authorization': `Bearer ${sessionToken}` } : {}
        });

        if (response.ok) {
          const data = await response.json();
          setOrders(data.orders || []);
        }
      } catch (error) {
        console.error('Failed to fetch orders:', error);
        toast.error('Failed to load orders');
      } finally {
        setLoading(false);
      }
    };

    if (isAuthenticated) {
      fetchOrders();
    }
  }, [isAuthenticated, authLoading, navigate]);

  const handleClearHistory = async () => {
    setClearingHistory(true);
    try {
      const sessionToken = localStorage.getItem('addrika_session_token');
      const response = await fetch(`${API_URL}/api/user/orders/history`, {
        method: 'DELETE',
        credentials: 'include',
        headers: sessionToken ? { 'Authorization': `Bearer ${sessionToken}` } : {}
      });

      if (response.ok) {
        setOrders([]);
        setShowClearConfirm(false);
        toast.success('Order history cleared');
      } else {
        toast.error('Failed to clear order history');
      }
    } catch (error) {
      toast.error('Failed to clear order history');
    } finally {
      setClearingHistory(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 pt-24 pb-16 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--metallic-gold)' }} />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 pt-24 pb-16" style={{ backgroundColor: 'var(--cream)' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => navigate(-1)}
                className="p-2"
              >
                <ArrowLeft size={24} />
              </Button>
              <div>
                <h1 className="text-2xl font-bold" style={{ color: 'var(--japanese-indigo)' }}>
                  My Orders
                </h1>
                <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>
                  {orders.length} order{orders.length !== 1 ? 's' : ''} found
                </p>
              </div>
            </div>
            
            {orders.length > 0 && (
              <Button
                variant="outline"
                onClick={() => setShowClearConfirm(true)}
                className="text-red-500 border-red-300 hover:bg-red-50"
              >
                <Trash2 size={16} className="mr-2" />
                Clear History
              </Button>
            )}
          </div>

          {/* Clear Confirmation Modal */}
          {showClearConfirm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg p-6 max-w-md w-full">
                <div className="flex items-center gap-3 mb-4">
                  <AlertTriangle size={24} className="text-yellow-500" />
                  <h3 className="text-lg font-bold">Clear Order History?</h3>
                </div>
                <p className="text-gray-600 mb-6">
                  This will hide all your orders from this view. You won't be able to see them here anymore, 
                  but the orders will still exist in our system for support purposes.
                </p>
                <div className="flex gap-3 justify-end">
                  <Button variant="outline" onClick={() => setShowClearConfirm(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleClearHistory}
                    disabled={clearingHistory}
                    className="bg-red-500 text-white hover:bg-red-600"
                  >
                    {clearingHistory ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Trash2 size={16} className="mr-2" />
                    )}
                    Clear History
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Orders List */}
          {orders.length === 0 ? (
            <div className="bg-white rounded-lg shadow-lg p-8 text-center">
              <Package size={64} className="mx-auto mb-4" style={{ color: 'var(--text-subtle)' }} />
              <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--japanese-indigo)' }}>
                No orders yet
              </h2>
              <p className="mb-6" style={{ color: 'var(--text-subtle)' }}>
                Start shopping to see your orders here!
              </p>
              <Link to="/#fragrances">
                <Button 
                  className="text-white"
                  style={{ backgroundColor: 'var(--japanese-indigo)' }}
                >
                  Browse Products
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => {
                const StatusIcon = statusIcons[order.status] || Clock;
                const statusColor = statusColors[order.status] || 'bg-gray-100 text-gray-700';
                
                return (
                  <div 
                    key={order.order_number}
                    className="bg-white rounded-lg shadow-lg overflow-hidden"
                    style={{ border: '1px solid var(--border)' }}
                  >
                    {/* Order Header */}
                    <div className="p-4 border-b flex items-center justify-between" style={{ backgroundColor: 'var(--cream)' }}>
                      <div>
                        <p className="font-mono font-bold" style={{ color: 'var(--metallic-gold)' }}>
                          {order.order_number}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                          {formatDate(order.created_at || order.createdAt)}
                        </p>
                      </div>
                      <span className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full ${statusColor}`}>
                        <StatusIcon size={14} />
                        {order.status?.charAt(0).toUpperCase() + order.status?.slice(1)}
                      </span>
                    </div>

                    {/* Order Items */}
                    <div className="p-4">
                      <div className="space-y-3 mb-4">
                        {(order.items || []).slice(0, 3).map((item, idx) => (
                          <div key={idx} className="flex items-center gap-3">
                            <div 
                              className="w-12 h-12 rounded-lg flex items-center justify-center"
                              style={{ backgroundColor: 'var(--cream)' }}
                            >
                              <Package size={20} style={{ color: 'var(--metallic-gold)' }} />
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-sm">{item.name}</p>
                              <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                                {item.size} × {item.quantity}
                              </p>
                            </div>
                            <p className="font-semibold text-sm">₹{(item.price * item.quantity).toFixed(2)}</p>
                          </div>
                        ))}
                        {(order.items || []).length > 3 && (
                          <p className="text-xs text-center" style={{ color: 'var(--text-subtle)' }}>
                            + {order.items.length - 3} more item(s)
                          </p>
                        )}
                      </div>

                      {/* Order Footer */}
                      <div className="flex items-center justify-between pt-4 border-t">
                        <div>
                          <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>Total</p>
                          <p className="text-lg font-bold" style={{ color: 'var(--japanese-indigo)' }}>
                            ₹{(order.total || order.finalTotal || 0).toFixed(2)}
                          </p>
                        </div>
                        <Link to={`/track-order?order=${order.order_number}`}>
                          <Button
                            variant="outline"
                            size="sm"
                            style={{ borderColor: 'var(--metallic-gold)', color: 'var(--metallic-gold)' }}
                          >
                            <Eye size={16} className="mr-2" />
                            Track Order
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default UserOrders;
