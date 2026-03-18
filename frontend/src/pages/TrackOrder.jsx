import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Package, Truck, CheckCircle, Clock, ArrowLeft, Home, AlertTriangle, RefreshCw, ExternalLink, RotateCcw } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import SEO from '../components/SEO';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const TrackOrder = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, user, getUserOrders } = useAuth();
  
  // User's orders (for logged-in users)
  const [userOrders, setUserOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  
  // Selected/searched order
  const [selectedOrderNumber, setSelectedOrderNumber] = useState('');
  const [manualOrderNumber, setManualOrderNumber] = useState('');
  const [email, setEmail] = useState('');
  
  // Order details
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');

  // Scroll to top on page load
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Load user orders if authenticated
  useEffect(() => {
    const loadUserOrders = async () => {
      if (isAuthenticated) {
        setLoadingOrders(true);
        try {
          const orders = await getUserOrders();
          setUserOrders(orders || []);
        } catch (err) {
          console.error('Failed to load orders:', err);
        } finally {
          setLoadingOrders(false);
        }
      }
    };
    loadUserOrders();
  }, [isAuthenticated, getUserOrders]);

  // Auto-load order from URL query params
  useEffect(() => {
    const orderParam = searchParams.get('order');
    if (orderParam) {
      setSelectedOrderNumber(orderParam);
      setManualOrderNumber(orderParam);
      // Auto-fetch if authenticated
      if (isAuthenticated && user?.email) {
        fetchOrder(orderParam, user.email);
      }
    }
  }, [searchParams, isAuthenticated, user]);

  const fetchOrder = async (orderNum, emailAddr) => {
    if (!orderNum.trim()) {
      toast.error('Please select or enter an order number');
      return;
    }

    setLoading(true);
    setError('');
    setOrder(null);

    try {
      const response = await fetch(
        `${API_URL}/api/orders/track?order_number=${encodeURIComponent(orderNum)}&email=${encodeURIComponent(emailAddr || email)}`,
        { credentials: 'include' }
      );
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Order not found');
      }
      setOrder(data.order);
      toast.success('Order found!');
    } catch (err) {
      setError(err.message || 'Unable to find order. Please check your details.');
      toast.error(err.message || 'Order not found');
    } finally {
      setLoading(false);
    }
  };

  const handleTrackOrder = async (e) => {
    e.preventDefault();
    
    if (isAuthenticated) {
      // For logged-in users, use selected order
      if (!selectedOrderNumber) {
        toast.error('Please select an order from the dropdown');
        return;
      }
      await fetchOrder(selectedOrderNumber, user?.email);
    } else {
      // For guests, require both order number and email
      if (!manualOrderNumber.trim() || !email.trim()) {
        toast.error('Please enter both order number and email');
        return;
      }
      await fetchOrder(manualOrderNumber, email);
    }
  };

  const getStatusStep = (status, deliveryMode) => {
    // For self-pickup orders
    if (deliveryMode === 'self_pickup') {
      const pickupSteps = ['pending_pickup', 'ready_for_pickup', 'collected'];
      if (status === 'cancelled') return -1;
      return pickupSteps.indexOf(status);
    }
    
    // For shipping orders
    const steps = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];
    if (status === 'rto' || status === 'cancelled') {
      return -1; // Special handling
    }
    return steps.indexOf(status);
  };

  const statusIcons = {
    pending: Clock,
    confirmed: CheckCircle,
    processing: Package,
    shipped: Truck,
    delivered: CheckCircle,
    rto: RotateCcw,
    cancelled: AlertTriangle,
    // Self-pickup statuses
    pending_pickup: Clock,
    ready_for_pickup: Package,
    collected: CheckCircle
  };

  const statusLabels = {
    pending: 'Order Pending',
    confirmed: 'Order Confirmed',
    processing: 'Processing',
    shipped: 'Shipped',
    delivered: 'Delivered',
    rto: 'Return to Origin',
    cancelled: 'Cancelled',
    // Self-pickup statuses
    pending_pickup: 'Pending Store Confirmation',
    ready_for_pickup: 'Ready for Pickup',
    collected: 'Collected'
  };

  const statusColors = {
    pending: '#f59e0b',
    confirmed: '#22c55e',
    processing: '#3b82f6',
    shipped: '#8b5cf6',
    delivered: '#22c55e',
    rto: '#f97316',
    cancelled: '#ef4444',
    // Self-pickup statuses
    pending_pickup: '#f59e0b',
    ready_for_pickup: '#3b82f6',
    collected: '#22c55e'
  };

  // Format date helper - DDMMMYYYY format
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'N/A';
      const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      const day = String(date.getDate()).padStart(2, '0');
      const month = months[date.getMonth()];
      const year = date.getFullYear();
      return `${day}${month}${year}`;
    } catch {
      return 'N/A';
    }
  };

  // Get tracking URL based on carrier
  const getTrackingUrl = (carrier, trackingNumber) => {
    if (!carrier || !trackingNumber) return null;
    
    const carrierUrls = {
      // Standard Couriers
      'bluedart': `https://www.bluedart.com/tracking/${trackingNumber}`,
      'dtdc': `https://www.dtdc.in/tracking/tracking_results.asp?Ession_Id=&strconsession_id=&strAction=track&TrkType=awb&TrkVal1=${trackingNumber}`,
      'delhivery': `https://www.delhivery.com/track/package/${trackingNumber}`,
      'fedex': `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`,
      'ecom express': `https://ecomexpress.in/tracking/?awb_field=${trackingNumber}`,
      'xpressbees': `https://www.xpressbees.com/track?AwbNo=${trackingNumber}`,
      'shadowfax': `https://tracker.shadowfax.in/#/track/${trackingNumber}`,
      'india post': `https://www.indiapost.gov.in/_layouts/15/DOP.Portal.Tracking/TrackConsignment.aspx`,
      // Hyperlocal Delivery Partners
      'uber connect': `https://www.uber.com/in/en/`,
      'ola parcel': `https://www.olacabs.com/`,
      'rapido': `https://www.rapido.bike/`,
      'dunzo': `https://www.dunzo.com/`,
      'porter': `https://porter.in/track/${trackingNumber}`
    };
    
    const normalizedCarrier = carrier.toLowerCase().trim();
    for (const [key, url] of Object.entries(carrierUrls)) {
      if (normalizedCarrier.includes(key)) {
        return url;
      }
    }
    
    // Generic Google search fallback
    return `https://www.google.com/search?q=${encodeURIComponent(carrier + ' tracking ' + trackingNumber)}`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-slate-900">
      <SEO 
        title="Track Your Order | Addrika Premium Incense"
        description="Track your Addrika order status in real-time. Enter your order number to see shipping updates, estimated delivery, and tracking details."
        url="https://centraders.com/track-order"
        noIndex={true}
      />
      <Header />
      
      <main className="flex-1 pt-24 pb-16">
        <div className="max-w-3xl mx-auto px-4 py-8">
          {/* Back & Home buttons */}
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 hover:opacity-70 transition-opacity"
              style={{ color: 'var(--japanese-indigo)' }}
            >
              <ArrowLeft size={20} />
              <span>Back</span>
            </button>
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 hover:opacity-70 transition-opacity"
              style={{ color: 'var(--japanese-indigo)' }}
            >
              <Home size={20} />
              <span>Home</span>
            </button>
          </div>

          {/* Header */}
          <div className="text-center mb-8">
            <div 
              className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
              style={{ backgroundColor: 'var(--metallic-gold)' }}
            >
              <Package size={32} color="white" />
            </div>
            <h1 
              className="text-3xl font-bold mb-2"
              style={{ color: 'var(--japanese-indigo)' }}
            >
              Track Your Order
            </h1>
            <p style={{ color: 'var(--text-subtle)' }}>
              {isAuthenticated 
                ? 'Select your order from the dropdown to view its status'
                : 'Enter your order number and email to track your order status'
              }
            </p>
          </div>

          {/* Search Form */}
          <div 
            className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 mb-8"
            style={{ border: '1px solid var(--border)' }}
          >
            <form onSubmit={handleTrackOrder} className="space-y-4">
              {isAuthenticated ? (
                /* Logged-in User: Order Dropdown */
                <div>
                  <Label htmlFor="orderSelect">Select Your Order</Label>
                  {loadingOrders ? (
                    <div className="flex items-center justify-center py-4">
                      <RefreshCw className="animate-spin mr-2" size={20} />
                      <span>Loading your orders...</span>
                    </div>
                  ) : userOrders.length > 0 ? (
                    <select
                      id="orderSelect"
                      value={selectedOrderNumber}
                      onChange={(e) => setSelectedOrderNumber(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border mt-1"
                      style={{ borderColor: 'var(--border)' }}
                      data-testid="track-order-dropdown"
                    >
                      <option value="">-- Select an order --</option>
                      {userOrders.map((o) => {
                        const orderNum = o.orderNumber || o.order_number;
                        const dateStr = o.createdAt || o.created_at;
                        const status = o.orderStatus || o.order_status || 'pending';
                        return (
                          <option key={orderNum} value={orderNum}>
                            {orderNum} - {formatDate(dateStr)} - {statusLabels[status] || status}
                          </option>
                        );
                      })}
                    </select>
                  ) : (
                    <div className="text-center py-4 bg-gray-50 rounded-lg">
                      <Package size={32} className="mx-auto mb-2 opacity-30" />
                      <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>
                        No orders found. <a href="/" className="underline" style={{ color: 'var(--japanese-indigo)' }}>Start shopping</a>
                      </p>
                    </div>
                  )}
                  
                  {/* Manual entry option for logged-in users too */}
                  <p className="text-xs mt-2" style={{ color: 'var(--text-subtle)' }}>
                    Or enter order number manually:
                  </p>
                  <Input
                    value={manualOrderNumber}
                    onChange={(e) => {
                      setManualOrderNumber(e.target.value);
                      setSelectedOrderNumber(e.target.value);
                    }}
                    placeholder="e.g., ADD-18FEB2026..."
                    className="mt-1"
                    data-testid="track-order-manual-input"
                  />
                </div>
              ) : (
                /* Guest User: Manual Entry */
                <>
                  <div>
                    <Label htmlFor="orderNumber">Order Number</Label>
                    <Input
                      id="orderNumber"
                      value={manualOrderNumber}
                      onChange={(e) => setManualOrderNumber(e.target.value)}
                      placeholder="e.g., ADD-18FEB2026..."
                      data-testid="track-order-number-input"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email used during checkout"
                      data-testid="track-email-input"
                    />
                  </div>
                </>
              )}

              {error && (
                <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={loading || (isAuthenticated && userOrders.length === 0 && !manualOrderNumber)}
                className="w-full text-white font-semibold"
                style={{ backgroundColor: 'var(--japanese-indigo)' }}
                data-testid="track-order-button"
              >
                {loading ? (
                  <>
                    <Search className="mr-2 h-4 w-4 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Track Order
                  </>
                )}
              </Button>
              
              {!isAuthenticated && (
                <p className="text-xs text-center" style={{ color: 'var(--text-subtle)' }}>
                  <a 
                    href="/login" 
                    className="underline font-semibold"
                    style={{ color: 'var(--japanese-indigo)' }}
                  >
                    Sign in
                  </a> to quickly access all your orders
                </p>
              )}
            </form>
          </div>

          {/* Order Details */}
          {order && (
            <div 
              className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6"
              style={{ border: '1px solid var(--border)' }}
              data-testid="order-details"
            >
              <h2 className="text-xl font-bold mb-6" style={{ color: 'var(--japanese-indigo)' }}>
                Order Details
              </h2>

              {/* Order Info */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-sm text-gray-500">Order Number</p>
                  <p className="font-semibold">{order.orderNumber || order.order_number}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Order Date</p>
                  <p className="font-semibold">
                    {formatDate(order.createdAt || order.created_at)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Payment Method</p>
                  <p className="font-semibold">
                    {order.paymentMode || (order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online Payment')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Payment Status</p>
                  <p className={`font-semibold ${(order.paymentStatus || order.payment_status) === 'paid' ? 'text-green-600' : 'text-yellow-600'}`}>
                    {(order.paymentStatus || order.payment_status) === 'paid' ? 'Paid' : 'Pending'}
                  </p>
                </div>
              </div>

              {/* Order Status Timeline OR Special Status */}
              <div className="mb-6">
                <h3 className="font-semibold mb-4" style={{ color: 'var(--japanese-indigo)' }}>
                  Order Status
                </h3>
                
                {/* Special status: RTO or Cancelled */}
                {((order.orderStatus || order.order_status) === 'rto' || (order.orderStatus || order.order_status) === 'cancelled') ? (
                  <div 
                    className="p-4 rounded-lg text-center"
                    style={{ 
                      backgroundColor: statusColors[(order.orderStatus || order.order_status)] + '15',
                      borderColor: statusColors[(order.orderStatus || order.order_status)],
                      border: '1px solid'
                    }}
                  >
                    {React.createElement(statusIcons[(order.orderStatus || order.order_status)], {
                      size: 48,
                      color: statusColors[(order.orderStatus || order.order_status)],
                      className: 'mx-auto mb-2'
                    })}
                    <p 
                      className="text-lg font-bold"
                      style={{ color: statusColors[(order.orderStatus || order.order_status)] }}
                    >
                      {statusLabels[(order.orderStatus || order.order_status)]}
                    </p>
                    {(order.orderStatus || order.order_status) === 'rto' && (
                      <p className="text-sm mt-2 text-gray-600">
                        Your order is being returned to us. A voucher will be issued within 7 days of receipt.
                      </p>
                    )}
                  </div>
                ) : order.delivery_mode === 'self_pickup' ? (
                  /* Self-pickup status timeline */
                  <div className="flex items-center justify-between">
                    {['pending_pickup', 'ready_for_pickup', 'collected'].map((status, index) => {
                      const currentStep = getStatusStep(order.orderStatus || order.order_status, 'self_pickup');
                      const isActive = index <= currentStep;
                      const isCurrent = index === currentStep;
                      const StatusIcon = statusIcons[status];
                      
                      return (
                        <div key={status} className="flex flex-col items-center relative flex-1">
                          {index > 0 && (
                            <div 
                              className="absolute right-1/2 top-5 h-0.5"
                              style={{ 
                                backgroundColor: index <= currentStep ? 'var(--metallic-gold)' : '#e5e7eb',
                                width: '100%',
                                left: '-50%'
                              }}
                            />
                          )}
                          <div 
                            className={`w-10 h-10 rounded-full flex items-center justify-center z-10 ${
                              isCurrent ? 'ring-4 ring-opacity-30' : ''
                            }`}
                            style={{ 
                              backgroundColor: isActive ? 'var(--metallic-gold)' : '#e5e7eb',
                              ringColor: isCurrent ? 'var(--metallic-gold)' : 'transparent'
                            }}
                          >
                            <StatusIcon size={20} color={isActive ? 'white' : '#9ca3af'} />
                          </div>
                          <p className={`text-xs mt-2 text-center ${isActive ? 'font-semibold' : 'text-gray-400'}`}>
                            {statusLabels[status]}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Normal status timeline */
                  <div className="flex items-center justify-between">
                    {['pending', 'confirmed', 'processing', 'shipped', 'delivered'].map((status, index) => {
                      const currentStep = getStatusStep(order.orderStatus || order.order_status, order.delivery_mode);
                      const isActive = index <= currentStep;
                      const isCurrent = index === currentStep;
                      const StatusIcon = statusIcons[status];
                      
                      return (
                        <div key={status} className="flex flex-col items-center relative flex-1">
                          {index > 0 && (
                            <div 
                              className="absolute right-1/2 top-5 h-0.5"
                              style={{ 
                                backgroundColor: index <= currentStep ? 'var(--metallic-gold)' : '#e5e7eb',
                                width: '100%',
                                left: '-50%'
                              }}
                            />
                          )}
                          <div 
                            className={`w-10 h-10 rounded-full flex items-center justify-center z-10 ${
                              isCurrent ? 'ring-4 ring-opacity-30' : ''
                            }`}
                            style={{ 
                              backgroundColor: isActive ? 'var(--metallic-gold)' : '#e5e7eb',
                              ringColor: isCurrent ? 'var(--metallic-gold)' : 'transparent'
                            }}
                          >
                            <StatusIcon size={20} color={isActive ? 'white' : '#9ca3af'} />
                          </div>
                          <p className={`text-xs mt-2 text-center ${isActive ? 'font-semibold' : 'text-gray-400'}`}>
                            {statusLabels[status]}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Self-Pickup Information */}
              {order.delivery_mode === 'self_pickup' && order.pickup_store && (
                <div 
                  className="mb-6 p-4 rounded-lg"
                  style={{ backgroundColor: '#dcfce7', border: '1px solid #86efac' }}
                >
                  <h3 className="font-semibold mb-3 flex items-center gap-2 text-green-800">
                    <MapPin size={20} />
                    Pickup Information
                  </h3>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Store:</span>
                      <span className="font-semibold">{order.pickup_store.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Address:</span>
                      <span className="text-right">{order.pickup_store.address}, {order.pickup_store.city}</span>
                    </div>
                    {order.pickup_time_slot && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Time Slot:</span>
                        <span className="font-semibold text-amber-600">{order.pickup_time_slot}</span>
                      </div>
                    )}
                    {order.balance_at_store > 0 && (
                      <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                        <p className="text-sm text-amber-700">
                          <strong>Payment at Pickup:</strong> ₹{order.balance_at_store}
                        </p>
                        <p className="text-xs text-amber-600 mt-1">
                          You have prepaid ₹{order.amount_charged}. Pay no more than ₹{order.balance_at_store} at store.
                        </p>
                      </div>
                    )}
                    {order.collected_at && (
                      <div className="flex justify-between text-green-700">
                        <span>Collected On:</span>
                        <span className="font-semibold">{formatDate(order.collected_at)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Real-time Shipping Updates */}
              {(order.shippingDetails || order.shipping_details) && (
                <div 
                  className="mb-6 p-4 rounded-lg"
                  style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe' }}
                >
                  <h3 className="font-semibold mb-3 flex items-center gap-2 text-blue-800">
                    <Truck size={20} />
                    Shipping Information
                  </h3>
                  
                  <div className="space-y-2">
                    {(order.shippingDetails?.carrier_name || order.shipping_details?.carrier_name) && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Carrier:</span>
                        <span className="font-semibold">
                          {order.shippingDetails?.carrier_name || order.shipping_details?.carrier_name}
                        </span>
                      </div>
                    )}
                    
                    {(order.shippingDetails?.tracking_number || order.shipping_details?.tracking_number) && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Tracking Number:</span>
                        <span className="font-mono font-semibold">
                          {order.shippingDetails?.tracking_number || order.shipping_details?.tracking_number}
                        </span>
                      </div>
                    )}
                    
                    {(order.shippingDetails?.shipped_at || order.shipping_details?.shipped_at) && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Shipped On:</span>
                        <span className="font-semibold">
                          {formatDate(order.shippingDetails?.shipped_at || order.shipping_details?.shipped_at)}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {/* Track with Carrier Button */}
                  {(order.shippingDetails?.carrier_name || order.shipping_details?.carrier_name) && 
                   (order.shippingDetails?.tracking_number || order.shipping_details?.tracking_number) && (
                    <a
                      href={getTrackingUrl(
                        order.shippingDetails?.carrier_name || order.shipping_details?.carrier_name,
                        order.shippingDetails?.tracking_number || order.shipping_details?.tracking_number
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-white font-semibold transition-transform hover:scale-[1.02]"
                      style={{ backgroundColor: '#3b82f6' }}
                      data-testid="track-with-carrier-btn"
                    >
                      <ExternalLink size={18} />
                      Track with {order.shippingDetails?.carrier_name || order.shipping_details?.carrier_name}
                    </a>
                  )}
                </div>
              )}

              {/* RTO Voucher Info (if applicable) */}
              {order.rto_voucher_code && (
                <div 
                  className="mb-6 p-4 rounded-lg"
                  style={{ backgroundColor: '#fef3cd', border: '1px solid #ffc107' }}
                >
                  <h3 className="font-semibold mb-2 text-yellow-800">
                    RTO Voucher Generated
                  </h3>
                  <p className="text-sm text-yellow-700 mb-2">
                    A voucher has been generated for your returned order:
                  </p>
                  <div className="bg-white p-3 rounded text-center">
                    <p className="text-xs text-gray-500">VOUCHER CODE</p>
                    <p className="text-xl font-bold tracking-wider" style={{ color: 'var(--japanese-indigo)' }}>
                      {order.rto_voucher_code}
                    </p>
                  </div>
                  <p className="text-xs text-yellow-700 mt-2">
                    Valid for 15 days. Use at checkout on your next order.
                  </p>
                </div>
              )}

              {/* Items */}
              <div className="mb-6">
                <h3 className="font-semibold mb-4" style={{ color: 'var(--japanese-indigo)' }}>
                  Items Ordered
                </h3>
                <div className="space-y-3">
                  {(order.items || []).map((item, index) => (
                    <div key={index} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                      {item.image && (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-12 h-12 object-cover rounded"
                        />
                      )}
                      <div className="flex-1">
                        <p className="font-semibold">{item.name}</p>
                        <p className="text-sm text-gray-500">{item.size} × {item.quantity}</p>
                      </div>
                      <p className="font-semibold" style={{ color: 'var(--metallic-gold)' }}>
                        ₹{((item.price || 0) * (item.quantity || 1)).toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Shipping Address */}
              <div className="mb-6">
                <h3 className="font-semibold mb-2" style={{ color: 'var(--japanese-indigo)' }}>
                  Shipping Address
                </h3>
                <p className="text-gray-700">
                  {order.shipping?.name}<br />
                  {order.shipping?.address}<br />
                  {order.shipping?.landmark && <>{order.shipping.landmark}<br /></>}
                  {order.shipping?.city}, {order.shipping?.state} {order.shipping?.pincode}<br />
                  Phone: {order.shipping?.phone}
                </p>
              </div>

              {/* Total */}
              <div className="border-t pt-4">
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span style={{ color: 'var(--metallic-gold)' }}>
                    ₹{(order.total || order.pricing?.final_total || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Help Section */}
          <div className="mt-8 text-center">
            <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>
              Can't find your order? Contact us at{' '}
              <a 
                href="mailto:contact.us@centraders.com" 
                className="font-semibold hover:underline"
                style={{ color: 'var(--japanese-indigo)' }}
              >
                contact.us@centraders.com
              </a>
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default TrackOrder;
