import React from 'react';
import { X, Plus, Minus, ShoppingBag, Trash2 } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { Button } from './ui/button';
import { useNavigate } from 'react-router-dom';
import { ThumbnailImage } from './OptimizedImage';

const ShoppingCart = () => {
  const {
    cart,
    isCartOpen,
    setIsCartOpen,
    updateQuantity,
    removeFromCart,
    getCartTotal,
    getBulkDiscount,
    getShippingTier,
    getFreeShippingThreshold
  } = useCart();

  const navigate = useNavigate();

  if (!isCartOpen) return null;

  const handleCheckout = () => {
    setIsCartOpen(false);
    navigate('/checkout');
  };

  const subtotal = getCartTotal();
  const bulkDiscount = getBulkDiscount();
  // Simplified shipping tiers
  // < ₹249: ₹149, ₹249-998: ₹49, ≥ ₹999: FREE
  const discountedValue = subtotal - bulkDiscount;
  const shippingTier = getShippingTier(discountedValue);

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/50 z-50"
        onClick={() => setIsCartOpen(false)}
        data-testid="cart-overlay"
      />
      
      {/* Cart Sidebar */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white z-50 shadow-2xl flex flex-col" data-testid="shopping-cart-drawer">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b" style={{ backgroundColor: 'var(--cream)' }}>
          <div className="flex items-center gap-2">
            <ShoppingBag size={24} style={{ color: 'var(--japanese-indigo)' }} />
            <h2 className="text-2xl font-bold" style={{ color: 'var(--japanese-indigo)' }}>
              Shopping Cart
            </h2>
          </div>
          <button
            onClick={() => setIsCartOpen(false)}
            className="p-2 hover:bg-white/50 rounded-full transition-colors"
            data-testid="close-cart-button"
          >
            <X size={24} style={{ color: 'var(--japanese-indigo)' }} />
          </button>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-6">
          {cart.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingBag size={64} className="mx-auto mb-4 opacity-20" />
              <p className="text-lg" style={{ color: 'var(--text-subtle)' }}>
                Your cart is empty
              </p>
              <Button
                onClick={() => {
                  setIsCartOpen(false);
                  document.getElementById('fragrances')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="mt-4"
                style={{ backgroundColor: 'var(--japanese-indigo)', color: 'white' }}
                data-testid="continue-shopping-button"
              >
                Continue Shopping
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {cart.map((item) => {
                const itemId = item.productId || item.id;
                return (
                  <div
                    key={`${itemId}-${item.size}`}
                    className="flex gap-4 p-4 border rounded-lg"
                    style={{ borderColor: 'var(--border)' }}
                    data-testid={`cart-item-${itemId}`}
                  >
                    <ThumbnailImage
                      src={item.image}
                      alt={item.name}
                      className="w-20 h-20 rounded overflow-hidden flex-shrink-0"
                    />
                    <div className="flex-1">
                      <h3 className="font-semibold" style={{ color: 'var(--text-dark)' }}>
                        {item.name}
                      </h3>
                      <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>
                        {item.subtitle} - {item.size}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="font-bold" style={{ color: 'var(--metallic-gold)' }}>
                          ₹{item.price}
                        </span>
                        <span className="text-sm line-through" style={{ color: 'var(--text-subtle)' }}>
                          ₹{item.mrp}
                        </span>
                        <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--metallic-gold)', color: 'white' }}>
                          {Math.round(((item.mrp - item.price) / item.mrp) * 100)}% OFF
                        </span>
                      </div>
                      
                      {/* Quantity Controls */}
                      <div className="flex items-center gap-2 mt-3">
                        <button
                          onClick={() => updateQuantity(itemId, item.size, item.quantity - 1)}
                          className="p-1 rounded hover:bg-gray-100"
                          data-testid={`decrease-qty-${itemId}`}
                        >
                          <Minus size={16} />
                        </button>
                        <span className="w-8 text-center font-semibold">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(itemId, item.size, item.quantity + 1)}
                          className="p-1 rounded hover:bg-gray-100"
                          data-testid={`increase-qty-${itemId}`}
                        >
                          <Plus size={16} />
                        </button>
                        <button
                          onClick={() => removeFromCart(itemId, item.size)}
                          className="ml-auto p-1 rounded hover:bg-red-50"
                          data-testid={`remove-item-${itemId}`}
                        >
                          <Trash2 size={16} color="red" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer - Summary */}
        {cart.length > 0 && (
          <div className="border-t p-6 space-y-3 flex-shrink-0" style={{ backgroundColor: 'var(--cream)' }}>
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-semibold">₹{subtotal.toFixed(2)}</span>
            </div>
            
            {bulkDiscount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Bulk Discount ({subtotal > 4999 ? '10' : '5'}%):</span>
                <span className="font-semibold">-₹{bulkDiscount.toFixed(2)}</span>
              </div>
            )}
            
            <div className="flex justify-between text-sm" style={{ color: 'var(--text-subtle)' }}>
              <span>Shipping:</span>
              <span>
                {shippingTier.charge === 0 ? (
                  <span className="text-green-600 font-medium">FREE</span>
                ) : (
                  <span>₹{shippingTier.charge}</span>
                )}
              </span>
            </div>
            
            {/* Shipping tier progress */}
            {shippingTier.charge === 149 && (
              <p className="text-xs text-center" style={{ color: 'var(--text-subtle)' }}>
                Add ₹{shippingTier.amountForNext?.toFixed(0)} more for reduced shipping (₹49)
              </p>
            )}
            {shippingTier.charge === 49 && (
              <p className="text-xs text-center" style={{ color: 'var(--text-subtle)' }}>
                Add ₹{shippingTier.amountForFree?.toFixed(0)} more for FREE shipping
              </p>
            )}
            {shippingTier.charge === 0 && (
              <p className="text-xs text-center text-green-600">
                ✓ You qualify for FREE shipping!
              </p>
            )}
            
            <div className="border-t pt-3 flex justify-between text-lg font-bold">
              <span>Estimated Total:</span>
              <span style={{ color: 'var(--metallic-gold)' }}>
                ₹{(discountedValue + shippingTier.charge).toFixed(2)}
              </span>
            </div>

            {subtotal > 2499 && (
              <p className="text-center text-sm py-2 rounded" style={{ backgroundColor: 'var(--metallic-gold)', color: 'white' }}>
                🎉 You're saving ₹{bulkDiscount.toFixed(2)} with {subtotal > 4999 ? '10%' : '5%'} bulk discount!
              </p>
            )}

            <Button
              onClick={handleCheckout}
              className="w-full text-white font-semibold py-6"
              style={{ backgroundColor: 'var(--japanese-indigo)' }}
              data-testid="proceed-to-checkout-button"
            >
              Proceed to Checkout
            </Button>
          </div>
        )}
      </div>
    </>
  );
};

export default ShoppingCart;
