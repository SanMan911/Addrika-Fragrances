import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, ShoppingCart } from 'lucide-react';
import { Button } from './ui/button';

/**
 * ImageGalleryModal - Displays product images in a "playing cards" fan style
 * with manual cycling and fixed Add to Cart button
 * 
 * TEST FEATURE - Can be rolled back
 */
const ImageGalleryModal = ({ 
  isOpen, 
  onClose, 
  images, 
  productName, 
  size, 
  price, 
  mrp,
  onAddToCart 
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  // Reset index when modal opens with new images
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0);
    }
  }, [isOpen, images]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, images]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen || !images || images.length === 0) return null;

  const handlePrev = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    setTimeout(() => setIsAnimating(false), 300);
  };

  const handleNext = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setCurrentIndex((prev) => (prev + 1) % images.length);
    setTimeout(() => setIsAnimating(false), 300);
  };

  const handleAddToCart = () => {
    onAddToCart();
    onClose();
  };

  // Calculate card positions for "playing cards" fan effect
  const getCardStyle = (index) => {
    const totalCards = images.length;
    const offset = index - currentIndex;
    
    // Wrap around for circular navigation
    let adjustedOffset = offset;
    if (Math.abs(offset) > totalCards / 2) {
      adjustedOffset = offset > 0 ? offset - totalCards : offset + totalCards;
    }
    
    const isActive = index === currentIndex;
    const rotation = adjustedOffset * 8; // degrees of rotation
    const translateX = adjustedOffset * 60; // horizontal spread
    const translateY = Math.abs(adjustedOffset) * 15; // slight vertical offset
    const scale = isActive ? 1 : 0.85 - Math.abs(adjustedOffset) * 0.05;
    const zIndex = totalCards - Math.abs(adjustedOffset);
    const opacity = isActive ? 1 : Math.max(0.3, 0.8 - Math.abs(adjustedOffset) * 0.2);

    return {
      transform: `translateX(${translateX}px) translateY(${translateY}px) rotate(${rotation}deg) scale(${scale})`,
      zIndex,
      opacity,
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      cursor: isActive ? 'default' : 'pointer',
    };
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-4xl mx-4 flex flex-col items-center">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute -top-12 right-0 text-white/80 hover:text-white transition-colors z-50"
          data-testid="close-gallery-modal"
        >
          <X size={32} />
        </button>

        {/* Product Info Header */}
        <div className="text-center mb-8 text-white">
          <h2 className="text-2xl sm:text-3xl font-bold mb-2" style={{ fontFamily: "'Exo', sans-serif" }}>
            {productName}
          </h2>
          <div className="flex items-center justify-center gap-3">
            <span 
              className="px-4 py-1 rounded-full text-sm font-bold"
              style={{ backgroundColor: 'var(--metallic-gold)', color: 'white' }}
            >
              {size}
            </span>
            <span className="text-gray-400 line-through">₹{mrp}</span>
            <span className="text-xl font-bold" style={{ color: 'var(--metallic-gold)' }}>₹{price}</span>
          </div>
        </div>

        {/* Playing Cards Image Display */}
        <div className="relative h-[400px] sm:h-[500px] w-full flex items-center justify-center mb-8">
          {/* Navigation Arrows */}
          {images.length > 1 && (
            <>
              <button
                onClick={handlePrev}
                className="absolute left-4 sm:left-8 z-50 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all"
                data-testid="gallery-prev"
              >
                <ChevronLeft size={28} />
              </button>
              <button
                onClick={handleNext}
                className="absolute right-4 sm:right-8 z-50 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all"
                data-testid="gallery-next"
              >
                <ChevronRight size={28} />
              </button>
            </>
          )}

          {/* Cards Container */}
          <div className="relative flex items-center justify-center">
            {images.map((img, index) => (
              <div
                key={index}
                className="absolute w-64 sm:w-80 h-80 sm:h-96 rounded-2xl overflow-hidden shadow-2xl bg-white"
                style={getCardStyle(index)}
                onClick={() => {
                  if (index !== currentIndex) {
                    setCurrentIndex(index);
                  }
                }}
              >
                <img
                  src={img}
                  alt={`${productName} ${size} - Image ${index + 1}`}
                  className="w-full h-full object-contain p-4"
                  style={{ 
                    filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.1))',
                    backgroundColor: '#f8f6f3'
                  }}
                  draggable={false}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Image Counter */}
        {images.length > 1 && (
          <div className="flex items-center gap-3 mb-6">
            {images.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  index === currentIndex
                    ? 'w-8 bg-amber-500'
                    : 'bg-white/30 hover:bg-white/50'
                }`}
                data-testid={`gallery-dot-${index}`}
              />
            ))}
          </div>
        )}

        {/* Fixed Add to Cart Button */}
        <Button
          onClick={handleAddToCart}
          className="w-full max-w-md text-white font-semibold py-6 text-lg flex items-center justify-center gap-3 rounded-xl shadow-lg hover:shadow-xl transition-all"
          style={{ backgroundColor: 'var(--japanese-indigo)' }}
          data-testid="gallery-add-to-cart"
        >
          <ShoppingCart size={24} />
          Add {size} to Cart - ₹{price}
        </Button>
      </div>
    </div>
  );
};

export default ImageGalleryModal;
