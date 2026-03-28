'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { X, Trash2, Minus, Plus, ShoppingBag, ArrowRight } from 'lucide-react';
import { useCart } from '../context/CartContext';

export default function CartSidebar() {
  const { cart, isCartOpen, setIsCartOpen, removeFromCart, updateQuantity, getCartTotal, getCartCount } = useCart();

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') setIsCartOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [setIsCartOpen]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isCartOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isCartOpen]);

  if (!isCartOpen) return null;

  const subtotal = getCartTotal();
  const itemCount = getCartCount();

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        onClick={() => setIsCartOpen(false)}
      />
      
      {/* Sidebar */}
      <div 
        className="fixed right-0 top-0 h-full w-full max-w-md z-50 flex flex-col"
        style={{ background: 'linear-gradient(180deg, #1a252f 0%, #0f1419 100%)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-[#D4AF37]" />
            <h2 className="text-lg font-semibold text-white">Your Cart</h2>
            {itemCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: '#D4AF37', color: '#1a1a2e' }}>
                {itemCount}
              </span>
            )}
          </div>
          <button 
            onClick={() => setIsCartOpen(false)}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <ShoppingBag className="w-16 h-16 text-gray-600 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Your cart is empty</h3>
              <p className="text-gray-400 mb-6">Add some items to get started!</p>
              <button
                onClick={() => setIsCartOpen(false)}
                className="px-6 py-3 rounded-xl font-semibold transition-all"
                style={{ 
                  background: 'linear-gradient(135deg, #D4AF37 0%, #c9a432 100%)',
                  color: '#1a1a2e'
                }}
              >
                Continue Shopping
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {cart.map((item) => (
                <div 
                  key={`${item.productId}-${item.size}`}
                  className="p-4 rounded-xl flex gap-4"
                  style={{ 
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}
                >
                  {/* Product Image */}
                  <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    {item.image && (
                      <img 
                        src={item.image} 
                        alt={item.name} 
                        className="w-full h-full object-contain p-1"
                      />
                    )}
                  </div>
                  
                  {/* Product Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-white text-sm truncate">{item.name}</h3>
                        <p className="text-xs text-gray-400">{item.size}</p>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.productId, item.size)}
                        className="p-1.5 rounded-lg hover:bg-red-500/20 transition-colors"
                      >
                        <Trash2 size={14} className="text-red-400" />
                      </button>
                    </div>
                    
                    <div className="flex items-center justify-between mt-3">
                      {/* Quantity Controls */}
                      <div className="flex items-center rounded-lg" style={{ border: '1px solid rgba(255,255,255,0.2)' }}>
                        <button
                          onClick={() => updateQuantity(item.productId, item.size, item.quantity - 1)}
                          className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="w-8 text-center text-sm font-medium text-white">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.productId, item.size, item.quantity + 1)}
                          className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                      
                      <p className="font-bold text-[#D4AF37]">₹{item.price * item.quantity}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {cart.length > 0 && (
          <div className="p-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
            {/* Subtotal */}
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-400">Subtotal</span>
              <span className="text-xl font-bold text-white">₹{subtotal}</span>
            </div>
            
            {subtotal < 499 && (
              <p className="text-xs text-gray-500 mb-4">
                Add ₹{499 - subtotal} more for free shipping
              </p>
            )}
            {subtotal >= 499 && (
              <p className="text-xs text-green-400 mb-4">
                You qualify for free shipping!
              </p>
            )}
            
            {/* Actions */}
            <div className="space-y-2">
              <Link
                href="/cart"
                onClick={() => setIsCartOpen(false)}
                className="w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all"
                style={{ 
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: 'white'
                }}
              >
                View Cart
              </Link>
              <Link
                href="/checkout"
                onClick={() => setIsCartOpen(false)}
                className="w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all"
                style={{ 
                  background: 'linear-gradient(135deg, #D4AF37 0%, #c9a432 100%)',
                  color: '#1a1a2e'
                }}
              >
                Checkout
                <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
