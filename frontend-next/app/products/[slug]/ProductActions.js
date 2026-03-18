'use client';

import { useState } from 'react';
import { ShoppingCart, Heart, Plus, Minus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ProductActions({ product }) {
  const [selectedSize, setSelectedSize] = useState(product.sizes[0]);
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const [inWishlist, setInWishlist] = useState(false);

  const handleAddToCart = async () => {
    if (!selectedSize) {
      toast.error('Please select a size');
      return;
    }
    
    setAddingToCart(true);
    
    // Simulate adding to cart (replace with actual cart logic)
    await new Promise(resolve => setTimeout(resolve, 500));
    
    toast.success(`${product.name} (${selectedSize.size}) added to cart!`);
    setAddingToCart(false);
  };

  const handleWishlistToggle = () => {
    setInWishlist(!inWishlist);
    toast.success(inWishlist ? 'Removed from wishlist' : 'Added to wishlist');
  };

  return (
    <div className="space-y-6">
      {/* Size Selection */}
      <div>
        <h3 className="text-sm font-semibold mb-3 uppercase tracking-wide text-gray-500">
          Select Size
        </h3>
        <div className="flex flex-wrap gap-3">
          {product.sizes.map((size) => (
            <button
              key={size.size}
              onClick={() => setSelectedSize(size)}
              className={`px-6 py-3 rounded-lg border-2 transition-all ${
                selectedSize?.size === size.size
                  ? 'border-[#D4AF37] bg-[#D4AF37]/10'
                  : 'border-gray-300 hover:border-[#D4AF37]'
              }`}
              data-testid={`size-${size.size}`}
            >
              <span className="font-semibold block text-[#2B3A4A]">{size.size}</span>
              <span className="text-lg font-bold text-[#2B3A4A]">₹{size.mrp}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Quantity */}
      <div>
        <h3 className="text-sm font-semibold mb-3 uppercase tracking-wide text-gray-500">
          Quantity
        </h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center border border-gray-300 rounded-lg">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="p-3 hover:bg-gray-100 rounded-l-lg transition-colors"
              disabled={quantity <= 1}
              data-testid="decrease-qty"
            >
              <Minus size={18} className="text-[#2B3A4A]" />
            </button>
            <span className="px-6 py-3 font-semibold min-w-[60px] text-center text-[#2B3A4A]">
              {quantity}
            </span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="p-3 hover:bg-gray-100 rounded-r-lg transition-colors"
              data-testid="increase-qty"
            >
              <Plus size={18} className="text-[#2B3A4A]" />
            </button>
          </div>
          
          {selectedSize && (
            <span className="text-lg font-bold text-[#2B3A4A]">
              Total: ₹{selectedSize.mrp * quantity}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4 pt-4">
        <button
          onClick={handleAddToCart}
          disabled={addingToCart || !selectedSize}
          className="flex-1 py-4 px-6 text-lg font-semibold text-white bg-[#2B3A4A] rounded-lg hover:bg-[#1a252f] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
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
          className={`py-4 px-6 rounded-lg border-2 transition-colors ${
            inWishlist 
              ? 'border-[#D4AF37] text-[#D4AF37]' 
              : 'border-gray-300 text-[#2B3A4A] hover:border-[#D4AF37]'
          }`}
          data-testid="wishlist-btn"
        >
          <Heart 
            className="w-5 h-5" 
            fill={inWishlist ? '#D4AF37' : 'transparent'}
          />
        </button>
      </div>
    </div>
  );
}
