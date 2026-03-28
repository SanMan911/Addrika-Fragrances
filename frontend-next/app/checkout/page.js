'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { MapPin, CreditCard, Truck, Store, ChevronRight, ArrowLeft, CheckCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, getCartTotal, clearCart, isLoaded } = useCart();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  
  const [step, setStep] = useState(1); // 1: Address, 2: Delivery, 3: Payment
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState({});
  
  // Delivery mode
  const [deliveryMode, setDeliveryMode] = useState('delivery'); // 'delivery' or 'pickup'
  
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
      // Create order
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
            // Verify payment
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
      <div className="min-h-screen flex items-center justify-center bg-[#F5F0E8]">
        <div className="w-12 h-12 border-4 border-[#2B3A4A] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F0E8]">
      {/* Load Razorpay script */}
      <script src="https://checkout.razorpay.com/v1/checkout.js" async />
      
      {/* Header */}
      <header className="bg-white shadow-sm py-4 px-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/cart" className="flex items-center gap-2 text-[#2B3A4A] hover:opacity-70">
            <ArrowLeft size={20} />
            <span>Back to Cart</span>
          </Link>
          <Link href="/" className="text-xl font-bold text-[#2B3A4A]">ADDRIKA</Link>
          <div className="w-24" />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-[#2B3A4A] mb-6">Checkout</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Delivery Mode Selection */}
            <div className="bg-white rounded-xl p-6">
              <h2 className="text-lg font-bold text-[#2B3A4A] mb-4">Delivery Method</h2>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setDeliveryMode('delivery')}
                  className={`p-4 border-2 rounded-xl flex flex-col items-center gap-2 transition-all ${
                    deliveryMode === 'delivery' 
                      ? 'border-[#D4AF37] bg-[#D4AF37]/5' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Truck size={24} className={deliveryMode === 'delivery' ? 'text-[#D4AF37]' : 'text-gray-400'} />
                  <span className="font-medium">Home Delivery</span>
                  <span className="text-xs text-gray-500">{subtotal >= 499 ? 'FREE' : '₹49'}</span>
                </button>
                <button
                  onClick={() => setDeliveryMode('pickup')}
                  className={`p-4 border-2 rounded-xl flex flex-col items-center gap-2 transition-all ${
                    deliveryMode === 'pickup' 
                      ? 'border-[#D4AF37] bg-[#D4AF37]/5' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Store size={24} className={deliveryMode === 'pickup' ? 'text-[#D4AF37]' : 'text-gray-400'} />
                  <span className="font-medium">Store Pickup</span>
                  <span className="text-xs text-gray-500">FREE</span>
                </button>
              </div>
            </div>

            {/* Address Form (for delivery) */}
            {deliveryMode === 'delivery' && (
              <div className="bg-white rounded-xl p-6">
                <h2 className="text-lg font-bold text-[#2B3A4A] mb-4 flex items-center gap-2">
                  <MapPin size={20} />
                  Delivery Address
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                    <input
                      name="name"
                      value={address.name}
                      onChange={handleAddressChange}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#D4AF37]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                    <input
                      name="phone"
                      value={address.phone}
                      onChange={handleAddressChange}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#D4AF37]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">PIN Code *</label>
                    <input
                      name="pincode"
                      value={address.pincode}
                      onChange={handleAddressChange}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#D4AF37]"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
                    <input
                      name="address"
                      value={address.address}
                      onChange={handleAddressChange}
                      placeholder="House/Flat No., Building, Street"
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#D4AF37]"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Landmark</label>
                    <input
                      name="landmark"
                      value={address.landmark}
                      onChange={handleAddressChange}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#D4AF37]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                    <input
                      name="city"
                      value={address.city}
                      readOnly
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
                    <input
                      name="state"
                      value={address.state}
                      readOnly
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Store Selection (for pickup) */}
            {deliveryMode === 'pickup' && (
              <div className="bg-white rounded-xl p-6">
                <h2 className="text-lg font-bold text-[#2B3A4A] mb-4 flex items-center gap-2">
                  <Store size={20} />
                  Select Pickup Location
                </h2>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Your PIN Code</label>
                  <input
                    value={address.pincode}
                    onChange={(e) => handleAddressChange({ target: { name: 'pincode', value: e.target.value } })}
                    placeholder="Enter PIN code to find stores"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#D4AF37]"
                  />
                </div>
                
                {retailers.length > 0 ? (
                  <div className="space-y-3">
                    {retailers.map((retailer) => (
                      <button
                        key={retailer.id}
                        onClick={() => setSelectedRetailer(retailer)}
                        className={`w-full text-left p-4 border-2 rounded-xl transition-all ${
                          selectedRetailer?.id === retailer.id
                            ? 'border-[#D4AF37] bg-[#D4AF37]/5'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold text-[#2B3A4A]">{retailer.store_name}</p>
                            <p className="text-sm text-gray-500">{retailer.address}</p>
                            <p className="text-sm text-gray-500">{retailer.city}, {retailer.state}</p>
                          </div>
                          {selectedRetailer?.id === retailer.id && (
                            <CheckCircle size={20} className="text-[#D4AF37]" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : address.pincode?.length === 6 ? (
                  <p className="text-gray-500 text-center py-8">No pickup locations found in your area</p>
                ) : (
                  <p className="text-gray-500 text-center py-8">Enter your PIN code to find nearby stores</p>
                )}
              </div>
            )}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl p-6 sticky top-24">
              <h2 className="text-lg font-bold text-[#2B3A4A] mb-4">Order Summary</h2>
              
              {/* Cart Items */}
              <div className="space-y-3 mb-4 max-h-48 overflow-y-auto">
                {cart.map((item) => {
                  const product = products[item.productId];
                  return (
                    <div key={`${item.productId}-${item.size}`} className="flex gap-3">
                      <div className="w-12 h-12 rounded bg-gray-100 flex-shrink-0 overflow-hidden">
                        {product?.image && (
                          <Image
                            src={product.image}
                            alt={item.name}
                            width={48}
                            height={48}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        <p className="text-xs text-gray-500">{item.size} × {item.quantity}</p>
                      </div>
                      <p className="text-sm font-medium">₹{item.price * item.quantity}</p>
                    </div>
                  );
                })}
              </div>
              
              {/* Price Breakdown */}
              <div className="space-y-2 text-sm border-t border-gray-100 pt-4">
                <div className="flex justify-between">
                  <span className="text-gray-500">Subtotal</span>
                  <span>₹{subtotal}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span>-₹{discount}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Shipping</span>
                  <span className={shipping === 0 ? 'text-green-600' : ''}>
                    {shipping === 0 ? 'FREE' : `₹${shipping}`}
                  </span>
                </div>
                <div className="flex justify-between font-bold text-lg border-t border-gray-100 pt-2">
                  <span>Total</span>
                  <span>₹{total}</span>
                </div>
              </div>
              
              {/* Pay Button */}
              <button
                onClick={handlePayment}
                disabled={loading}
                className="w-full mt-6 py-3 bg-[#D4AF37] text-[#2B3A4A] rounded-xl font-semibold hover:bg-[#c9a432] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                data-testid="pay-btn"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <CreditCard size={18} />
                    Pay ₹{total}
                  </>
                )}
              </button>
              
              <p className="text-xs text-gray-400 text-center mt-4">
                🔒 Secured by Razorpay
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
