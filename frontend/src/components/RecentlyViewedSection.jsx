import React, { useState, useEffect } from 'react';
import { Clock, ArrowRight, ShoppingCart, Check, Loader2 } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { toast } from 'sonner';
import { ProductImage } from './OptimizedImage';
import { fetchProducts } from '../services/productService';

const STORAGE_KEY = 'addrika_recently_viewed';
const MAX_ITEMS = 6;

// Hook to manage recently viewed products
export const useRecentlyViewed = () => {
  const [recentlyViewed, setRecentlyViewed] = useState([]);

  useEffect(() => {
    // Load from localStorage on mount
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setRecentlyViewed(JSON.parse(stored));
      } catch (e) {
        console.error('Error loading recently viewed:', e);
      }
    }
  }, []);

  const addToRecentlyViewed = (product) => {
    if (!product || !product.id) return;

    setRecentlyViewed(prev => {
      // Remove if already exists
      const filtered = prev.filter(p => p.id !== product.id);
      // Add to beginning
      const updated = [product, ...filtered].slice(0, MAX_ITEMS);
      // Save to localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const clearRecentlyViewed = () => {
    localStorage.removeItem(STORAGE_KEY);
    setRecentlyViewed([]);
  };

  return { recentlyViewed, addToRecentlyViewed, clearRecentlyViewed };
};

// Recently Viewed Section Component
const RecentlyViewedSection = ({ currentProductId = null, maxItems = 4 }) => {
  const [recentlyViewed, setRecentlyViewed] = useState([]);
  const [liveProducts, setLiveProducts] = useState({});
  const [addingToCart, setAddingToCart] = useState({});
  const [addedToCart, setAddedToCart] = useState({});
  const { addToCart } = useCart();

  // Fetch live product data from API for current prices
  useEffect(() => {
    const loadLiveProducts = async () => {
      try {
        const products = await fetchProducts();
        const productMap = {};
        products.forEach(p => {
          productMap[p.id] = p;
        });
        setLiveProducts(productMap);
      } catch (error) {
        console.error('Failed to fetch live products:', error);
      }
    };
    loadLiveProducts();
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        let items = JSON.parse(stored);
        // Filter out current product if on product page
        if (currentProductId) {
          items = items.filter(p => p.id !== currentProductId);
        }
        setRecentlyViewed(items.slice(0, maxItems));
      } catch (e) {
        console.error('Error loading recently viewed:', e);
      }
    }
  }, [currentProductId, maxItems]);

  const handleAddToCart = async (product, e) => {
    e.stopPropagation(); // Prevent navigation
    
    // Use live product data if available for current prices
    const liveProduct = liveProducts[product.id] || product;
    
    // Get the default size (50g if available, otherwise first available)
    const defaultSize = liveProduct.sizes?.find(s => s.size === '50g') || liveProduct.sizes?.[0];
    const size = defaultSize?.size || '50g';
    
    // Show loading state
    setAddingToCart(prev => ({ ...prev, [product.id]: true }));
    
    try {
      // Use addToCart from CartContext - it handles pricing based on size
      addToCart(liveProduct, size, 1);
      
      // Show success state
      setAddedToCart(prev => ({ ...prev, [product.id]: true }));
      
      // Reset after 2 seconds
      setTimeout(() => {
        setAddedToCart(prev => ({ ...prev, [product.id]: false }));
      }, 2000);
    } catch (error) {
      console.error('Failed to add to cart:', error);
      toast.error('Failed to add to cart');
    } finally {
      setAddingToCart(prev => ({ ...prev, [product.id]: false }));
    }
  };

  if (recentlyViewed.length === 0) {
    return null;
  }

  return (
    <section className="py-12" style={{ backgroundColor: 'var(--cream)' }} data-testid="recently-viewed-section">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Clock size={24} style={{ color: 'var(--metallic-gold)' }} />
            <h2 
              className="text-2xl font-bold"
              style={{ color: 'var(--japanese-indigo)', fontFamily: "'Exo', sans-serif" }}
            >
              Recently Viewed
            </h2>
          </div>
          {recentlyViewed.length > 2 && (
            <a 
              href="/#fragrances"
              className="flex items-center gap-1 text-sm font-medium hover:opacity-80 transition-opacity"
              style={{ color: 'var(--metallic-gold)' }}
            >
              View All Fragrances <ArrowRight size={16} />
            </a>
          )}
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {recentlyViewed.map((product) => {
            // Use live product data for current prices
            const liveProduct = liveProducts[product.id] || product;
            const isAdding = addingToCart[product.id];
            const isAdded = addedToCart[product.id];
            
            return (
              <div
                key={product.id}
                className="bg-white rounded-xl shadow-sm overflow-hidden group hover:shadow-lg transition-all duration-300"
                style={{ border: '1px solid var(--border)' }}
                data-testid={`recently-viewed-item-${product.id}`}
              >
                {/* Product Image */}
                <div className="aspect-square relative overflow-hidden">
                  {(liveProduct.image || product.image) ? (
                    <ProductImage
                      src={liveProduct.image || product.image}
                      alt={product.name}
                      className="w-full h-full group-hover:scale-105 transition-transform duration-500"
                      size="card"
                    />
                  ) : (
                    <div 
                      className="w-full h-full flex items-center justify-center"
                      style={{ 
                        background: `linear-gradient(135deg, ${product.color || '#d4af37'}20 0%, ${product.color || '#d4af37'}40 100%)`
                      }}
                    >
                      <span className="text-4xl">🪔</span>
                    </div>
                  )}
                  
                  {/* Quick Add Overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center z-10">
                    <button
                      onClick={(e) => handleAddToCart(product, e)}
                      disabled={isAdding || isAdded}
                      className={`px-4 py-2 rounded-full text-sm font-semibold transform translate-y-4 group-hover:translate-y-0 transition-all duration-300 flex items-center gap-2 ${
                        isAdded ? 'bg-green-500' : ''
                      }`}
                      style={{ 
                        backgroundColor: isAdded ? '#22c55e' : 'var(--metallic-gold)',
                        color: 'white'
                      }}
                      data-testid={`quick-add-${product.id}`}
                    >
                      {isAdding ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Adding...
                        </>
                      ) : isAdded ? (
                        <>
                          <Check size={16} />
                          Added!
                        </>
                      ) : (
                        <>
                          <ShoppingCart size={16} />
                          Quick Add
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Product Info */}
                <div className="p-4">
                  <h3 
                    className="font-semibold text-sm md:text-base mb-1 truncate"
                    style={{ color: 'var(--japanese-indigo)' }}
                  >
                    {product.name}
                  </h3>
                  <p 
                    className="text-xs md:text-sm mb-2 truncate"
                    style={{ color: 'var(--text-subtle)' }}
                  >
                    {liveProduct.subtitle || product.subtitle || 'Premium Agarbatti'}
                  </p>
                  {(() => {
                    // Use live product data for current pricing
                    const sizes = liveProduct.sizes || product.sizes || [];
                    const defaultSize = sizes.find(s => s.size === '50g') || sizes[0];
                    const price = defaultSize?.price || 110;
                    const mrp = defaultSize?.mrp || price;
                    const size = defaultSize?.size || '50g';
                    return (
                      <div className="flex items-baseline gap-2">
                        <span 
                          className="font-bold"
                          style={{ color: 'var(--metallic-gold)' }}
                        >
                          ₹{price}
                        </span>
                        {mrp > price && (
                          <span 
                            className="text-xs line-through"
                            style={{ color: 'var(--text-subtle)' }}
                          >
                            ₹{mrp}
                          </span>
                        )}
                        <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                          ({size})
                        </span>
                      </div>
                    );
                  })()}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default RecentlyViewedSection;
