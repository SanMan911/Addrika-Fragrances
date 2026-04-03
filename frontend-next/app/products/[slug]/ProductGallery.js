'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function ProductGallery({ product, initialSizeIndex = 0 }) {
  const [selectedSizeIndex, setSelectedSizeIndex] = useState(initialSizeIndex);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  // Get images for the currently selected size
  const selectedSize = product.sizes[selectedSizeIndex];
  const images = selectedSize?.images?.length > 0 
    ? selectedSize.images 
    : [product.image];
  
  // Reset image index when size changes
  useEffect(() => {
    setCurrentImageIndex(0);
  }, [selectedSizeIndex]);

  // Listen for size changes from ProductActions via custom event
  useEffect(() => {
    const handleSizeChange = (event) => {
      const newSizeIndex = product.sizes.findIndex(s => s.size === event.detail.size);
      if (newSizeIndex !== -1) {
        setSelectedSizeIndex(newSizeIndex);
      }
    };
    
    window.addEventListener('product-size-change', handleSizeChange);
    return () => window.removeEventListener('product-size-change', handleSizeChange);
  }, [product.sizes]);

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  return (
    <div className="space-y-4">
      {/* Main Image */}
      <div 
        className="relative aspect-square rounded-2xl overflow-hidden"
        style={{ 
          background: 'linear-gradient(165deg, #1a1a2e 0%, #16213e 100%)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)'
        }}
      >
        <Image
          src={images[currentImageIndex]}
          alt={`${product.name} - ${selectedSize?.size || ''}`}
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-contain p-8"
        />
        
        {/* Navigation Arrows - only show if multiple images */}
        {images.length > 1 && (
          <>
            <button
              onClick={prevImage}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center transition-colors"
              aria-label="Previous image"
            >
              <ChevronLeft className="w-6 h-6 text-white" />
            </button>
            <button
              onClick={nextImage}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center transition-colors"
              aria-label="Next image"
            >
              <ChevronRight className="w-6 h-6 text-white" />
            </button>
          </>
        )}
        
        {/* Image Counter */}
        {images.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/50 text-white text-sm">
            {currentImageIndex + 1} / {images.length}
          </div>
        )}
      </div>
      
      {/* Thumbnail Strip - only show if multiple images */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {images.map((img, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentImageIndex(idx)}
              className={`relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 transition-all ${
                currentImageIndex === idx 
                  ? 'ring-2 ring-[#D4AF37] ring-offset-2 ring-offset-[#0f1419]' 
                  : 'opacity-60 hover:opacity-100'
              }`}
            >
              <Image
                src={img}
                alt={`${product.name} thumbnail ${idx + 1}`}
                fill
                sizes="80px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
      
      {/* Size indicator */}
      <p className="text-sm text-gray-400 text-center">
        Showing images for: <span className="text-[#D4AF37] font-medium">{selectedSize?.sizeLabel || selectedSize?.size}</span>
      </p>
    </div>
  );
}
