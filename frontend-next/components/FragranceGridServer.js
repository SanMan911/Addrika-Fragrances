'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Star, Heart, Loader2, AlertCircle, Eye } from 'lucide-react';
import { useWishlist } from '../context/WishlistContext';
import QuickViewModal from './QuickViewModal';

// Product Card Component - Premium Dark Theme
function ProductCard({ product, onWishlistToggle, isWishlisted, wishlistLoading, onQuickView }) {
  const router = useRouter();
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
  
  // Auto-rotate images
  useEffect(() => {
    if (allImages.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentImageIndex(prev => (prev + 1) % allImages.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [allImages.length]);

  const handleClick = () => {
    router.push(`/products/${product.id}`);
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
      {/* Image Container */}
      <div className="relative aspect-[4/5] overflow-hidden">
        {/* Subtle animated background */}
        <div 
          className="absolute inset-0 opacity-50"
          style={{
            background: `radial-gradient(ellipse at ${isHovered ? '30% 30%' : '70% 70%'}, rgba(212,175,55,0.1) 0%, transparent 60%)`,
            transition: 'all 1.5s ease-out'
          }}
        />
        
        {/* Product Image */}
        <img
          src={allImages[currentImageIndex] || product.image}
          alt={`${product.name} - Premium Zero Charcoal Incense`}
          className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700"
        />
        
        {/* Gradient Overlay */}
        <div 
          className="absolute inset-0 opacity-60"
          style={{
            background: 'linear-gradient(180deg, transparent 0%, transparent 40%, rgba(26,26,46,0.95) 100%)'
          }}
        />

        {/* Discount Badge */}
        {hasDiscount && (
          <div 
            className="absolute top-4 left-4 px-3 py-1.5 rounded-full text-xs font-bold"
            style={{ 
              background: 'linear-gradient(135deg, #D4AF37 0%, #c9a432 100%)',
              color: '#1a1a2e'
            }}
          >
            {discountPercent}% OFF
          </div>
        )}

        {/* Product Type Badge */}
        <div 
          className="absolute top-4 right-4 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm"
          style={{ 
            background: 'rgba(26,26,46,0.8)',
            color: '#D4AF37',
            border: '1px solid rgba(212,175,55,0.3)'
          }}
        >
          {product.type === 'dhoop' ? 'Dhoop' : 'Agarbatti'}
        </div>

        {/* Action Buttons */}
        <div className="absolute bottom-20 right-4 flex flex-col gap-2 transform translate-x-16 group-hover:translate-x-0 transition-all duration-300">
          {/* Wishlist Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onWishlistToggle(product);
            }}
            disabled={wishlistLoading}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110"
            style={{ 
              background: isWishlisted ? '#D4AF37' : 'rgba(26,26,46,0.9)',
              border: '1px solid rgba(212,175,55,0.3)'
            }}
            data-testid={`wishlist-btn-${product.id}`}
          >
            <Heart 
              size={18} 
              fill={isWishlisted ? '#1a1a2e' : 'none'}
              color={isWishlisted ? '#1a1a2e' : '#D4AF37'}
            />
          </button>
          
          {/* Quick View Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onQuickView(product);
            }}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110"
            style={{ 
              background: 'rgba(26,26,46,0.9)',
              border: '1px solid rgba(212,175,55,0.3)'
            }}
            data-testid={`quickview-btn-${product.id}`}
          >
            <Eye size={18} color="#D4AF37" />
          </button>
        </div>

        {/* Image Indicators */}
        {allImages.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
            {allImages.map((_, idx) => (
              <div
                key={idx}
                className="w-1.5 h-1.5 rounded-full transition-all"
                style={{
                  background: idx === currentImageIndex ? '#D4AF37' : 'rgba(255,255,255,0.4)',
                  transform: idx === currentImageIndex ? 'scale(1.3)' : 'scale(1)'
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="p-5 relative">
        {/* Rating */}
        <div className="flex items-center gap-1 mb-2">
          {[...Array(5)].map((_, i) => (
            <Star
              key={i}
              size={12}
              fill={i < Math.floor(product.rating || 4.5) ? '#D4AF37' : 'transparent'}
              color="#D4AF37"
            />
          ))}
          <span className="ml-1 text-xs text-gray-400">
            ({product.reviews || 0})
          </span>
        </div>

        {/* Name */}
        <h3 
          className="font-semibold text-lg mb-1 text-white group-hover:text-[#D4AF37] transition-colors"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          {product.name}
        </h3>

        {/* Tagline */}
        <p className="text-xs text-gray-400 mb-3 line-clamp-1">
          {product.tagline}
        </p>

        {/* Price */}
        <div className="flex items-baseline gap-2">
          <span 
            className="text-xl font-bold"
            style={{ color: '#D4AF37' }}
          >
            ₹{lowestPrice}
          </span>
          {hasDiscount && (
            <span className="text-sm text-gray-500 line-through">
              ₹{lowestMRP}
            </span>
          )}
          <span className="text-xs text-gray-500">onwards</span>
        </div>

        {/* Hover accent line */}
        <div 
          className="absolute bottom-0 left-0 h-0.5 w-0 group-hover:w-full transition-all duration-500"
          style={{ background: 'linear-gradient(90deg, #D4AF37 0%, transparent 100%)' }}
        />
      </div>
    </div>
  );
}

// Production backend URL for client-side fallback
const PRODUCTION_BACKEND = 'https://product-size-sync.preview.emergentagent.com';

// Main FragranceGrid Component - Accepts pre-fetched products with client-side fallback
export default function FragranceGridServer({ initialProducts = [] }) {
  const { addToWishlist, isInWishlist, removeFromWishlist } = useWishlist();
  const [fragrances, setFragrances] = useState(initialProducts);
  const [loading, setLoading] = useState(!initialProducts || initialProducts.length === 0);
  const [error, setError] = useState(null);
  const [wishlistLoading, setWishlistLoading] = useState({});
  const [quickViewProduct, setQuickViewProduct] = useState(null);
  const [isQuickViewOpen, setIsQuickViewOpen] = useState(false);
  
  // Client-side fallback fetch if server-side didn't provide products
  useEffect(() => {
    // If we already have products from SSR, don't fetch again
    if (initialProducts && initialProducts.length > 0) {
      setFragrances(initialProducts);
      setLoading(false);
      setError(null);
      return;
    }
    
    // Client-side fetch as fallback
    let isMounted = true;
    
    const fetchProducts = async (retries = 3) => {
      try {
        setLoading(true);
        setError(null);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        
        // Try the production backend directly
        const response = await fetch(`${PRODUCTION_BACKEND}/api/products`, {
          method: 'GET',
          signal: controller.signal,
          headers: { 'Accept': 'application/json' },
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const products = await response.json();
        
        if (isMounted && Array.isArray(products)) {
          setFragrances(products);
          setLoading(false);
          setError(null);
        }
      } catch (err) {
        console.error('Client fetch failed:', err.message);
        
        if (retries > 0 && isMounted) {
          setTimeout(() => fetchProducts(retries - 1), 1000 * (4 - retries));
        } else if (isMounted) {
          setError('Failed to load products. Please refresh the page.');
          setLoading(false);
        }
      }
    };
    
    fetchProducts();
    
    return () => { isMounted = false; };
  }, [initialProducts]);

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

  const handleQuickView = (product) => {
    setQuickViewProduct(product);
    setIsQuickViewOpen(true);
  };

  const closeQuickView = () => {
    setIsQuickViewOpen(false);
    setQuickViewProduct(null);
  };

  // Show empty state if no products were passed from server
  const hasNoProducts = !fragrances || fragrances.length === 0;

  return (
    <section 
      id="fragrances" 
      className="py-20 sm:py-28 relative overflow-hidden bg-[#faf7f2] dark:bg-[#0f1419]"
      data-testid="fragrance-grid-section"
    >
      {/* Decorative background */}
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
            MANUFACTURED IN INDIA
          </span>
          <h2 
            className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 text-[#2B3A4A] dark:text-white"
            style={{ fontFamily: "'Playfair Display', serif" }}
            data-testid="incense-section-title"
          >
            Premium Incense Collection
          </h2>
          <p className="text-lg sm:text-xl max-w-3xl mx-auto mb-10 text-[#666] dark:text-gray-300">
            Premium zero-charcoal agarbattis and bambooless dhoop, each offering 30-50 minutes of pure, 
            low-smoke aromatherapy — supporting artisan communities across India
          </p>
        </div>
        
        {/* Loading State - only if explicitly loading */}
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

        {/* Empty State */}
        {!loading && !error && hasNoProducts && (
          <div className="py-24 text-center">
            <p className="text-xl text-[#666] dark:text-gray-400 mb-4">
              No products available at the moment.
            </p>
            <button 
              onClick={() => window.location.reload()} 
              className="px-6 py-3 rounded-xl text-white font-semibold"
              style={{ backgroundColor: '#D4AF37', color: '#1a1a2e' }}
            >
              Refresh Page
            </button>
          </div>
        )}

        {/* Product Grid */}
        {!loading && !error && !hasNoProducts && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {fragrances.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onWishlistToggle={handleWishlistToggle}
                isWishlisted={isInWishlist(product.id, product.sizes?.[0]?.size)}
                wishlistLoading={wishlistLoading[`${product.id}-${product.sizes?.[0]?.size}`]}
                onQuickView={handleQuickView}
              />
            ))}
          </div>
        )}
        
        {/* Bottom tagline */}
        {!loading && !error && !hasNoProducts && (
          <div className="text-center mt-16">
            <p className="text-xs tracking-wider mb-4" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Low Smoke • Zero Charcoal • 40-50 Min Burn
            </p>
            <p className="text-sm text-[#999] dark:text-gray-500">
              All products are charcoal-free, produce 80% less smoke, and support local artisan communities
            </p>
          </div>
        )}
      </div>

      {/* Quick View Modal */}
      <QuickViewModal 
        product={quickViewProduct}
        isOpen={isQuickViewOpen}
        onClose={closeQuickView}
      />
    </section>
  );
}
