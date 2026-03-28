'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { ShoppingBag, Trash2, Minus, Plus, ArrowLeft, ArrowRight, Tag, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export default function CartPage() {
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
      const res = await fetch(`${API_URL}/api/coupons/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          code: couponCode.toUpperCase(),
          cart_total: getCartTotal()
        })
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
      <div className="min-h-screen flex items-center justify-center bg-[#F5F0E8]">
        <div className="w-12 h-12 border-4 border-[#2B3A4A] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-[#F5F0E8]">
        <header className="bg-white shadow-sm py-4 px-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <Link href="/" className="text-xl font-bold text-[#2B3A4A]">ADDRIKA</Link>
          </div>
        </header>
        
        <main className="max-w-4xl mx-auto px-4 py-16 text-center">
          <ShoppingBag size={64} className="mx-auto text-gray-300 mb-6" />
          <h1 className="text-2xl font-bold text-[#2B3A4A] mb-2">Your cart is empty</h1>
          <p className="text-gray-500 mb-6">Looks like you haven&apos;t added anything yet</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-[#2B3A4A] text-white px-6 py-3 rounded-xl hover:bg-[#1a252f] transition-colors"
          >
            <ShoppingCart size={20} />
            Continue Shopping
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F0E8]">
      {/* Header */}
      <header className="bg-white shadow-sm py-4 px-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-[#2B3A4A] hover:opacity-70">
            <ArrowLeft size={20} />
            <span className="hidden sm:inline">Continue Shopping</span>
          </Link>
          <Link href="/" className="text-xl font-bold text-[#2B3A4A]">ADDRIKA</Link>
          <div className="w-24 text-right">
            <span className="text-sm text-gray-500">{getCartCount()} items</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-[#2B3A4A] mb-6">Shopping Cart</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {cart.map((item) => {
              const product = products[item.productId];
              return (
                <div key={`${item.productId}-${item.size}`} className="bg-white rounded-xl p-4 flex gap-4">
                  {/* Product Image */}
                  <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                    {product?.image && (
                      <Image
                        src={product.image}
                        alt={item.name || product?.name || 'Product'}
                        width={96}
                        height={96}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  
                  {/* Product Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-[#2B3A4A] truncate">{item.name || product?.name}</h3>
                        <p className="text-sm text-gray-500">{item.size}</p>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.productId, item.size)}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                        data-testid={`remove-item-${item.productId}`}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                    
                    <div className="flex items-center justify-between mt-4">
                      {/* Quantity Controls */}
                      <div className="flex items-center gap-2 bg-[#F5F0E8] rounded-lg">
                        <button
                          onClick={() => updateQuantity(item.productId, item.size, item.quantity - 1)}
                          className="w-8 h-8 flex items-center justify-center text-[#2B3A4A] hover:bg-gray-200 rounded-l-lg"
                          data-testid={`decrease-qty-${item.productId}`}
                        >
                          <Minus size={16} />
                        </button>
                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.productId, item.size, item.quantity + 1)}
                          className="w-8 h-8 flex items-center justify-center text-[#2B3A4A] hover:bg-gray-200 rounded-r-lg"
                          data-testid={`increase-qty-${item.productId}`}
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                      
                      <p className="font-bold text-[#2B3A4A]">₹{item.price * item.quantity}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl p-6 sticky top-24">
              <h2 className="text-lg font-bold text-[#2B3A4A] mb-4">Order Summary</h2>
              
              {/* Coupon Code */}
              <div className="mb-4">
                {appliedCoupon ? (
                  <div className="flex items-center justify-between bg-green-50 p-3 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Tag size={16} className="text-green-600" />
                      <span className="text-green-700 font-medium">{couponCode}</span>
                    </div>
                    <button onClick={removeCoupon} className="text-gray-400 hover:text-red-500">
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
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#D4AF37]"
                    />
                    <button
                      onClick={applyCoupon}
                      disabled={couponLoading}
                      className="px-4 py-2 bg-[#F5F0E8] text-[#2B3A4A] rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50"
                    >
                      Apply
                    </button>
                  </div>
                )}
              </div>
              
              {/* Price Breakdown */}
              <div className="space-y-3 text-sm border-t border-gray-100 pt-4">
                <div className="flex justify-between">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="text-[#2B3A4A]">₹{subtotal}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span>-₹{discount}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Shipping</span>
                  <span className={shipping === 0 ? 'text-green-600' : 'text-[#2B3A4A]'}>
                    {shipping === 0 ? 'FREE' : `₹${shipping}`}
                  </span>
                </div>
                {shipping > 0 && subtotal < 499 && (
                  <p className="text-xs text-gray-400">Add ₹{499 - subtotal} more for free shipping</p>
                )}
                <div className="flex justify-between font-bold text-lg border-t border-gray-100 pt-3">
                  <span>Total</span>
                  <span className="text-[#2B3A4A]">₹{total}</span>
                </div>
              </div>
              
              {/* Checkout Button */}
              <button
                onClick={handleCheckout}
                className="w-full mt-6 py-3 bg-[#D4AF37] text-[#2B3A4A] rounded-xl font-semibold hover:bg-[#c9a432] transition-colors flex items-center justify-center gap-2"
                data-testid="checkout-btn"
              >
                Proceed to Checkout
                <ArrowRight size={18} />
              </button>
              
              {/* Trust Badges */}
              <div className="mt-4 text-center text-xs text-gray-400">
                <p>🔒 Secure Payment • 7 Day Returns • Free Shipping on ₹499+</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
