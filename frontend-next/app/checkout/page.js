'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { MapPin, CreditCard, Truck, Store, ArrowLeft, CheckCircle, Loader2, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, getCartTotal, clearCart, isLoaded } = useCart();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState({});
  
  // Delivery mode
  const [deliveryMode, setDeliveryMode] = useState('delivery');
  
  // Address state
  const [address, setAddress] = useState({
    name: '',
    phone: '',
    pincode: '',
    address: '',
    landmark: '',
    city: '',
    state: ''
  });
  
  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  
  // Retailers for pickup
  const [retailers, setRetailers] = useState([]);
  const [selectedRetailer, setSelectedRetailer] = useState(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login?redirect=/checkout');
    }
  }, [isAuthenticated, authLoading, router]);

  // Redirect if cart is empty
  useEffect(() => {
    if (isLoaded && cart.length === 0) {
      router.push('/cart');
    }
  }, [cart, isLoaded, router]);

  // Load user address
  useEffect(() => {
    if (user) {
      setAddress({
        name: user.name || '',
        phone: user.phone || '',
        pincode: user.pincode || '',
        address: user.address || '',
        landmark: user.landmark || '',
        city: user.city || '',
        state: user.state || ''
      });
    }
  }, [user]);

  // Fetch products
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch(`${API_URL}/api/products`);
        const data = await res.json();
        const productMap = {};
        data.forEach(p => { productMap[p.id] = p; });
        setProducts(productMap);
      } catch (error) {
        console.error('Failed to fetch products:', error);
      }
    };
    fetchProducts();
  }, []);

  // Fetch retailers for pickup
  useEffect(() => {
    const fetchRetailers = async () => {
      if (address.pincode?.length === 6) {
        try {
          const res = await fetch(`${API_URL}/api/retailers/by-pincode/${address.pincode}`);
          if (res.ok) {
            const data = await res.json();
            setRetailers(data);
          }
        } catch (error) {
          console.error('Failed to fetch retailers:', error);
        }
      }
    };
    fetchRetailers();
  }, [address.pincode]);

  // Pincode lookup
  const handlePincodeLookup = useCallback(async (pincode) => {
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
      const data = await res.json();
      
      if (data[0]?.Status === 'Success' && data[0]?.PostOffice?.length > 0) {
        const postOffice = data[0].PostOffice[0];
        setAddress(prev => ({
          ...prev,
          city: postOffice.District || '',
          state: postOffice.State || ''
        }));
      }
    } catch (error) {
      console.error('Pincode lookup failed:', error);
    }
  }, []);

  const handleAddressChange = (e) => {
    const { name, value } = e.target;
    let filteredValue = value;
    
    if (name === 'pincode') {
      filteredValue = value.replace(/\D/g, '').slice(0, 6);
      if (filteredValue.length === 6) {
        handlePincodeLookup(filteredValue);
      }
    } else if (name === 'phone') {
      filteredValue = value.replace(/\D/g, '').slice(0, 10);
    }
    
    setAddress(prev => ({ ...prev, [name]: filteredValue }));
  };

  const validateAddress = () => {
    if (!address.name || !address.phone || !address.pincode || !address.address || !address.city || !address.state) {
      toast.error('Please fill all required fields');
      return false;
    }
    if (address.phone.length !== 10) {
      toast.error('Please enter a valid 10-digit phone number');
      return false;
    }
    if (address.pincode.length !== 6) {
      toast.error('Please enter a valid 6-digit PIN code');
      return false;
    }
    return true;
  };

  const handlePayment = async () => {
    if (deliveryMode === 'delivery' && !validateAddress()) return;
    if (deliveryMode === 'pickup' && !selectedRetailer) {
      toast.error('Please select a pickup location');
      return;
    }
    
    setLoading(true);
    
    try {
      const orderData = {
        items: cart.map(item => ({
          product_id: item.productId,
          size: item.size,
          quantity: item.quantity,
          price: item.price,
          name: item.name
        })),
        delivery_mode: deliveryMode,
        shipping_address: deliveryMode === 'delivery' ? address : null,
        retailer_id: deliveryMode === 'pickup' ? selectedRetailer.id : null,
        coupon_code: appliedCoupon?.code || null
      };
      
      const res = await fetch(`${API_URL}/api/orders/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(orderData)
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to create order');
      }
      
      // Initialize Razorpay
      if (data.razorpay_order_id) {
        const options = {
          key: data.razorpay_key_id,
          amount: data.amount,
          currency: 'INR',
          name: 'Addrika',
          description: 'Premium Incense Purchase',
          order_id: data.razorpay_order_id,
          handler: async (response) => {
            const verifyRes = await fetch(`${API_URL}/api/orders/verify-payment`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                order_id: data.order_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              })
            });
            
            if (verifyRes.ok) {
              clearCart();
              toast.success('Payment successful!');
              router.push(`/orders/success?id=${data.order_id}`);
            } else {
              toast.error('Payment verification failed');
            }
          },
          prefill: {
            name: address.name,
            email: user?.email,
            contact: address.phone
          },
          theme: {
            color: '#D4AF37'
          }
        };
        
        const rzp = new window.Razorpay(options);
        rzp.open();
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const subtotal = getCartTotal();
  const discount = appliedCoupon?.discount || 0;
  const shipping = deliveryMode === 'pickup' ? 0 : (subtotal >= 499 ? 0 : 49);
  const total = subtotal - discount + shipping;

  if (authLoading || !isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(180deg, #0f1419 0%, #1a2332 100%)' }}>
        <div className="w-12 h-12 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const inputStyles = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.15)',
    color: 'white'
  };

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #0f1419 0%, #1a2332 100%)' }}>
      {/* Load Razorpay script */}
      <script src="https://checkout.razorpay.com/v1/checkout.js" async />
      
      <Header />

      <main className="pt-24 pb-16">
        <div className="max-w-5xl mx-auto px-4">
          {/* Page Header */}
          <div className="text-center mb-10">
            <div 
              className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(212,175,55,0.15)' }}
            >
              <ShoppingBag className="w-10 h-10 text-[#D4AF37]" />
            </div>
            <h1 
              className="text-3xl sm:text-4xl font-bold text-white mb-3"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Checkout
            </h1>
            <p className="text-gray-400">Complete your order</p>
          </div>
        
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Delivery Mode Selection */}
              <div 
                className="p-6 rounded-xl"
                style={{ 
                  background: 'linear-gradient(165deg, rgba(26,26,46,0.8) 0%, rgba(22,33,62,0.8) 100%)',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}
              >
                <h2 className="text-lg font-bold text-white mb-4">Delivery Method</h2>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setDeliveryMode('delivery')}
                    className="p-4 rounded-xl flex flex-col items-center gap-2 transition-all"
                    style={{
                      border: deliveryMode === 'delivery' ? '2px solid #D4AF37' : '2px solid rgba(255,255,255,0.1)',
                      background: deliveryMode === 'delivery' ? 'rgba(212,175,55,0.1)' : 'transparent'
                    }}
                  >
                    <Truck size={24} className={deliveryMode === 'delivery' ? 'text-[#D4AF37]' : 'text-gray-400'} />
                    <span className="font-medium text-white">Home Delivery</span>
                    <span className="text-xs text-gray-400">{subtotal >= 499 ? 'FREE' : 'Rs. 49'}</span>
                  </button>
                  <button
                    onClick={() => setDeliveryMode('pickup')}
                    className="p-4 rounded-xl flex flex-col items-center gap-2 transition-all"
                    style={{
                      border: deliveryMode === 'pickup' ? '2px solid #D4AF37' : '2px solid rgba(255,255,255,0.1)',
                      background: deliveryMode === 'pickup' ? 'rgba(212,175,55,0.1)' : 'transparent'
                    }}
                  >
                    <Store size={24} className={deliveryMode === 'pickup' ? 'text-[#D4AF37]' : 'text-gray-400'} />
                    <span className="font-medium text-white">Store Pickup</span>
                    <span className="text-xs text-gray-400">FREE</span>
                  </button>
                </div>
              </div>

              {/* Address Form (for delivery) */}
              {deliveryMode === 'delivery' && (
                <div 
                  className="p-6 rounded-xl"
                  style={{ 
                    background: 'linear-gradient(165deg, rgba(26,26,46,0.8) 0%, rgba(22,33,62,0.8) 100%)',
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}
                >
                  <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <MapPin size={20} className="text-[#D4AF37]" />
                    Delivery Address
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Full Name *</label>
                      <input
                        name="name"
                        value={address.name}
                        onChange={handleAddressChange}
                        className="w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4AF37] placeholder-gray-500"
                        style={inputStyles}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Phone *</label>
                      <input
                        name="phone"
                        value={address.phone}
                        onChange={handleAddressChange}
                        className="w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4AF37] placeholder-gray-500"
                        style={inputStyles}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">PIN Code *</label>
                      <input
                        name="pincode"
                        value={address.pincode}
                        onChange={handleAddressChange}
                        className="w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4AF37] placeholder-gray-500"
                        style={inputStyles}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-400 mb-1">Address *</label>
                      <input
                        name="address"
                        value={address.address}
                        onChange={handleAddressChange}
                        placeholder="House/Flat No., Building, Street"
                        className="w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4AF37] placeholder-gray-500"
                        style={inputStyles}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-400 mb-1">Landmark</label>
                      <input
                        name="landmark"
                        value={address.landmark}
                        onChange={handleAddressChange}
                        className="w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4AF37] placeholder-gray-500"
                        style={inputStyles}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">City *</label>
                      <input
                        name="city"
                        value={address.city}
                        readOnly
                        className="w-full px-4 py-3 rounded-lg"
                        style={{ ...inputStyles, opacity: 0.7 }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">State *</label>
                      <input
                        name="state"
                        value={address.state}
                        readOnly
                        className="w-full px-4 py-3 rounded-lg"
                        style={{ ...inputStyles, opacity: 0.7 }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Store Selection (for pickup) */}
              {deliveryMode === 'pickup' && (
                <div 
                  className="p-6 rounded-xl"
                  style={{ 
                    background: 'linear-gradient(165deg, rgba(26,26,46,0.8) 0%, rgba(22,33,62,0.8) 100%)',
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}
                >
                  <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Store size={20} className="text-[#D4AF37]" />
                    Select Pickup Location
                  </h2>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-400 mb-1">Your PIN Code</label>
                    <input
                      value={address.pincode}
                      onChange={(e) => handleAddressChange({ target: { name: 'pincode', value: e.target.value } })}
                      placeholder="Enter PIN code to find stores"
                      className="w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4AF37] placeholder-gray-500"
                      style={inputStyles}
                    />
                  </div>
                  
                  {retailers.length > 0 ? (
                    <div className="space-y-3">
                      {retailers.map((retailer) => (
                        <button
                          key={retailer.id}
                          onClick={() => setSelectedRetailer(retailer)}
                          className="w-full text-left p-4 rounded-xl transition-all"
                          style={{
                            border: selectedRetailer?.id === retailer.id ? '2px solid #D4AF37' : '2px solid rgba(255,255,255,0.1)',
                            background: selectedRetailer?.id === retailer.id ? 'rgba(212,175,55,0.1)' : 'transparent'
                          }}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-semibold text-white">{retailer.store_name}</p>
                              <p className="text-sm text-gray-400">{retailer.address}</p>
                              <p className="text-sm text-gray-400">{retailer.city}, {retailer.state}</p>
                            </div>
                            {selectedRetailer?.id === retailer.id && (
                              <CheckCircle size={20} className="text-[#D4AF37]" />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : address.pincode?.length === 6 ? (
                    <p className="text-gray-400 text-center py-8">No pickup locations found in your area</p>
                  ) : (
                    <p className="text-gray-400 text-center py-8">Enter your PIN code to find nearby stores</p>
                  )}
                </div>
              )}
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div 
                className="p-6 rounded-xl sticky top-24"
                style={{ 
                  background: 'linear-gradient(165deg, rgba(26,26,46,0.8) 0%, rgba(22,33,62,0.8) 100%)',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}
              >
                <h2 className="text-lg font-bold text-white mb-4">Order Summary</h2>
                
                {/* Cart Items */}
                <div className="space-y-3 mb-4 max-h-48 overflow-y-auto">
                  {cart.map((item) => {
                    const product = products[item.productId];
                    return (
                      <div key={`${item.productId}-${item.size}`} className="flex gap-3">
                        <div 
                          className="w-12 h-12 rounded flex-shrink-0 overflow-hidden"
                          style={{ background: 'rgba(255,255,255,0.05)' }}
                        >
                          {(item.image || product?.image) && (
                            <img
                              src={item.image || product?.image}
                              alt={item.name}
                              className="w-full h-full object-contain p-1"
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{item.name}</p>
                          <p className="text-xs text-gray-400">{item.size} x {item.quantity}</p>
                        </div>
                        <p className="text-sm font-medium text-white">Rs. {item.price * item.quantity}</p>
                      </div>
                    );
                  })}
                </div>
                
                {/* Price Breakdown */}
                <div className="space-y-2 text-sm border-t pt-4" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Subtotal</span>
                    <span className="text-white">Rs. {subtotal}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-green-400">
                      <span>Discount</span>
                      <span>-Rs. {discount}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-400">Shipping</span>
                    <span className={shipping === 0 ? 'text-green-400' : 'text-white'}>
                      {shipping === 0 ? 'FREE' : `Rs. ${shipping}`}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-lg border-t pt-2" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                    <span className="text-white">Total</span>
                    <span className="text-[#D4AF37]">Rs. {total}</span>
                  </div>
                </div>
                
                {/* Pay Button */}
                <button
                  onClick={handlePayment}
                  disabled={loading}
                  className="w-full mt-6 py-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ 
                    background: 'linear-gradient(135deg, #D4AF37 0%, #c9a432 100%)',
                    color: '#1a1a2e'
                  }}
                  data-testid="pay-btn"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <CreditCard size={18} />
                      Pay Rs. {total}
                    </>
                  )}
                </button>
                
                <p className="text-xs text-gray-500 text-center mt-4">
                  Secured by Razorpay
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
