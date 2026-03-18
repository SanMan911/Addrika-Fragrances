'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ShoppingCart, Trash2, Plus, Minus, ArrowRight, ShoppingBag } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { toast } from 'sonner';

export default function CartPage() {
  const { cart, removeFromCart, updateQuantity, getCartTotal, getCartCount, isLoaded } = useCart();
  const [removingItem, setRemovingItem] = useState(null);

  const handleRemove = (productId, size) => {
    setRemovingItem(`${productId}-${size}`);
    removeFromCart(productId, size);
    toast.success('Item removed from cart');
    setRemovingItem(null);
  };

  const handleQuantityChange = (productId, size, newQuantity) => {
    if (newQuantity < 1) {
      handleRemove(productId, size);
      return;
    }
    updateQuantity(productId, size, newQuantity);
  };

  const subtotal = getCartTotal();
  const shipping = subtotal >= 499 ? 0 : 49;
  const total = subtotal + shipping;

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-[#D4AF37] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-[#2B3A4A] font-bold text-xl">
            <span className="text-[#D4AF37]">Addrika</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/#fragrances" className="text-sm hover:text-[#D4AF37] transition-colors">
              Shop
            </Link>
            <Link href="/cart" className="relative">
              <ShoppingCart className="w-6 h-6 text-[#2B3A4A]" />
              {getCartCount() > 0 && (
                <span className="absolute -top-2 -right-2 w-5 h-5 bg-[#D4AF37] text-white text-xs rounded-full flex items-center justify-center">
                  {getCartCount()}
                </span>
              )}
            </Link>
          </nav>
        </div>
      </header>

      <main className="pt-24 pb-16 min-h-screen bg-[#F5F0E8]">
        <div className="max-w-6xl mx-auto px-4">
          <h1 className="text-3xl font-bold text-[#2B3A4A] font-serif mb-8">
            Your Cart ({getCartCount()} items)
          </h1>

          {cart.length === 0 ? (
            <div className="bg-white rounded-xl p-12 text-center">
              <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-[#2B3A4A] mb-2">
                Your cart is empty
              </h2>
              <p className="text-gray-600 mb-6">
                Discover our premium incense collection and add something special.
              </p>
              <Link
                href="/#fragrances"
                className="inline-flex items-center gap-2 bg-[#2B3A4A] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#1a252f] transition-colors"
              >
                Start Shopping
                <ArrowRight size={18} />
              </Link>
            </div>
          ) : (
            <div className="grid lg:grid-cols-3 gap-8">
              {/* Cart Items */}
              <div className="lg:col-span-2 space-y-4">
                {cart.map((item) => (
                  <div
                    key={`${item.productId}-${item.size}`}
                    className="bg-white rounded-xl p-4 flex gap-4 shadow-sm"
                  >
                    {/* Product Image */}
                    <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <ShoppingBag size={32} />
                        </div>
                      )}
                    </div>

                    {/* Product Details */}
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <div>
                          <h3 className="font-semibold text-[#2B3A4A]">{item.name}</h3>
                          <p className="text-sm text-gray-500">{item.size}</p>
                        </div>
                        <button
                          onClick={() => handleRemove(item.productId, item.size)}
                          disabled={removingItem === `${item.productId}-${item.size}`}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>

                      <div className="flex items-center justify-between mt-4">
                        {/* Quantity Controls */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleQuantityChange(item.productId, item.size, item.quantity - 1)}
                            className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:border-[#D4AF37] transition-colors"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="w-8 text-center font-semibold">{item.quantity}</span>
                          <button
                            onClick={() => handleQuantityChange(item.productId, item.size, item.quantity + 1)}
                            className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:border-[#D4AF37] transition-colors"
                          >
                            <Plus size={14} />
                          </button>
                        </div>

                        {/* Price */}
                        <p className="font-bold text-[#2B3A4A]">
                          ₹{(item.price * item.quantity).toLocaleString('en-IN')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Order Summary */}
              <div className="lg:col-span-1">
                <div className="bg-white rounded-xl p-6 shadow-sm sticky top-24">
                  <h2 className="text-lg font-semibold text-[#2B3A4A] mb-4">Order Summary</h2>
                  
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Subtotal</span>
                      <span className="font-semibold">₹{subtotal.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Shipping</span>
                      <span className={shipping === 0 ? 'text-green-600 font-semibold' : 'font-semibold'}>
                        {shipping === 0 ? 'FREE' : `₹${shipping}`}
                      </span>
                    </div>
                    {shipping > 0 && (
                      <p className="text-xs text-gray-500">
                        Add ₹{499 - subtotal} more for free shipping
                      </p>
                    )}
                    <hr className="my-4" />
                    <div className="flex justify-between text-lg">
                      <span className="font-semibold text-[#2B3A4A]">Total</span>
                      <span className="font-bold text-[#2B3A4A]">₹{total.toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  <Link
                    href="/checkout"
                    className="w-full mt-6 bg-[#2B3A4A] text-white py-4 rounded-lg font-semibold hover:bg-[#1a252f] transition-colors flex items-center justify-center gap-2"
                  >
                    Proceed to Checkout
                    <ArrowRight size={18} />
                  </Link>

                  <Link
                    href="/#fragrances"
                    className="w-full mt-3 text-center block text-sm text-[#D4AF37] hover:underline"
                  >
                    Continue Shopping
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#2B3A4A] text-white py-8 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-[#D4AF37] font-bold text-xl mb-2">Addrika</p>
          <p className="text-sm text-gray-400">© 2026 Centsibl Traders Private Limited</p>
        </div>
      </footer>
    </>
  );
}
