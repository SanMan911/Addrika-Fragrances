import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  CheckCircle, Package, Truck, Mail, Phone, MapPin, 
  ArrowRight, Home, ShoppingBag, Star, Heart, Share2, Copy
} from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const ThankYou = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderNumber = searchParams.get('order');
  
  const [orderDetails, setOrderDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    
    // Try to get order from session storage first (for immediate redirect after payment)
    const storedOrder = sessionStorage.getItem('lastOrder');
    if (storedOrder) {
      try {
        const parsed = JSON.parse(storedOrder);
        setOrderDetails(parsed);
        setLoading(false);
        // Clear after reading
        sessionStorage.removeItem('lastOrder');
        return;
      } catch (e) {
        console.error('Error parsing stored order:', e);
      }
    }
    
    // Fallback: fetch order details from API if order number provided
    if (orderNumber) {
      fetchOrderDetails();
    } else {
      setLoading(false);
    }
  }, [orderNumber]);

  const fetchOrderDetails = async () => {
    try {
      const response = await fetch(`${API_URL}/api/orders/track/${orderNumber}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setOrderDetails(data.order);
      } else {
        setError('Order not found');
      }
    } catch (err) {
      console.error('Error fetching order:', err);
      setError('Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  const copyOrderNumber = () => {
    if (orderDetails?.orderNumber || orderDetails?.order_number) {
      navigator.clipboard.writeText(orderDetails.orderNumber || orderDetails.order_number);
      toast.success('Order number copied!');
    }
  };

  const shareOrder = async () => {
    const orderNum = orderDetails?.orderNumber || orderDetails?.order_number;
    const shareData = {
      title: 'My Addrika Order',
      text: `I just ordered premium incense from Addrika! Order: ${orderNum}`,
      url: window.location.href
    };
    
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.log('Share cancelled');
      }
    } else {
      copyOrderNumber();
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 pt-24 pb-16 flex items-center justify-center">
          <div className="animate-pulse text-center">
            <div className="w-20 h-20 rounded-full bg-slate-200 mx-auto mb-4" />
            <div className="h-8 w-48 bg-slate-200 mx-auto rounded" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // No order found
  if (!orderDetails && !loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 pt-24 pb-16">
          <div className="max-w-2xl mx-auto px-4 py-12 text-center">
            <div 
              className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center bg-slate-100"
            >
              <Package size={40} className="text-slate-400" />
            </div>
            <h1 className="text-2xl font-bold mb-4 text-slate-700">
              No Order Information
            </h1>
            <p className="text-slate-500 mb-8">
              We couldn't find any order details. If you've just made a purchase, 
              please check your email for confirmation.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                onClick={() => navigate('/track-order')}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Package size={18} />
                Track Your Order
              </Button>
              <Button
                onClick={() => navigate('/')}
                className="flex items-center gap-2 text-white"
                style={{ backgroundColor: 'var(--japanese-indigo)' }}
              >
                <Home size={18} />
                Go Home
              </Button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const orderNum = orderDetails?.orderNumber || orderDetails?.order_number;
  const shipping = orderDetails?.shipping || {};
  const pricing = orderDetails?.pricing || {};
  const items = orderDetails?.items || [];
  const paymentStatus = orderDetails?.paymentStatus || orderDetails?.payment_status || 'pending';
  const isPaid = ['paid', 'captured', 'completed'].includes(paymentStatus);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-green-50 to-white dark:from-slate-900 dark:to-slate-800">
      <Header />
      
      <main className="flex-1 pt-24 pb-16">
        <div className="max-w-3xl mx-auto px-4 py-8">
          {/* Success Animation Header */}
          <div className="text-center mb-10">
            <div className="relative inline-block">
              <div 
                className="w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center animate-bounce-slow"
                style={{ 
                  backgroundColor: 'var(--metallic-gold)',
                  boxShadow: '0 0 40px rgba(193, 154, 107, 0.4)'
                }}
              >
                <CheckCircle size={56} color="white" />
              </div>
              {/* Confetti effect circles */}
              <div className="absolute -top-2 -left-2 w-4 h-4 rounded-full bg-green-400 animate-ping" />
              <div className="absolute -top-1 -right-3 w-3 h-3 rounded-full bg-yellow-400 animate-ping delay-100" />
              <div className="absolute -bottom-1 -left-3 w-3 h-3 rounded-full bg-blue-400 animate-ping delay-200" />
            </div>
            
            <h1 
              className="text-3xl sm:text-4xl font-bold mb-3 font-serif"
              style={{ color: 'var(--japanese-indigo)' }}
            >
              Thank You for Your Order!
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-300 mb-2">
              Your order has been {isPaid ? 'confirmed' : 'placed'} successfully
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              A confirmation email has been sent to <strong>{shipping.email}</strong>
            </p>
          </div>

          {/* Order Number Card */}
          <div 
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 mb-6 text-center"
            style={{ border: '2px solid var(--metallic-gold)' }}
          >
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Order Number</p>
            <div className="flex items-center justify-center gap-3">
              <span 
                className="text-2xl sm:text-3xl font-bold font-mono tracking-wider"
                style={{ color: 'var(--japanese-indigo)' }}
              >
                {orderNum}
              </span>
              <button
                onClick={copyOrderNumber}
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                title="Copy order number"
              >
                <Copy size={20} className="text-slate-400" />
              </button>
            </div>
            <div className="flex items-center justify-center gap-4 mt-4">
              <span 
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
                  isPaid 
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                    : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                }`}
              >
                <CheckCircle size={14} />
                {isPaid ? 'Payment Confirmed' : 'Payment Pending'}
              </span>
            </div>
          </div>

          {/* Store Pickup OTP Card - Only for pickup orders */}
          {orderDetails?.delivery_mode === 'self_pickup' && orderDetails?.pickup_otp_code && (
            <div 
              className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl shadow-lg p-6 mb-6 text-center"
              style={{ border: '2px solid #10b981' }}
            >
              <div className="flex items-center justify-center gap-2 mb-3">
                <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                  <Package size={20} className="text-white" />
                </div>
                <h3 className="text-lg font-bold text-green-700 dark:text-green-400">
                  Your Pickup OTP
                </h3>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                Show this code at <strong>{orderDetails?.pickup_store?.name || 'the store'}</strong> to collect your order
              </p>
              <div 
                className="inline-block px-8 py-4 rounded-xl"
                style={{ 
                  background: 'linear-gradient(135deg, #1e3a52, #2d4a6a)',
                  boxShadow: '0 4px 15px rgba(30, 58, 82, 0.3)'
                }}
              >
                <span 
                  className="text-4xl font-bold font-mono tracking-[8px]"
                  style={{ color: '#d4af37' }}
                  data-testid="pickup-otp-code"
                >
                  {orderDetails.pickup_otp_code}
                </span>
              </div>
              {orderDetails?.balance_at_store > 0 && (
                <div className="mt-4 p-3 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    <strong>Balance to pay at store:</strong> ₹{orderDetails.balance_at_store.toFixed(0)}
                  </p>
                </div>
              )}
              <p className="text-xs text-slate-500 mt-4">
                OTP has also been sent to your email. Valid for 7 days.
              </p>
            </div>
          )}

          {/* Order Timeline */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 mb-6">
            <h2 className="text-lg font-bold mb-6" style={{ color: 'var(--japanese-indigo)' }}>
              What's Next?
            </h2>
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-600" />
              
              {/* Step 1 - Order Confirmed */}
              <div className="relative flex items-start gap-4 mb-6">
                <div 
                  className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 z-10"
                  style={{ backgroundColor: 'var(--metallic-gold)' }}
                >
                  <CheckCircle size={24} color="white" />
                </div>
                <div className="pt-2">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-200">Order Confirmed</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">We've received your order</p>
                </div>
              </div>
              
              {/* Step 2 - Processing */}
              <div className="relative flex items-start gap-4 mb-6">
                <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 z-10 bg-slate-200 dark:bg-slate-600">
                  <Package size={24} className="text-slate-400" />
                </div>
                <div className="pt-2">
                  <h3 className="font-semibold text-slate-400">Processing</h3>
                  <p className="text-sm text-slate-400">Your order is being prepared</p>
                </div>
              </div>
              
              {/* Step 3 - Shipped */}
              <div className="relative flex items-start gap-4 mb-6">
                <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 z-10 bg-slate-200 dark:bg-slate-600">
                  <Truck size={24} className="text-slate-400" />
                </div>
                <div className="pt-2">
                  <h3 className="font-semibold text-slate-400">Shipped</h3>
                  <p className="text-sm text-slate-400">On the way to you</p>
                </div>
              </div>
              
              {/* Step 4 - Delivered */}
              <div className="relative flex items-start gap-4">
                <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 z-10 bg-slate-200 dark:bg-slate-600">
                  <Heart size={24} className="text-slate-400" />
                </div>
                <div className="pt-2">
                  <h3 className="font-semibold text-slate-400">Delivered</h3>
                  <p className="text-sm text-slate-400">Enjoy your Addrika fragrances!</p>
                </div>
              </div>
            </div>
          </div>

          {/* Order Items */}
          {items.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 mb-6">
              <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--japanese-indigo)' }}>
                Order Items
              </h2>
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {items.map((item, index) => (
                  <div key={index} className="flex items-center gap-4 py-3">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center">
                      <ShoppingBag size={24} className="text-slate-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-slate-800 dark:text-slate-200">{item.name}</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {item.size} × {item.quantity}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold" style={{ color: 'var(--metallic-gold)' }}>
                        ₹{(item.price * item.quantity).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Order Total */}
              <div className="border-t border-slate-200 dark:border-slate-600 mt-4 pt-4 space-y-2">
                {pricing.subtotal && (
                  <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                    <span>Subtotal</span>
                    <span>₹{pricing.subtotal.toFixed(2)}</span>
                  </div>
                )}
                {pricing.coupon_discount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount</span>
                    <span>-₹{pricing.coupon_discount.toFixed(2)}</span>
                  </div>
                )}
                {pricing.shipping > 0 && (
                  <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                    <span>Shipping</span>
                    <span>₹{pricing.shipping.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold pt-2 border-t border-slate-200 dark:border-slate-600">
                  <span style={{ color: 'var(--japanese-indigo)' }}>Total</span>
                  <span style={{ color: 'var(--metallic-gold)' }}>
                    ₹{(pricing.final_total || pricing.subtotal || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Shipping Address */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 mb-6">
            <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--japanese-indigo)' }}>
              Shipping To
            </h2>
            <div className="flex items-start gap-3">
              <MapPin size={20} style={{ color: 'var(--metallic-gold)' }} className="mt-1 flex-shrink-0" />
              <div className="text-slate-700 dark:text-slate-300">
                <p className="font-medium">{shipping.name}</p>
                <p>{shipping.address}</p>
                {shipping.landmark && <p>{shipping.landmark}</p>}
                <p>{shipping.city}, {shipping.state} {shipping.pincode}</p>
                <div className="flex items-center gap-2 mt-2 text-sm text-slate-500 dark:text-slate-400">
                  <Phone size={14} />
                  <span>{shipping.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                  <Mail size={14} />
                  <span>{shipping.email}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Button
              onClick={() => navigate(`/track-order?order=${orderNum}`)}
              variant="outline"
              className="flex items-center gap-2"
              data-testid="track-order-btn"
            >
              <Truck size={18} />
              Track Order
            </Button>
            <Button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 text-white"
              style={{ backgroundColor: 'var(--japanese-indigo)' }}
              data-testid="continue-shopping-btn"
            >
              Continue Shopping
              <ArrowRight size={18} />
            </Button>
          </div>

          {/* Share & Review CTA */}
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-slate-800 dark:to-slate-700 rounded-2xl p-6 text-center">
            <Star className="mx-auto mb-3" size={32} style={{ color: 'var(--metallic-gold)' }} />
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--japanese-indigo)' }}>
              Love your fragrance?
            </h3>
            <p className="text-slate-600 dark:text-slate-300 text-sm mb-4">
              Share your experience and help others discover Addrika
            </p>
            <div className="flex justify-center gap-3">
              <Button
                onClick={shareOrder}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Share2 size={16} />
                Share
              </Button>
              <Button
                onClick={() => navigate('/review')}
                size="sm"
                className="flex items-center gap-2 text-white"
                style={{ backgroundColor: 'var(--metallic-gold)' }}
              >
                <Star size={16} />
                Write a Review
              </Button>
            </div>
          </div>
        </div>
      </main>

      <Footer />
      
      {/* Custom animation styles */}
      <style>{`
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-bounce-slow {
          animation: bounce-slow 2s ease-in-out infinite;
        }
        .delay-100 { animation-delay: 100ms; }
        .delay-200 { animation-delay: 200ms; }
      `}</style>
    </div>
  );
};

export default ThankYou;
