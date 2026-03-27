'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShoppingCart, CreditCard, Truck, MapPin, ArrowLeft, Loader2, CheckCircle } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://forgot-pass-4.preview.emergentagent.com';

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, getCartTotal, clearCart } = useCart();
  const { user, isAuthenticated } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: Address, 2: Payment
  const [deliveryMode, setDeliveryMode] = useState('shipping'); // shipping or pickup
  
  const [address, setAddress] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    pincode: '',
  });

  useEffect(() => {
    if (cart.length === 0) {
      router.push('/cart');
    }
  }, [cart, router]);

  const subtotal = getCartTotal();
  const shipping = deliveryMode === 'pickup' ? 0 : (subtotal >= 499 ? 0 : 49);
  const total = subtotal + shipping;

  const handleAddressChange = (e) => {
    setAddress({ ...address, [e.target.name]: e.target.value });
  };

  const validateAddress = () => {
    if (!address.name || !address.email || !address.phone) {
      toast.error('Please fill in contact details');
      return false;
    }
    if (deliveryMode === 'shipping') {
      if (!address.line1 || !address.city || !address.state || !address.pincode) {
        toast.error('Please fill in complete address');
        return false;
      }
    }
    return true;
  };

  const handleContinueToPayment = () => {
    if (validateAddress()) {
      setStep(2);
    }
  };

  const handlePlaceOrder = async () => {
    setLoading(true);
    
    try {
      // Create order
      const orderData = {
        items: cart.map(item => ({
          product_id: item.productId,
          name: item.name,
          size: item.size,
          price: item.price,
          quantity: item.quantity,
        })),
        delivery_mode: deliveryMode,
        shipping_address: deliveryMode === 'shipping' ? address : null,
        customer: {
          name: address.name,
          email: address.email,
          phone: address.phone,
        },
        subtotal,
        shipping,
        total,
      };

      const res = await fetch(`${API_URL}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      });

      if (!res.ok) {
        throw new Error('Failed to create order');
      }

      const order = await res.json();
      
      // Clear cart and redirect
      clearCart();
      toast.success('Order placed successfully!');
      router.push(`/track-order?order=${order.order_number}`);
      
    } catch (error) {
      toast.error('Failed to place order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (cart.length === 0) {
    return null;
  }

  return (
    <>
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-[#2B3A4A] font-bold text-xl">
            <span className="text-[#D4AF37]">Addrika</span>
          </Link>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <ShoppingCart size={18} />
            Secure Checkout
          </div>
        </div>
      </header>

      <main className="pt-24 pb-16 min-h-screen bg-[#F5F0E8]">
        <div className="max-w-6xl mx-auto px-4">
          {/* Back Button */}
          <Link
            href="/cart"
            className="inline-flex items-center gap-2 text-[#2B3A4A] hover:text-[#D4AF37] mb-6"
          >
            <ArrowLeft size={18} />
            Back to Cart
          </Link>

          {/* Progress Steps */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className={`flex items-center gap-2 ${step >= 1 ? 'text-[#D4AF37]' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? 'bg-[#D4AF37] text-white' : 'bg-gray-200'}`}>
                {step > 1 ? <CheckCircle size={18} /> : '1'}
              </div>
              <span className="font-medium">Address</span>
            </div>
            <div className="w-12 h-0.5 bg-gray-300" />
            <div className={`flex items-center gap-2 ${step >= 2 ? 'text-[#D4AF37]' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? 'bg-[#D4AF37] text-white' : 'bg-gray-200'}`}>
                2
              </div>
              <span className="font-medium">Payment</span>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2">
              {step === 1 && (
                <div className="bg-white rounded-xl p-6 shadow-sm">
                  <h2 className="text-xl font-semibold text-[#2B3A4A] mb-6">Delivery Details</h2>

                  {/* Delivery Mode */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-[#2B3A4A] mb-3">
                      Delivery Method
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => setDeliveryMode('shipping')}
                        className={`p-4 rounded-lg border-2 text-left transition-colors ${
                          deliveryMode === 'shipping'
                            ? 'border-[#D4AF37] bg-[#D4AF37]/5'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Truck className="w-6 h-6 text-[#D4AF37] mb-2" />
                        <p className="font-semibold text-[#2B3A4A]">Home Delivery</p>
                        <p className="text-sm text-gray-500">3-7 business days</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeliveryMode('pickup')}
                        className={`p-4 rounded-lg border-2 text-left transition-colors ${
                          deliveryMode === 'pickup'
                            ? 'border-[#D4AF37] bg-[#D4AF37]/5'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <MapPin className="w-6 h-6 text-[#D4AF37] mb-2" />
                        <p className="font-semibold text-[#2B3A4A]">Store Pickup</p>
                        <p className="text-sm text-gray-500">Same day available</p>
                      </button>
                    </div>
                  </div>

                  {/* Contact Details */}
                  <div className="grid md:grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-sm font-medium text-[#2B3A4A] mb-1">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={address.name}
                        onChange={handleAddressChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#2B3A4A] mb-1">
                        Phone *
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        value={address.phone}
                        onChange={handleAddressChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent outline-none"
                        required
                      />
                    </div>
                  </div>

                  <div className="mb-6">
                    <label className="block text-sm font-medium text-[#2B3A4A] mb-1">
                      Email *
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={address.email}
                      onChange={handleAddressChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent outline-none"
                      required
                    />
                  </div>

                  {/* Shipping Address */}
                  {deliveryMode === 'shipping' && (
                    <>
                      <h3 className="font-semibold text-[#2B3A4A] mb-4">Shipping Address</h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-[#2B3A4A] mb-1">
                            Address Line 1 *
                          </label>
                          <input
                            type="text"
                            name="line1"
                            value={address.line1}
                            onChange={handleAddressChange}
                            placeholder="House/Flat No., Building Name"
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent outline-none"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[#2B3A4A] mb-1">
                            Address Line 2
                          </label>
                          <input
                            type="text"
                            name="line2"
                            value={address.line2}
                            onChange={handleAddressChange}
                            placeholder="Street, Area, Landmark"
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent outline-none"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-[#2B3A4A] mb-1">
                              City *
                            </label>
                            <input
                              type="text"
                              name="city"
                              value={address.city}
                              onChange={handleAddressChange}
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent outline-none"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-[#2B3A4A] mb-1">
                              PIN Code *
                            </label>
                            <input
                              type="text"
                              name="pincode"
                              value={address.pincode}
                              onChange={handleAddressChange}
                              maxLength={6}
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent outline-none"
                              required
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[#2B3A4A] mb-1">
                            State *
                          </label>
                          <input
                            type="text"
                            name="state"
                            value={address.state}
                            onChange={handleAddressChange}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent outline-none"
                            required
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <button
                    onClick={handleContinueToPayment}
                    className="w-full mt-6 bg-[#2B3A4A] text-white py-4 rounded-lg font-semibold hover:bg-[#1a252f] transition-colors"
                  >
                    Continue to Payment
                  </button>
                </div>
              )}

              {step === 2 && (
                <div className="bg-white rounded-xl p-6 shadow-sm">
                  <h2 className="text-xl font-semibold text-[#2B3A4A] mb-6">Payment</h2>
                  
                  <div className="bg-[#F5F0E8] rounded-lg p-4 mb-6">
                    <div className="flex items-center gap-3">
                      <CreditCard className="w-6 h-6 text-[#D4AF37]" />
                      <div>
                        <p className="font-semibold text-[#2B3A4A]">Pay with Razorpay</p>
                        <p className="text-sm text-gray-600">Cards, UPI, Netbanking & more</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button
                      onClick={() => setStep(1)}
                      className="flex-1 py-4 rounded-lg font-semibold border border-gray-300 hover:bg-gray-50 transition-colors"
                    >
                      Back
                    </button>
                    <button
                      onClick={handlePlaceOrder}
                      disabled={loading}
                      className="flex-1 bg-[#D4AF37] text-[#2B3A4A] py-4 rounded-lg font-semibold hover:bg-[#c9a432] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        `Pay ₹${total.toLocaleString('en-IN')}`
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl p-6 shadow-sm sticky top-24">
                <h2 className="text-lg font-semibold text-[#2B3A4A] mb-4">Order Summary</h2>
                
                <div className="space-y-3 mb-4">
                  {cart.map((item) => (
                    <div key={`${item.productId}-${item.size}`} className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        {item.name} ({item.size}) × {item.quantity}
                      </span>
                      <span className="font-medium">₹{(item.price * item.quantity).toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                </div>

                <hr className="my-4" />

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal</span>
                    <span>₹{subtotal.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Shipping</span>
                    <span className={shipping === 0 ? 'text-green-600' : ''}>
                      {shipping === 0 ? 'FREE' : `₹${shipping}`}
                    </span>
                  </div>
                </div>

                <hr className="my-4" />

                <div className="flex justify-between text-lg font-bold text-[#2B3A4A]">
                  <span>Total</span>
                  <span>₹{total.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
