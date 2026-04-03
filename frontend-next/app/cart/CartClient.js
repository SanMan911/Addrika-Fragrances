'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { ShoppingBag, Trash2, Minus, Plus, ArrowRight, Tag, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

// Production backend URL - hardcoded as fallback for Vercel
const PRODUCTION_BACKEND = 'https://product-size-sync.preview.emergentagent.com';
const API_URL = process.env.NEXT_PUBLIC_API_URL || PRODUCTION_BACKEND;

export default function CartClient() {
  const router = useRouter();
  const { cart, removeFromCart, updateQuantity, getCartTotal, getCartCount, isLoaded, clearCart } = useCart();
  const { isAuthenticated } = useAuth();
  
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [products, setProducts] = useState({});
  const [loading, setLoading] = useState(true);

  // Fetch product details for cart items
  useEffect(() => {
    const fetchProducts = async () => {
      if (cart.length === 0) {
        setLoading(false);
        return;
      }
      
      try {
        const res = await fetch(`${API_URL}/api/products`);
        const data = await res.json();
        const productMap = {};
        data.forEach(p => { productMap[p.id] = p; });
        setProducts(productMap);
      } catch (error) {
        console.error('Failed to fetch products:', error);
      } finally {
        setLoading(false);
      }
    };
    
    if (isLoaded) {
      fetchProducts();
    }
  }, [cart, isLoaded]);

  const applyCoupon = async () => {
    if (!couponCode.trim()) {
      toast.error('Please enter a coupon code');
      return;
    }
    
    setCouponLoading(true);
    try {
      const cartTotal = getCartTotal();
      const params = new URLSearchParams({
        code: couponCode.toUpperCase(),
        subtotal: cartTotal.toString(),
        mrp_total: cartTotal.toString()
      });
      
      const res = await fetch(`${API_URL}/api/discount-codes/validate?${params}`, {
        method: 'POST',
        credentials: 'include',
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.detail || 'Invalid coupon');
      }
      
      setAppliedCoupon(data);
      toast.success(`Coupon applied! You save ₹${data.discount}`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setCouponLoading(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    toast.info('Coupon removed');
  };

  const handleCheckout = () => {
    if (!isAuthenticated) {
      toast.info('Please login to continue');
      router.push('/login?redirect=/checkout');
      return;
    }
    router.push('/checkout');
  };

  const subtotal = getCartTotal();
  const discount = appliedCoupon?.discount || 0;
  const shipping = subtotal >= 499 ? 0 : 49;
  const total = subtotal - discount + shipping;

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(180deg, #0f1419 0%, #1a2332 100%)' }}>
        <div className="w-12 h-12 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #0f1419 0%, #1a2332 100%)' }}>
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
              Shopping Cart
            </h1>
            <p className="text-gray-400">
              {cart.length === 0 
                ? 'Your cart is empty' 
                : `${getCartCount()} item${getCartCount() > 1 ? 's' : ''} in your cart`}
            </p>
          </div>

          {cart.length === 0 ? (
            <div 
              className="text-center py-16 rounded-2xl"
              style={{ 
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.1)'
              }}
            >
              <ShoppingCart size={48} className="mx-auto mb-4 text-gray-600" />
              <h3 className="text-xl font-semibold text-white mb-2">Your cart is empty</h3>
              <p className="text-gray-400 mb-6">
                Looks like you haven&apos;t added anything yet
              </p>
              <Link
                href="/#fragrances"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all"
                style={{ 
                  background: 'linear-gradient(135deg, #D4AF37 0%, #c9a432 100%)',
                  color: '#1a1a2e'
                }}
              >
                <ShoppingCart size={18} />
                Continue Shopping
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Cart Items */}
              <div className="lg:col-span-2 space-y-4">
                {cart.map((item) => {
                  const product = products[item.productId];
                  return (
                    <div 
                      key={`${item.productId}-${item.size}`} 
                      className="p-4 rounded-xl flex gap-4"
                      style={{ 
                        background: 'linear-gradient(165deg, rgba(26,26,46,0.8) 0%, rgba(22,33,62,0.8) 100%)',
                        border: '1px solid rgba(255,255,255,0.1)'
                      }}
                    >
                      {/* Product Image */}
                      <div 
                        className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0"
                        style={{ background: 'rgba(255,255,255,0.05)' }}
                      >
                        {(item.image || product?.image) && (
                          <img
                            src={item.image || product?.image}
                            alt={item.name || product?.name || 'Product'}
                            className="w-full h-full object-contain p-2"
                          />
                        )}
                      </div>
                      
                      {/* Product Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-semibold text-white truncate">{item.name || product?.name}</h3>
                            <p className="text-sm text-gray-400">{item.size}</p>
                          </div>
                          <button
                            onClick={() => removeFromCart(item.productId, item.size)}
                            className="p-2 rounded-lg hover:bg-red-500/20 transition-colors"
                            data-testid={`remove-item-${item.productId}`}
                          >
                            <Trash2 size={18} className="text-red-400" />
                          </button>
                        </div>
                        
                        <div className="flex items-center justify-between mt-4">
                          {/* Quantity Controls */}
                          <div 
                            className="flex items-center rounded-lg"
                            style={{ border: '1px solid rgba(255,255,255,0.2)' }}
                          >
                            <button
                              onClick={() => updateQuantity(item.productId, item.size, item.quantity - 1)}
                              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white transition-colors rounded-l-lg"
                              data-testid={`decrease-qty-${item.productId}`}
                            >
                              <Minus size={16} />
                            </button>
                            <span className="w-10 text-center font-medium text-white">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.productId, item.size, item.quantity + 1)}
                              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white transition-colors rounded-r-lg"
                              data-testid={`increase-qty-${item.productId}`}
                            >
                              <Plus size={16} />
                            </button>
                          </div>
                          
                          <p className="font-bold text-[#D4AF37] text-lg">Rs. {item.price * item.quantity}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
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
                  
                  {/* Coupon Code */}
                  <div className="mb-4">
                    {appliedCoupon ? (
                      <div 
                        className="flex items-center justify-between p-3 rounded-lg"
                        style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)' }}
                      >
                        <div className="flex items-center gap-2">
                          <Tag size={16} className="text-green-400" />
                          <span className="text-green-400 font-medium">{couponCode}</span>
                        </div>
                        <button onClick={removeCoupon} className="text-gray-400 hover:text-red-400">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                          placeholder="Coupon code"
                          className="flex-1 px-3 py-2 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                          style={{ 
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)'
                          }}
                        />
                        <button
                          onClick={applyCoupon}
                          disabled={couponLoading}
                          className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                          style={{ 
                            background: 'rgba(212,175,55,0.2)',
                            color: '#D4AF37',
                            border: '1px solid rgba(212,175,55,0.3)'
                          }}
                        >
                          Apply
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {/* Price Breakdown */}
                  <div className="space-y-3 text-sm border-t pt-4" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
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
                    {shipping > 0 && subtotal < 499 && (
                      <p className="text-xs text-gray-500">Add Rs. {499 - subtotal} more for free shipping</p>
                    )}
                    <div className="flex justify-between font-bold text-lg border-t pt-3" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                      <span className="text-white">Total</span>
                      <span className="text-[#D4AF37]">Rs. {total}</span>
                    </div>
                  </div>
                  
                  {/* Checkout Button */}
                  <button
                    onClick={handleCheckout}
                    className="w-full mt-6 py-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
                    style={{ 
                      background: 'linear-gradient(135deg, #D4AF37 0%, #c9a432 100%)',
                      color: '#1a1a2e'
                    }}
                    data-testid="checkout-btn"
                  >
                    Proceed to Checkout
                    <ArrowRight size={18} />
                  </button>
                  
                  {/* Trust Badges */}
                  <div className="mt-4 text-center text-xs text-gray-500">
                    <p>Secure Payment | 7 Day Returns | Free Shipping on Rs. 499+</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
