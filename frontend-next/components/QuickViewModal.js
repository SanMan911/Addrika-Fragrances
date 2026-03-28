'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { X, Minus, Plus, Star, ShoppingCart, Heart, ExternalLink, Loader2 } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { toast } from 'sonner';

export default function QuickViewModal({ product, isOpen, onClose }) {
  const { addToCart } = useCart();
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();
  
  const [selectedSize, setSelectedSize] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [addingToCart, setAddingToCart] = useState(false);

  // Reset state when product changes
  useEffect(() => {
    if (product && isOpen) {
      setSelectedSize(product.sizes?.[0] || null);
      setQuantity(1);
      setCurrentImageIndex(0);
    }
  }, [product, isOpen]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen || !product) return null;

  // Get all images
  const allImages = [];
  product.sizes?.forEach(size => {
    if (size.images?.length > 0) {
      size.images.forEach(img => {
        if (!allImages.includes(img)) allImages.push(img);
      });
    }
  });
  if (allImages.length === 0 && product.image) {
    allImages.push(product.image);
  }

  const totalPrice = selectedSize ? selectedSize.price * quantity : 0;
  const isWishlisted = selectedSize ? isInWishlist(product.id, selectedSize.size) : false;

  const handleAddToCart = async () => {
    if (!selectedSize) {
      toast.error('Please select a size');
      return;
    }
    
    setAddingToCart(true);
    
    try {
      addToCart({
        id: product.id,
        name: product.name,
        image: product.image,
        tagline: product.tagline,
        sizes: product.sizes,
      }, selectedSize.size, quantity);
      
      toast.success(`${product.name} (${selectedSize.size}) added to cart!`);
      onClose();
    } catch (error) {
      toast.error('Failed to add to cart');
    } finally {
      setAddingToCart(false);
    }
  };

  const handleWishlistToggle = async () => {
    if (!selectedSize) return;
    
    try {
      if (isWishlisted) {
        await removeFromWishlist(product.id, selectedSize.size);
      } else {
        await addToWishlist(product, selectedSize.size);
      }
    } catch (error) {
      console.error('Wishlist error:', error);
    }
  };

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div 
          className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl pointer-events-auto"
          style={{ 
            background: 'linear-gradient(165deg, #1a252f 0%, #0f1419 100%)',
            border: '1px solid rgba(255,255,255,0.1)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full flex items-center justify-center transition-colors"
            style={{ background: 'rgba(255,255,255,0.1)' }}
            data-testid="quick-view-close"
          >
            <X className="w-5 h-5 text-white" />
          </button>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
            {/* Image Section */}
            <div className="relative p-6 md:p-8" style={{ background: 'rgba(0,0,0,0.2)' }}>
              <div className="aspect-square rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <img
                  src={allImages[currentImageIndex] || product.image}
                  alt={product.name}
                  className="w-full h-full object-contain p-4"
                />
              </div>
              
              {/* Image Thumbnails */}
              {allImages.length > 1 && (
                <div className="flex gap-2 mt-4 justify-center">
                  {allImages.slice(0, 5).map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentImageIndex(idx)}
                      className="w-16 h-16 rounded-lg overflow-hidden transition-all"
                      style={{ 
                        border: idx === currentImageIndex ? '2px solid #D4AF37' : '2px solid transparent',
                        background: 'rgba(255,255,255,0.05)',
                        opacity: idx === currentImageIndex ? 1 : 0.6
                      }}
                    >
                      <img src={img} alt="" className="w-full h-full object-contain p-1" />
                    </button>
                  ))}
                </div>
              )}

              {/* Zero Charcoal Badge */}
              <div 
                className="absolute top-8 left-8 px-3 py-1.5 rounded-full text-xs font-bold"
                style={{ 
                  background: 'linear-gradient(135deg, rgba(16,185,129,0.95) 0%, rgba(5,150,105,0.95) 100%)',
                  color: 'white'
                }}
              >
                Zero Charcoal
              </div>
            </div>

            {/* Details Section */}
            <div className="p-6 md:p-8 flex flex-col">
              {/* Category */}
              <span className="text-sm font-medium mb-2" style={{ color: '#D4AF37' }}>
                {product.category || 'Sacred Luxury Blend'}
              </span>
              
              {/* Product Name */}
              <h2 
                className="text-2xl md:text-3xl font-bold text-white mb-2"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                {product.name}
              </h2>
              
              {/* Rating */}
              <div className="flex items-center gap-2 mb-4">
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      size={16}
                      className={star <= Math.round(product.rating || 4.5) ? 'fill-[#D4AF37] text-[#D4AF37]' : 'text-gray-600'}
                    />
                  ))}
                </div>
                <span className="text-sm text-gray-400">
                  {product.rating || 4.5} ({product.reviewCount || product.reviews || 0} reviews)
                </span>
              </div>
              
              {/* Description */}
              <p className="text-gray-400 text-sm mb-6 line-clamp-3">
                {product.tagline || product.description || 'A premium blend crafted with 100% natural ingredients for a pure, low-smoke experience.'}
              </p>
              
              {/* Fragrance Notes */}
              {product.notes && product.notes.length > 0 && (
                <div className="mb-6">
                  <span className="text-xs text-gray-500 uppercase tracking-wider">Fragrance Notes</span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {product.notes.map((note, idx) => (
                      <span 
                        key={idx}
                        className="px-3 py-1 rounded-full text-xs"
                        style={{ 
                          background: 'rgba(212,175,55,0.1)',
                          color: '#D4AF37',
                          border: '1px solid rgba(212,175,55,0.2)'
                        }}
                      >
                        {note}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Size Selection */}
              <div className="mb-6">
                <span className="text-sm font-medium text-white mb-3 block">SELECT SIZE</span>
                <div className="flex gap-3">
                  {product.sizes?.map((size) => (
                    <button
                      key={size.size}
                      onClick={() => setSelectedSize(size)}
                      className="px-4 py-3 rounded-xl transition-all text-center min-w-[80px]"
                      style={{
                        background: selectedSize?.size === size.size 
                          ? 'linear-gradient(135deg, rgba(212,175,55,0.2) 0%, rgba(212,175,55,0.1) 100%)'
                          : 'rgba(255,255,255,0.05)',
                        border: selectedSize?.size === size.size 
                          ? '2px solid #D4AF37' 
                          : '2px solid rgba(255,255,255,0.1)',
                        color: selectedSize?.size === size.size ? '#D4AF37' : 'white'
                      }}
                      data-testid={`quick-view-size-${size.size}`}
                    >
                      <span className="block font-semibold">{size.size}</span>
                      <span className="block text-sm opacity-80">₹{size.price}</span>
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Quantity & Total */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <span className="text-sm font-medium text-white mb-2 block">QUANTITY</span>
                  <div 
                    className="flex items-center rounded-xl"
                    style={{ border: '1px solid rgba(255,255,255,0.2)' }}
                  >
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                      data-testid="quick-view-qty-decrease"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="w-12 text-center font-semibold text-white">{quantity}</span>
                    <button
                      onClick={() => setQuantity(quantity + 1)}
                      className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                      data-testid="quick-view-qty-increase"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
                
                <div className="text-right">
                  <span className="text-sm text-gray-500 block">Total</span>
                  <span className="text-2xl font-bold text-[#D4AF37]">₹{totalPrice}</span>
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex gap-3 mt-auto">
                <button
                  onClick={handleAddToCart}
                  disabled={addingToCart || !selectedSize}
                  className="flex-1 py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  style={{ 
                    background: 'linear-gradient(135deg, #D4AF37 0%, #c9a432 100%)',
                    color: '#1a1a2e'
                  }}
                  data-testid="quick-view-add-to-cart"
                >
                  {addingToCart ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <ShoppingCart size={18} />
                      Add to Cart
                    </>
                  )}
                </button>
                
                <button
                  onClick={handleWishlistToggle}
                  className="w-14 h-14 rounded-xl flex items-center justify-center transition-all"
                  style={{ 
                    background: isWishlisted ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)',
                    border: isWishlisted ? '1px solid rgba(239,68,68,0.5)' : '1px solid rgba(255,255,255,0.1)'
                  }}
                  data-testid="quick-view-wishlist"
                >
                  <Heart 
                    size={20} 
                    className={isWishlisted ? 'fill-red-500 text-red-500' : 'text-white'}
                  />
                </button>
              </div>
              
              {/* View Full Details Link */}
              <Link
                href={`/products/${product.id}`}
                onClick={onClose}
                className="flex items-center justify-center gap-2 mt-4 text-sm text-gray-400 hover:text-[#D4AF37] transition-colors"
                data-testid="quick-view-full-details"
              >
                View Full Details
                <ExternalLink size={14} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
