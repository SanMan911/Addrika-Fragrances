import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchProducts } from '../services/productService';
import { CheckCircle, ShoppingCart, Star, Quote, Images, Plus, Minus, Heart, Loader2, AlertCircle, ExternalLink } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { Button } from './ui/button';
import ImageGalleryModal from './ImageGalleryModal';
import FragranceFilter from './FragranceFilter';
import ScentPyramid from './ScentPyramid';
import ShippingInfoBanner from './ShippingInfoBanner';
import { ProductImage } from './OptimizedImage';
// DeliveryEstimate removed from individual products - now using FloatingDeliveryChecker globally

// Recently Viewed storage key
const STORAGE_KEY = 'addrika_recently_viewed';
const MAX_ITEMS = 6;

const addToRecentlyViewed = (product) => {
  if (!product || !product.id) return;
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    let items = stored ? JSON.parse(stored) : [];
    // Remove if already exists
    items = items.filter(p => p.id !== product.id);
    // Add to beginning with sizes data for Quick Add functionality
    items.unshift({
      id: product.id,
      name: product.name,
      subtitle: product.subtitle,
      image: product.image,
      color: product.color,
      sizes: product.sizes, // Include sizes for correct pricing in Quick Add
      viewedAt: new Date().toISOString()
    });
    // Limit to max items
    items = items.slice(0, MAX_ITEMS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.error('Error saving recently viewed:', e);
  }
};

const FragranceGrid = () => {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { addToWishlist, isInWishlist, removeFromWishlist } = useWishlist();
  
  // Product data state - fetched from API
  const [fragrances, setFragrances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [selectedSizes, setSelectedSizes] = useState({});
  const [imageIndices, setImageIndices] = useState({});
  const [quantities, setQuantities] = useState({}); // Track quantities for each product
  const [hoveredSize, setHoveredSize] = useState({}); // Track which size is being hovered
  const [addedToCart, setAddedToCart] = useState({}); // Track recently added items for feedback
  const [wishlistLoading, setWishlistLoading] = useState({}); // Track wishlist button loading state
  const [activeFilters, setActiveFilters] = useState({}); // Track active filters
  const [expandedPyramid, setExpandedPyramid] = useState({}); // Track which scent pyramids are expanded
  
  // Fetch products from API on mount
  useEffect(() => {
    const loadProducts = async () => {
      try {
        setLoading(true);
        setError(null);
        const products = await fetchProducts();
        setFragrances(products);
      } catch (err) {
        console.error('Failed to load products:', err);
        setError('Failed to load products. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    loadProducts();
  }, []);
  
  // Filter fragrances based on active filters
  const filteredFragrances = useMemo(() => {
    const hasFilters = Object.values(activeFilters).some(arr => arr?.length > 0);
    if (!hasFilters) return fragrances;
    
    return fragrances.filter(fragrance => {
      // Check mood filter
      if (activeFilters.mood?.length > 0) {
        const matchesMood = activeFilters.mood.some(m => fragrance.mood?.includes(m));
        if (!matchesMood) return false;
      }
      
      // Check notes filter
      if (activeFilters.notes?.length > 0) {
        const matchesNotes = activeFilters.notes.some(n => fragrance.notes?.includes(n));
        if (!matchesNotes) return false;
      }
      
      // Check intensity filter
      if (activeFilters.intensity?.length > 0) {
        const matchesIntensity = activeFilters.intensity.includes(fragrance.intensity);
        if (!matchesIntensity) return false;
      }
      
      return true;
    });
  }, [activeFilters, fragrances]);
  
  // Modal state for image gallery - keep for potential future use but don't auto-open
  const [galleryModal, setGalleryModal] = useState({
    isOpen: false,
    images: [],
    productName: '',
    size: '',
    price: 0,
    mrp: 0,
    fragranceId: null
  });

  // Initialize random image indices on mount and rotate images every 4 seconds
  useEffect(() => {
    // Only run when fragrances are loaded
    if (fragrances.length === 0) return;
    
    // Initialize with random starting indices for each product
    const initialIndices = {};
    fragrances.forEach(fragrance => {
      const currentSize = selectedSizes[fragrance.id] || fragrance.sizes[0]?.size;
      const sizeData = fragrance.sizes.find(s => s.size === currentSize);
      const images = sizeData?.images || [];
      if (images.length > 0) {
        initialIndices[fragrance.id] = Math.floor(Math.random() * images.length);
      }
    });
    setImageIndices(initialIndices);

    // Set up interval to rotate images every 2 seconds
    const interval = setInterval(() => {
      setImageIndices(prev => {
        const newIndices = { ...prev };
        fragrances.forEach(fragrance => {
          const currentSize = selectedSizes[fragrance.id] || fragrance.sizes[0]?.size;
          const sizeData = fragrance.sizes.find(s => s.size === currentSize);
          const images = sizeData?.images || [];
          if (images.length > 1) {
            // Move to next image (with wrap-around)
            newIndices[fragrance.id] = ((prev[fragrance.id] || 0) + 1) % images.length;
          }
        });
        return newIndices;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [selectedSizes, fragrances]);

  // Handle size hover - change image to that size's image
  const handleSizeHover = (fragranceId, size) => {
    setHoveredSize(prev => ({ ...prev, [fragranceId]: size }));
    
    // Get the images for the hovered size
    const fragrance = fragrances.find(f => f.id === fragranceId);
    const sizeData = fragrance?.sizes.find(s => s.size === size);
    const images = sizeData?.images || [];
    
    if (images.length > 0) {
      setImageIndices(prev => ({
        ...prev,
        [fragranceId]: 0 // Show first image of hovered size
      }));
    }
  };
  
  // Handle size hover end
  const handleSizeHoverEnd = (fragranceId) => {
    setHoveredSize(prev => ({ ...prev, [fragranceId]: null }));
    
    // Reset to selected size's image
    const fragrance = fragrances.find(f => f.id === fragranceId);
    const currentSize = selectedSizes[fragranceId] || fragrance.sizes[0]?.size;
    const sizeData = fragrance?.sizes.find(s => s.size === currentSize);
    const images = sizeData?.images || [];
    
    if (images.length > 0) {
      setImageIndices(prev => ({
        ...prev,
        [fragranceId]: Math.floor(Math.random() * images.length)
      }));
    }
  };

  // Handle size click - ONLY select size, do NOT add to cart
  const handleSizeClick = (fragranceId, size) => {
    setSelectedSizes(prev => ({ ...prev, [fragranceId]: size }));
    
    // Reset image index to first image of selected size
    const fragrance = fragrances.find(f => f.id === fragranceId);
    const sizeData = fragrance?.sizes.find(s => s.size === size);
    const images = sizeData?.images || [];
    
    if (images.length > 0) {
      setImageIndices(prev => ({
        ...prev,
        [fragranceId]: 0
      }));
    }
  };
  
  // Handle quantity change
  const handleQuantityChange = (fragranceId, delta) => {
    setQuantities(prev => {
      const current = prev[fragranceId] || 1;
      const newQty = Math.max(1, Math.min(99, current + delta));
      return { ...prev, [fragranceId]: newQty };
    });
  };
  
  // Close gallery modal
  const closeGalleryModal = () => {
    setGalleryModal(prev => ({ ...prev, isOpen: false }));
  };
  
  // Add to cart from gallery modal
  const handleGalleryAddToCart = () => {
    const fragrance = fragrances.find(f => f.id === galleryModal.fragranceId);
    if (fragrance) {
      const quantity = quantities[galleryModal.fragranceId] || 1;
      addToCart(fragrance, galleryModal.size, quantity);
      addToRecentlyViewed(fragrance);
    }
  };

  const handleAddToCart = (fragrance) => {
    const size = selectedSizes[fragrance.id] || fragrance.sizes[0]?.size || '200g';
    const quantity = quantities[fragrance.id] || 1;
    addToCart(fragrance, size, quantity);
    // Also add to recently viewed
    addToRecentlyViewed(fragrance);
    
    // Show feedback
    setAddedToCart(prev => ({ ...prev, [fragrance.id]: true }));
    setTimeout(() => {
      setAddedToCart(prev => ({ ...prev, [fragrance.id]: false }));
    }, 2000);
  };

  const handleProductClick = (fragrance) => {
    // Add to recently viewed on any interaction
    addToRecentlyViewed(fragrance);
  };

  // Handle wishlist toggle
  const handleWishlistToggle = async (fragrance) => {
    const size = selectedSizes[fragrance.id] || fragrance.sizes[0]?.size;
    const sizeData = fragrance.sizes.find(s => s.size === size);
    const key = `${fragrance.id}-${size}`;
    
    setWishlistLoading(prev => ({ ...prev, [key]: true }));
    
    if (isInWishlist(fragrance.id, size)) {
      await removeFromWishlist(fragrance.id, size);
    } else {
      await addToWishlist({
        productId: fragrance.id,
        name: fragrance.name,
        size: size,
        price: sizeData?.mrp || sizeData?.price,
        mrp: sizeData?.mrp || sizeData?.price,
        image: fragrance.image
      });
    }
    
    setWishlistLoading(prev => ({ ...prev, [key]: false }));
  };

  return (
    <section 
      id="fragrances" 
      className="py-20 sm:py-32 relative"
      style={{ 
        background: 'var(--section-bg-gradient, linear-gradient(180deg, #ffffff 0%, #faf8f5 30%, #f5f0e8 100%))'
      }}
    >
      {/* Add dark mode CSS variable override */}
      <style>{`
        .dark #fragrances {
          --section-bg-gradient: linear-gradient(180deg, #1e293b 0%, #0f172a 100%) !important;
        }
      `}</style>
      {/* Subtle decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full opacity-[0.03] blur-3xl"
          style={{ backgroundColor: 'var(--metallic-gold)' }}
        />
        <div 
          className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full opacity-[0.04] blur-3xl"
          style={{ backgroundColor: 'var(--japanese-indigo)' }}
        />
      </div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Section Header */}
        <div className="text-center mb-10">
          <h2 
            className="text-4xl sm:text-5xl font-bold mb-6 font-serif"
            style={{ color: 'var(--japanese-indigo)' }}
            data-testid="incense-section-title"
          >
            Premium Incense Collection
          </h2>
          <p 
            className="text-lg sm:text-xl max-w-3xl mx-auto mb-8"
            style={{ color: 'var(--text-subtle)' }}
          >
            Four exquisite aromatic blends with 40+ minute burn time. Each natural incense is carefully crafted with premium ingredients—perfect for home aromatherapy and sacred spaces
          </p>
          
          {/* Shipping Info Banner */}
          <div className="max-w-xl mx-auto mb-6">
            <ShippingInfoBanner compact={false} />
          </div>
        </div>
        
        {/* Fragrance Filter */}
        <FragranceFilter 
          onFilterChange={setActiveFilters}
          activeFilters={activeFilters}
        />
        
        {/* Loading State */}
        {loading && (
          <div className="py-20 text-center">
            <Loader2 className="w-12 h-12 mx-auto animate-spin" style={{ color: 'var(--metallic-gold)' }} />
            <p className="mt-4 text-lg" style={{ color: 'var(--text-subtle)' }}>Loading fragrances...</p>
          </div>
        )}
        
        {/* Error State */}
        {error && !loading && (
          <div className="py-20 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
            <p className="text-lg text-red-600 mb-4">{error}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="px-6 py-2 rounded-lg text-white"
              style={{ backgroundColor: 'var(--japanese-indigo)' }}
            >
              Try Again
            </button>
          </div>
        )}
        
        {/* Filter Results Count */}
        {!loading && !error && Object.values(activeFilters).some(arr => arr?.length > 0) && (
          <div className="mb-6 text-center">
            <p style={{ color: 'var(--text-subtle)' }}>
              Showing <strong style={{ color: 'var(--metallic-gold)' }}>{filteredFragrances.length}</strong> of {fragrances.length} fragrances
            </p>
          </div>
        )}

        {/* Fragrance Grid */}
        {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
          {filteredFragrances.length === 0 ? (
            <div className="col-span-2 py-16 text-center">
              <p className="text-xl" style={{ color: 'var(--text-subtle)' }}>
                No fragrances match your filters. Try adjusting your selection.
              </p>
            </div>
          ) : filteredFragrances.map((fragrance, index) => (
            <div
              key={fragrance.id}
              className="group relative rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl cursor-pointer"
              style={{ 
                transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.4s ease',
                background: 'linear-gradient(145deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-12px) scale(1.02)';
                handleProductClick(fragrance);
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0) scale(1)';
              }}
              onClick={() => handleProductClick(fragrance)}
            >
              {/* Flashcard Image Container - Full bleed, no white borders */}
              <div className="relative h-80 sm:h-[420px] overflow-hidden">
                {/* Dark base background */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460]" />
                
                {(() => {
                  const displaySize = hoveredSize[fragrance.id] || selectedSizes[fragrance.id] || fragrance.sizes[0]?.size;
                  const sizeData = fragrance.sizes.find(s => s.size === displaySize);
                  const images = sizeData?.images || [];
                  const currentIndex = imageIndices[fragrance.id] || 0;
                  const displayImage = (images.length > 0) 
                    ? images[currentIndex % images.length] 
                    : fragrance.image;
                  
                  return (
                    <>
                      {/* Full-bleed product image - absolute positioned to fill */}
                      <div className="absolute inset-0">
                        <img
                          src={displayImage}
                          alt={`${fragrance.name} - ${displaySize}`}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                          loading={index < 2 ? "eager" : "lazy"}
                          style={{ objectPosition: 'center center' }}
                        />
                      </div>
                      
                      {/* Elegant gradient overlay */}
                      <div 
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background: `
                            linear-gradient(180deg, 
                              rgba(0,0,0,0) 0%, 
                              rgba(0,0,0,0.1) 40%,
                              rgba(0,0,0,0.6) 75%, 
                              rgba(0,0,0,0.85) 100%
                            )
                          `
                        }}
                      />
                      
                      {/* Top corner accents */}
                      <div className="absolute top-0 left-0 w-24 h-24 pointer-events-none"
                        style={{
                          background: 'linear-gradient(135deg, rgba(212,175,55,0.3) 0%, transparent 60%)'
                        }}
                      />
                      
                      {/* Size badge - sleek pill */}
                      <div 
                        className="absolute top-4 left-4 px-4 py-1.5 rounded-full text-xs font-bold backdrop-blur-md z-10"
                        style={{ 
                          background: 'rgba(212, 175, 55, 0.9)',
                          color: '#1a1a2e',
                          boxShadow: '0 4px 15px rgba(212, 175, 55, 0.4)'
                        }}
                      >
                        {displaySize}
                      </div>
                      
                      {/* Product number - elegant circle */}
                      <div 
                        className="absolute top-4 right-4 w-11 h-11 rounded-full flex items-center justify-center font-bold text-base backdrop-blur-md z-10"
                        style={{ 
                          background: 'rgba(255,255,255,0.15)',
                          border: '2px solid rgba(212, 175, 55, 0.6)',
                          color: 'white',
                          textShadow: '0 2px 4px rgba(0,0,0,0.5)'
                        }}
                      >
                        {String(index + 1).padStart(2, '0')}
                      </div>
                      
                      {/* Image carousel dots - minimal style */}
                      {images.length > 1 && (
                        <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 flex gap-2 z-10">
                          {images.map((_, idx) => (
                            <div
                              key={idx}
                              className="transition-all duration-300"
                              style={{
                                width: idx === (currentIndex % images.length) ? '20px' : '8px',
                                height: '4px',
                                borderRadius: '2px',
                                background: idx === (currentIndex % images.length) 
                                  ? 'rgba(212, 175, 55, 1)' 
                                  : 'rgba(255, 255, 255, 0.4)',
                                boxShadow: idx === (currentIndex % images.length)
                                  ? '0 2px 8px rgba(212, 175, 55, 0.5)'
                                  : 'none'
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </>
                  );
                })()}
                
                {/* Product Info Overlay - Bottom */}
                <div className="absolute bottom-0 left-0 right-0 p-5 z-10">
                  <h3 
                    className="text-2xl sm:text-3xl font-bold text-white mb-1"
                    style={{ 
                      fontFamily: "'Playfair Display', serif",
                      textShadow: '0 2px 8px rgba(0,0,0,0.5)',
                      letterSpacing: '0.5px'
                    }}
                  >
                    {fragrance.name}
                  </h3>
                  <p 
                    className="text-sm sm:text-base font-light tracking-wide"
                    style={{ 
                      color: 'rgba(212, 175, 55, 0.9)',
                      textShadow: '0 1px 4px rgba(0,0,0,0.5)'
                    }}
                  >
                    {fragrance.subtitle}
                  </p>
                </div>
              </div>

              {/* Rating & Reviews Summary - Below Image */}
              <div className="px-6 pt-4 pb-2 flex items-center justify-between border-b" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-2">
                  <div className="flex items-center">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        size={16}
                        className={star <= Math.round(fragrance.rating) ? 'fill-current' : ''}
                        style={{ color: star <= Math.round(fragrance.rating) ? '#f59e0b' : '#d1d5db' }}
                      />
                    ))}
                  </div>
                  <span className="font-bold text-lg" style={{ color: 'var(--japanese-indigo)' }}>
                    {fragrance.rating}
                  </span>
                </div>
                <span className="text-sm" style={{ color: 'var(--text-subtle)' }}>
                  {fragrance.reviewCount} verified reviews
                </span>
              </div>

              {/* Size Selection - Below Image/Rating */}
              <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--cream)' }}>
                <p className="text-sm font-semibold mb-3" style={{ color: 'var(--japanese-indigo)' }}>
                  Select Size:
                </p>
                <div className="flex gap-3">
                  {fragrance.sizes.map((sizeOption) => {
                    const hasImages = sizeOption.images && sizeOption.images.length > 0;
                    const isSelected = (selectedSizes[fragrance.id] || fragrance.sizes[0]?.size) === sizeOption.size;
                    const isHovered = hoveredSize[fragrance.id] === sizeOption.size;
                    
                    return (
                      <button
                        key={sizeOption.size}
                        onClick={() => handleSizeClick(fragrance.id, sizeOption.size)}
                        onMouseEnter={() => handleSizeHover(fragrance.id, sizeOption.size)}
                        onMouseLeave={() => handleSizeHoverEnd(fragrance.id)}
                        className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all duration-300 relative ${
                          isSelected
                            ? 'border-[var(--metallic-gold)] bg-white shadow-md' 
                            : isHovered
                            ? 'border-[var(--japanese-indigo)] bg-white scale-[1.02]'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                        data-testid={`size-${fragrance.id}-${sizeOption.size}`}
                      >
                        {/* Gallery icon indicator */}
                        {hasImages && (
                          <div 
                            className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: 'var(--metallic-gold)' }}
                            title="Has product images"
                          >
                            <Images size={10} className="text-white" />
                          </div>
                        )}
                        {/* Selected indicator */}
                        {isSelected && (
                          <div className="absolute -top-1 -left-1 w-4 h-4 rounded-full flex items-center justify-center bg-green-500">
                            <CheckCircle size={10} className="text-white" />
                          </div>
                        )}
                        <div className="text-base font-bold" style={{ color: 'var(--japanese-indigo)' }}>{sizeOption.size}</div>
                        <div className="text-sm font-bold mt-1" style={{ color: 'var(--metallic-gold)' }}>₹{sizeOption.price}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Content */}
              <div className="p-6 sm:p-8">
                <p 
                  className="text-base leading-relaxed mb-6"
                  style={{ color: 'var(--text-dark)' }}
                >
                  {fragrance.description}
                </p>

                {/* Benefits */}
                <div className="space-y-2 mb-6">
                  <p 
                    className="text-sm font-semibold mb-3"
                    style={{ color: 'var(--japanese-indigo)' }}
                  >
                    Key Benefits:
                  </p>
                  {fragrance.benefits.map((benefit, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <CheckCircle 
                        size={16} 
                        className="mt-0.5 flex-shrink-0" 
                        style={{ color: 'var(--metallic-gold)' }} 
                      />
                      <span 
                        className="text-sm"
                        style={{ color: 'var(--text-subtle)' }}
                      >
                        {benefit}
                      </span>
                    </div>
                  ))}
                </div>
                
                {/* Scent Pyramid */}
                {fragrance.scentPyramid && (
                  <div className="mb-6">
                    <ScentPyramid scentPyramid={fragrance.scentPyramid} />
                  </div>
                )}

                {/* Quantity Controls with Add to Cart Button */}
                <div className="mb-4 p-4 rounded-xl" style={{ backgroundColor: 'var(--cream)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center justify-between gap-4">
                    {/* Quantity Section */}
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold" style={{ color: 'var(--japanese-indigo)' }}>
                        Qty:
                      </span>
                      <button
                        onClick={() => handleQuantityChange(fragrance.id, -1)}
                        className="w-9 h-9 rounded-full border-2 border-gray-300 flex items-center justify-center hover:border-[var(--metallic-gold)] hover:bg-white transition-all"
                        data-testid={`qty-decrease-${fragrance.id}`}
                      >
                        <Minus size={16} style={{ color: 'var(--japanese-indigo)' }} />
                      </button>
                      <span 
                        className="w-10 text-center text-xl font-bold"
                        style={{ color: 'var(--japanese-indigo)' }}
                      >
                        {quantities[fragrance.id] || 1}
                      </span>
                      <button
                        onClick={() => handleQuantityChange(fragrance.id, 1)}
                        className="w-9 h-9 rounded-full border-2 border-gray-300 flex items-center justify-center hover:border-[var(--metallic-gold)] hover:bg-white transition-all"
                        data-testid={`qty-increase-${fragrance.id}`}
                      >
                        <Plus size={16} style={{ color: 'var(--japanese-indigo)' }} />
                      </button>
                    </div>
                    
                    {/* Add to Cart Button */}
                    <Button
                      onClick={() => handleAddToCart(fragrance)}
                      className="flex-1 text-white font-semibold flex items-center justify-center gap-2 py-5"
                      style={{ backgroundColor: addedToCart[fragrance.id] ? '#16a34a' : 'var(--japanese-indigo)' }}
                      data-testid={`add-to-cart-${fragrance.id}`}
                    >
                      {addedToCart[fragrance.id] ? (
                        <>
                          <CheckCircle size={18} />
                          Added!
                        </>
                      ) : (
                        <>
                          <ShoppingCart size={18} />
                          Add to Cart
                        </>
                      )}
                    </Button>
                  </div>
                  
                  {/* View Product Details Link */}
                  <button
                    onClick={() => navigate(`/products/${fragrance.id}`)}
                    className="mt-3 w-full text-center text-sm font-medium flex items-center justify-center gap-1 py-2 rounded-lg hover:bg-white/50 transition-colors"
                    style={{ color: 'var(--japanese-indigo)' }}
                    data-testid={`view-details-${fragrance.id}`}
                  >
                    <ExternalLink size={14} />
                    View Full Product Details
                  </button>
                </div>

                {/* Customer Reviews Preview */}
                {fragrance.reviews && fragrance.reviews.length > 0 && (
                  <div className="mb-4 p-4 rounded-lg" style={{ backgroundColor: 'var(--cream)' }}>
                    <p className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--japanese-indigo)' }}>
                      <Quote size={14} style={{ color: 'var(--metallic-gold)' }} />
                      What Our Customers Say
                    </p>
                    <div className="space-y-3">
                      {fragrance.reviews.slice(0, 2).map((review, idx) => {
                        // Generate a deterministic random date between March 2024 and now
                        const startDate = new Date('2024-03-01').getTime();
                        const endDate = new Date().getTime();
                        const seed = (fragrance.id.charCodeAt(0) * 31 + idx * 17) % 100;
                        const randomTime = startDate + ((endDate - startDate) * (seed / 100));
                        const reviewDate = new Date(randomTime);
                        const formattedDate = reviewDate.toLocaleDateString('en-IN', { 
                          day: 'numeric', 
                          month: 'short', 
                          year: 'numeric' 
                        });
                        
                        return (
                          <div key={idx} className="text-sm">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <div className="flex items-center">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Star
                                    key={star}
                                    size={12}
                                    className={star <= review.rating ? 'fill-current' : ''}
                                    style={{ color: star <= review.rating ? '#f59e0b' : '#d1d5db' }}
                                  />
                                ))}
                              </div>
                              <span className="font-semibold" style={{ color: 'var(--japanese-indigo)' }}>
                                {review.name}
                              </span>
                              <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                                • {formattedDate}
                              </span>
                              {review.verified && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                                  ✓ Verified
                                </span>
                              )}
                            </div>
                            <p className="italic" style={{ color: 'var(--text-subtle)' }}>
                              "{review.comment}"
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Wishlist Button */}
                <div className="flex justify-end">
                  <Button
                    onClick={() => handleWishlistToggle(fragrance)}
                    variant="outline"
                    className={`px-4 transition-all flex items-center gap-2 ${
                      isInWishlist(fragrance.id, selectedSizes[fragrance.id] || fragrance.sizes[0]?.size)
                        ? 'bg-red-50 border-red-300'
                        : 'hover:bg-red-50 hover:border-red-300'
                    }`}
                    disabled={wishlistLoading[`${fragrance.id}-${selectedSizes[fragrance.id] || fragrance.sizes[0]?.size}`]}
                    data-testid={`wishlist-btn-${fragrance.id}`}
                  >
                    <Heart 
                      size={18} 
                      className={`transition-all ${
                        isInWishlist(fragrance.id, selectedSizes[fragrance.id] || fragrance.sizes[0]?.size)
                          ? 'fill-red-500 text-red-500'
                          : 'text-gray-500 hover:text-red-500'
                      }`}
                    />
                    <span className="text-sm">
                      {isInWishlist(fragrance.id, selectedSizes[fragrance.id] || fragrance.sizes[0]?.size)
                        ? 'In Wishlist'
                        : 'Add to Wishlist'
                      }
                    </span>
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
        )}
      </div>
      
      {/* Image Gallery Modal - TEST FEATURE */}
      <ImageGalleryModal
        isOpen={galleryModal.isOpen}
        onClose={closeGalleryModal}
        images={galleryModal.images}
        productName={galleryModal.productName}
        size={galleryModal.size}
        price={galleryModal.price}
        mrp={galleryModal.mrp}
        onAddToCart={handleGalleryAddToCart}
      />
    </section>
  );
};

export default FragranceGrid;