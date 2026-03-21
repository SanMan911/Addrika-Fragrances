import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchProducts } from '../services/productService';
import { Star, Heart, Loader2, AlertCircle } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import FragranceFilter from './FragranceFilter';
import ShippingInfoBanner from './ShippingInfoBanner';

// Recently Viewed storage
const STORAGE_KEY = 'addrika_recently_viewed';
const MAX_ITEMS = 6;

const addToRecentlyViewed = (product) => {
  if (!product || !product.id) return;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    let items = stored ? JSON.parse(stored) : [];
    items = items.filter(p => p.id !== product.id);
    items.unshift({
      id: product.id,
      name: product.name,
      subtitle: product.subtitle,
      image: product.image,
      color: product.color,
      sizes: product.sizes,
      viewedAt: new Date().toISOString()
    });
    items = items.slice(0, MAX_ITEMS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.error('Error saving recently viewed:', e);
  }
};

// Premium Clean Product Card
const ProductCard = ({ product, onWishlistToggle, isWishlisted, wishlistLoading }) => {
  const navigate = useNavigate();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  
  // Get all images from all sizes
  const allImages = useMemo(() => {
    const images = [];
    product.sizes?.forEach(size => {
      if (size.images && size.images.length > 0) {
        size.images.forEach(img => {
          if (!images.includes(img)) images.push(img);
        });
      }
    });
    if (images.length === 0 && product.image) {
      images.push(product.image);
    }
    return images;
  }, [product]);
  
  // Get the lowest starting price
  const lowestPrice = Math.min(...(product.sizes?.map(s => s.price) || [0]));
  const lowestMRP = Math.min(...(product.sizes?.map(s => s.mrp) || [0]));
  const hasDiscount = lowestMRP > lowestPrice;
  const discountPercent = hasDiscount ? Math.round(((lowestMRP - lowestPrice) / lowestMRP) * 100) : 0;
  
  // Auto-rotate images every 2 seconds
  useEffect(() => {
    if (allImages.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentImageIndex(prev => (prev + 1) % allImages.length);
    }, 2000);
    
    return () => clearInterval(interval);
  }, [allImages.length]);

  const handleClick = () => {
    addToRecentlyViewed(product);
    navigate(`/products/${product.id}`);
  };

  return (
    <div
      className="group relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-500 hover:-translate-y-2"
      style={{ 
        background: 'linear-gradient(165deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)',
        boxShadow: isHovered 
          ? '0 25px 60px rgba(0,0,0,0.4), 0 0 40px rgba(212,175,55,0.15)' 
          : '0 10px 40px rgba(0,0,0,0.25)'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
      data-testid={`product-card-${product.id}`}
    >
      {/* Image Container - Responsive for 1200x1500 or 1500x1200 */}
      <div className="relative aspect-[4/5] overflow-hidden">
        {/* Subtle animated background */}
        <div 
          className="absolute inset-0 opacity-50"
          style={{
            background: `radial-gradient(ellipse at ${isHovered ? '30% 30%' : '70% 70%'}, rgba(212,175,55,0.1) 0%, transparent 60%)`,
            transition: 'all 1.5s ease-out'
          }}
        />
        
        {/* Product Image - object-contain to show full image */}
        <img
          src={allImages[currentImageIndex] || product.image}
          alt={`${product.name} - Premium Zero Charcoal Incense`}
          className="w-full h-full object-contain p-6 transition-transform duration-700 ease-out"
          style={{ transform: isHovered ? 'scale(1.05)' : 'scale(1)' }}
          loading="lazy"
        />
        
        {/* Elegant gradient overlay */}
        <div 
          className="absolute inset-x-0 bottom-0 h-40 pointer-events-none"
          style={{
            background: 'linear-gradient(to top, rgba(22,33,62,1) 0%, rgba(22,33,62,0.8) 40%, transparent 100%)'
          }}
        />
        
        {/* Zero Charcoal Badge - Premium gold accent */}
        <div 
          className="absolute top-5 left-5 px-4 py-2 rounded-full text-xs font-bold tracking-wide"
          style={{ 
            background: 'linear-gradient(135deg, rgba(16,185,129,0.95) 0%, rgba(5,150,105,0.95) 100%)',
            color: 'white',
            boxShadow: '0 4px 20px rgba(16, 185, 129, 0.4)',
            backdropFilter: 'blur(8px)'
          }}
        >
          Zero Charcoal
        </div>
        
        {/* Wishlist Button - Elegant circle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onWishlistToggle(product);
          }}
          disabled={wishlistLoading}
          className="absolute top-5 right-5 w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300"
          style={{ 
            background: isWishlisted 
              ? 'linear-gradient(135deg, rgba(239,68,68,0.95) 0%, rgba(220,38,38,0.95) 100%)' 
              : 'rgba(255,255,255,0.1)',
            backdropFilter: 'blur(12px)',
            border: isWishlisted ? 'none' : '1px solid rgba(255,255,255,0.2)',
            boxShadow: isWishlisted ? '0 4px 20px rgba(239,68,68,0.4)' : 'none'
          }}
          data-testid={`wishlist-btn-${product.id}`}
        >
          <Heart 
            size={18} 
            className={`transition-all ${isWishlisted ? 'fill-white text-white scale-110' : 'text-white/80'}`}
          />
        </button>

        {/* Image carousel indicators - Minimal elegant dots */}
        {allImages.length > 1 && (
          <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 flex gap-2">
            {allImages.slice(0, 6).map((_, idx) => (
              <button
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentImageIndex(idx);
                }}
                className="transition-all duration-400"
                style={{
                  width: idx === currentImageIndex ? '24px' : '8px',
                  height: '6px',
                  borderRadius: '3px',
                  background: idx === currentImageIndex 
                    ? 'linear-gradient(90deg, #D4AF37 0%, #f5d67a 100%)' 
                    : 'rgba(255,255,255,0.3)',
                  boxShadow: idx === currentImageIndex ? '0 2px 12px rgba(212,175,55,0.5)' : 'none'
                }}
              />
            ))}
            {allImages.length > 6 && (
              <span className="text-xs text-white/50 ml-1 self-center">+{allImages.length - 6}</span>
            )}
          </div>
        )}
      </div>
      
      {/* Product Info - Elegant dark theme */}
      <div 
        className="p-6"
        style={{ 
          background: 'linear-gradient(180deg, rgba(22,33,62,0.95) 0%, rgba(26,26,46,1) 100%)'
        }}
      >
        {/* Product Name */}
        <h3 
          className="text-xl font-semibold mb-2 transition-colors duration-300"
          style={{ 
            color: isHovered ? '#D4AF37' : 'white',
            fontFamily: "'Playfair Display', serif",
            letterSpacing: '0.5px'
          }}
        >
          {product.name}
        </h3>
        
        {/* Subtitle if exists */}
        {product.subtitle && (
          <p 
            className="text-sm mb-3 font-light"
            style={{ color: 'rgba(212,175,55,0.8)' }}
          >
            {product.subtitle}
          </p>
        )}
        
        {/* Premium tagline */}
        <p className="text-xs tracking-wider mb-4" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Low Smoke • 100% Natural • 40-50 Min Burn
        </p>
        
        {/* Rating */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                size={14}
                className="transition-colors"
                style={{ 
                  color: star <= Math.round(product.rating || 4.5) ? '#D4AF37' : 'rgba(255,255,255,0.2)',
                  fill: star <= Math.round(product.rating || 4.5) ? '#D4AF37' : 'transparent'
                }}
              />
            ))}
          </div>
          <span className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {product.rating || 4.5} ({product.reviewCount || product.reviews || 0})
          </span>
        </div>
        
        {/* Price */}
        <div className="flex items-end justify-between mb-5">
          <div>
            <span className="text-xs block mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Starting From
            </span>
            <div className="flex items-baseline gap-2">
              <span 
                className="text-2xl font-bold"
                style={{ color: '#D4AF37' }}
              >
                ₹{lowestPrice}
              </span>
              {hasDiscount && (
                <span 
                  className="text-sm line-through"
                  style={{ color: 'rgba(255,255,255,0.4)' }}
                >
                  ₹{lowestMRP}
                </span>
              )}
            </div>
          </div>
          {hasDiscount && (
            <span 
              className="px-3 py-1.5 rounded-full text-xs font-bold"
              style={{ 
                background: 'rgba(212,175,55,0.15)', 
                color: '#D4AF37',
                border: '1px solid rgba(212,175,55,0.3)'
              }}
            >
              {discountPercent}% OFF
            </span>
          )}
        </div>
        
        {/* View Details Button - Premium gold */}
        <button
          className="w-full py-3.5 rounded-xl font-semibold text-sm tracking-wide transition-all duration-300"
          style={{ 
            background: isHovered 
              ? 'linear-gradient(135deg, #D4AF37 0%, #f5d67a 50%, #D4AF37 100%)'
              : 'linear-gradient(135deg, #D4AF37 0%, #c9a432 100%)',
            color: '#1a1a2e',
            boxShadow: isHovered 
              ? '0 8px 30px rgba(212,175,55,0.5)' 
              : '0 4px 20px rgba(212,175,55,0.3)',
            transform: isHovered ? 'scale(1.02)' : 'scale(1)'
          }}
          data-testid={`view-details-${product.id}`}
        >
          View Details
        </button>
      </div>
    </div>
  );
};

const FragranceGrid = () => {
  const { addToWishlist, isInWishlist, removeFromWishlist } = useWishlist();
  
  // Product data state
  const [fragrances, setFragrances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [wishlistLoading, setWishlistLoading] = useState({});
  const [activeFilters, setActiveFilters] = useState({});
  
  // Fetch products from API
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

  // Filter fragrances
  const filteredFragrances = useMemo(() => {
    const hasFilters = Object.values(activeFilters).some(arr => arr?.length > 0);
    if (!hasFilters) return fragrances;
    
    return fragrances.filter(fragrance => {
      if (activeFilters.mood?.length > 0) {
        const matchesMood = activeFilters.mood.some(m => fragrance.mood?.includes(m));
        if (!matchesMood) return false;
      }
      if (activeFilters.notes?.length > 0) {
        const matchesNotes = activeFilters.notes.some(n => fragrance.notes?.includes(n));
        if (!matchesNotes) return false;
      }
      if (activeFilters.intensity?.length > 0) {
        const matchesIntensity = activeFilters.intensity.includes(fragrance.intensity);
        if (!matchesIntensity) return false;
      }
      return true;
    });
  }, [activeFilters, fragrances]);

  // Handle wishlist toggle
  const handleWishlistToggle = async (product) => {
    const defaultSize = product.sizes?.[0]?.size;
    const wishlistKey = `${product.id}-${defaultSize}`;
    
    setWishlistLoading(prev => ({ ...prev, [wishlistKey]: true }));
    
    try {
      if (isInWishlist(product.id, defaultSize)) {
        await removeFromWishlist(product.id, defaultSize);
      } else {
        await addToWishlist(product, defaultSize);
      }
    } catch (error) {
      console.error('Wishlist error:', error);
    } finally {
      setWishlistLoading(prev => ({ ...prev, [wishlistKey]: false }));
    }
  };

  return (
    <section 
      id="fragrances" 
      className="py-20 sm:py-28 relative overflow-hidden bg-[#faf7f2] dark:bg-[#0f1419]"
      data-testid="fragrance-grid-section"
    >
      {/* Subtle decorative background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30 dark:opacity-20">
        <div 
          className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.1) 0%, transparent 70%)' }}
        />
        <div 
          className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(43,58,74,0.1) 0%, transparent 70%)' }}
        />
      </div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Section Header */}
        <div className="text-center mb-14">
          <span 
            className="inline-block px-5 py-2 rounded-full text-sm font-medium tracking-wider mb-6"
            style={{ 
              background: 'rgba(212,175,55,0.1)', 
              color: '#D4AF37',
              border: '1px solid rgba(212,175,55,0.2)'
            }}
          >
            HANDCRAFTED IN INDIA
          </span>
          <h2 
            className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 text-[#2B3A4A] dark:text-white"
            style={{ 
              fontFamily: "'Playfair Display', serif"
            }}
            data-testid="incense-section-title"
          >
            Premium Incense Collection
          </h2>
          <p 
            className="text-lg sm:text-xl max-w-3xl mx-auto mb-10 text-[#666] dark:text-gray-300"
          >
            Four exquisite zero-charcoal fragrances, each offering 40-50 minutes of pure, 
            low-smoke aromatherapy crafted with 100% natural ingredients
          </p>
          
          {/* Shipping Info */}
          <div className="max-w-xl mx-auto">
            <ShippingInfoBanner compact={false} />
          </div>
        </div>
        
        {/* Filter */}
        <FragranceFilter 
          onFilterChange={setActiveFilters}
          activeFilters={activeFilters}
        />
        
        {/* Loading State */}
        {loading && (
          <div className="py-24 text-center">
            <Loader2 className="w-12 h-12 mx-auto animate-spin" style={{ color: '#D4AF37' }} />
            <p className="mt-4 text-lg text-[#666] dark:text-gray-400">Loading premium fragrances...</p>
          </div>
        )}
        
        {/* Error State */}
        {error && !loading && (
          <div className="py-24 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
            <p className="text-lg text-red-600 mb-4">{error}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="px-6 py-3 rounded-xl text-white font-semibold"
              style={{ backgroundColor: '#2B3A4A' }}
            >
              Try Again
            </button>
          </div>
        )}
        
        {/* Filter Count */}
        {!loading && !error && Object.values(activeFilters).some(arr => arr?.length > 0) && (
          <div className="mb-8 text-center">
            <p className="text-[#666] dark:text-gray-400">
              Showing <strong className="text-[#D4AF37]">{filteredFragrances.length}</strong> of {fragrances.length} fragrances
            </p>
          </div>
        )}

        {/* Premium Product Grid */}
        {!loading && !error && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {filteredFragrances.length === 0 ? (
              <div className="col-span-full py-20 text-center">
                <p className="text-xl text-[#666] dark:text-gray-400">
                  No fragrances match your filters. Try adjusting your selection.
                </p>
              </div>
            ) : (
              filteredFragrances.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onWishlistToggle={handleWishlistToggle}
                  isWishlisted={isInWishlist(product.id, product.sizes?.[0]?.size)}
                  wishlistLoading={wishlistLoading[`${product.id}-${product.sizes?.[0]?.size}`]}
                />
              ))
            )}
          </div>
        )}
        
        {/* Bottom tagline */}
        {!loading && !error && filteredFragrances.length > 0 && (
          <div className="text-center mt-16">
            <p className="text-sm text-[#999] dark:text-gray-500">
              All products are 100% natural, charcoal-free, and produce 80% less smoke than traditional agarbatti
            </p>
          </div>
        )}
      </div>
    </section>
  );
};

export default FragranceGrid;
