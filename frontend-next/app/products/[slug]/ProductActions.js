'use client';

import { useState } from 'react';
import { ShoppingCart, Heart, Plus, Minus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useCart } from '../../../context/CartContext';
import { useWishlist } from '../../../context/WishlistContext';

export default function ProductActions({ product }) {
  const [selectedSize, setSelectedSize] = useState(product.sizes[0]);
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  
  const { addToCart } = useCart();
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();
  
  const inWishlist = isInWishlist(product.id, selectedSize?.size);

  const handleAddToCart = async () => {
    if (!selectedSize) {
      toast.error('Please select a size');
      return;
    }
    
    setAddingToCart(true);
    
    try {
      await addToCart({
        id: product.id,
        name: product.name,
        image: product.image,
        tagline: product.tagline,
      }, selectedSize.size, quantity);
      
      toast.success(`${product.name} (${selectedSize.size}) added to cart!`);
    } catch (error) {
      toast.error('Failed to add to cart');
    } finally {
      setAddingToCart(false);
    }
  };

  const handleWishlistToggle = async () => {
    try {
      if (inWishlist) {
        await removeFromWishlist(product.id, selectedSize?.size);
        toast.success('Removed from wishlist');
      } else {
        await addToWishlist(product, selectedSize?.size);
        toast.success('Added to wishlist');
      }
    } catch (error) {
      toast.error('Wishlist update failed');
    }
  };

  return (
    <div className="space-y-6">
      {/* Size Selection */}
      <div>
        <h3 className="text-sm font-semibold mb-3 uppercase tracking-wide text-gray-400">
          Select Size
        </h3>
        <div className="flex flex-wrap gap-3">
          {product.sizes.map((size) => (
            <button
              key={size.size}
              onClick={() => setSelectedSize(size)}
              className={`px-6 py-3 rounded-lg border-2 transition-all ${
                selectedSize?.size === size.size
                  ? 'border-[#D4AF37] bg-[#D4AF37]/20'
                  : 'border-gray-600 hover:border-[#D4AF37]'
              }`}
              data-testid={`size-${size.size}`}
            >
              <span className="font-semibold block text-white">{size.size}</span>
              <span className="text-lg font-bold text-[#D4AF37]">₹{size.price}</span>
              {size.mrp > size.price && (
                <span className="text-xs text-gray-500 line-through ml-1">₹{size.mrp}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Quantity */}
      <div>
        <h3 className="text-sm font-semibold mb-3 uppercase tracking-wide text-gray-400">
          Quantity
        </h3>
        <div className="flex items-center gap-4">
          <div 
            className="flex items-center rounded-lg"
            style={{ border: '1px solid rgba(255,255,255,0.2)' }}
          >
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="p-3 hover:bg-white/10 rounded-l-lg transition-colors"
              disabled={quantity <= 1}
              data-testid="decrease-qty"
            >
              <Minus size={18} className="text-white" />
            </button>
            <span className="px-6 py-3 font-semibold min-w-[60px] text-center text-white">
              {quantity}
            </span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="p-3 hover:bg-white/10 rounded-r-lg transition-colors"
              data-testid="increase-qty"
            >
              <Plus size={18} className="text-white" />
            </button>
          </div>
          
          {selectedSize && (
            <div className="text-right">
              <span className="text-sm text-gray-400 block">Total</span>
              <span className="text-2xl font-bold text-[#D4AF37]">
                ₹{selectedSize.price * quantity}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4 pt-4">
        <button
          onClick={handleAddToCart}
          disabled={addingToCart || !selectedSize}
          className="flex-1 py-4 px-6 text-lg font-semibold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ 
            background: 'linear-gradient(135deg, #D4AF37 0%, #c9a432 100%)',
            color: '#1a1a2e',
            boxShadow: '0 8px 30px rgba(212,175,55,0.3)'
          }}
          data-testid="add-to-cart-btn"
        >
          {addingToCart ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <ShoppingCart className="w-5 h-5" />
          )}
          Add to Cart
        </button>
        
        <button
          onClick={handleWishlistToggle}
          className="py-4 px-6 rounded-xl transition-all flex items-center justify-center gap-2"
          style={{ 
            border: inWishlist ? '2px solid #D4AF37' : '2px solid rgba(255,255,255,0.3)',
            color: inWishlist ? '#D4AF37' : 'white',
            background: inWishlist ? 'rgba(212,175,55,0.1)' : 'transparent'
          }}
          data-testid="wishlist-btn"
        >
          <Heart 
            className="w-5 h-5" 
            fill={inWishlist ? '#D4AF37' : 'transparent'}
          />
          <span className="hidden sm:inline">{inWishlist ? 'In Wishlist' : 'Add to Wishlist'}</span>
        </button>
      </div>
      
      {/* Pickup/Delivery Options */}
      <div 
        className="p-4 rounded-xl"
        style={{ 
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)'
        }}
      >
        <p className="text-sm text-gray-400">
          🚚 <span className="text-white font-medium">Free Delivery</span> on orders above ₹499
        </p>
        <p className="text-sm text-gray-400 mt-1">
          📦 <span className="text-white font-medium">Store Pickup</span> available at select locations
        </p>
      </div>
    </div>
  );
}
