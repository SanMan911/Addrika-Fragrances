'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useWishlist } from '../../context/WishlistContext';
import { useCart } from '../../context/CartContext';
import { Heart, ShoppingCart, Trash2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://product-size-sync.preview.emergentagent.com';

export default function WishlistClient() {
  const router = useRouter();
  const { wishlist, removeFromWishlist, isLoaded } = useWishlist();
  const { addToCart } = useCart();
  
  const [products, setProducts] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch(`${API_URL}/api/products`);
        const data = await res.json();
        const productMap = {};
        data.forEach(p => { productMap[p.id] = p; });
        setProducts(productMap);
      } catch (error) {
        console.error('Failed to fetch products:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const handleAddToCart = (item) => {
    const product = products[item.productId];
    if (product) {
      const sizeData = product.sizes?.find(s => s.size === item.size);
      addToCart({
        id: item.productId,
        name: product.name,
        image: product.image,
        tagline: product.tagline,
      }, item.size, 1);
      toast.success('Added to cart!');
    }
  };

  const handleRemove = (productId, size) => {
    removeFromWishlist(productId, size);
    toast.info('Removed from wishlist');
  };

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(180deg, #0f1419 0%, #1a2332 100%)' }}>
        <div className="w-12 h-12 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #0f1419 0%, #1a2332 100%)' }}>
      <Header />
      
      <main className="pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4">
          {/* Page Header */}
          <div className="text-center mb-10">
            <div 
              className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(212,175,55,0.15)' }}
            >
              <Heart className="w-10 h-10 text-[#D4AF37]" />
            </div>
            <h1 
              className="text-3xl sm:text-4xl font-bold text-white mb-3"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              My Wishlist
            </h1>
            <p className="text-gray-400">
              {wishlist.length === 0 
                ? 'Your wishlist is empty' 
                : `${wishlist.length} item${wishlist.length > 1 ? 's' : ''} saved`}
            </p>
          </div>

          {/* Wishlist Items */}
          {wishlist.length === 0 ? (
            <div 
              className="text-center py-16 rounded-2xl"
              style={{ 
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.1)'
              }}
            >
              <Heart size={48} className="mx-auto mb-4 text-gray-600" />
              <h3 className="text-xl font-semibold text-white mb-2">Nothing here yet</h3>
              <p className="text-gray-400 mb-6">
                Start exploring and save items you love!
              </p>
              <Link
                href="/#fragrances"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all"
                style={{ 
                  background: 'linear-gradient(135deg, #D4AF37 0%, #c9a432 100%)',
                  color: '#1a1a2e'
                }}
              >
                Explore Fragrances
                <ArrowRight size={18} />
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {wishlist.map((item, index) => {
                const product = products[item.productId];
                if (!product) return null;
                
                const sizeData = product.sizes?.find(s => s.size === item.size);
                
                return (
                  <div 
                    key={`${item.productId}-${item.size}-${index}`}
                    className="p-4 rounded-xl flex items-center gap-4"
                    style={{ 
                      background: 'linear-gradient(165deg, rgba(26,26,46,0.8) 0%, rgba(22,33,62,0.8) 100%)',
                      border: '1px solid rgba(255,255,255,0.1)'
                    }}
                  >
                    {/* Product Image */}
                    <Link href={`/products/${item.productId}`} className="flex-shrink-0">
                      <div 
                        className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden"
                        style={{ background: 'rgba(255,255,255,0.05)' }}
                      >
                        <img 
                          src={product.image}
                          alt={product.name}
                          className="w-full h-full object-contain p-2"
                        />
                      </div>
                    </Link>
                    
                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <Link href={`/products/${item.productId}`}>
                        <h3 className="font-semibold text-white hover:text-[#D4AF37] transition-colors">
                          {product.name}
                        </h3>
                      </Link>
                      <p className="text-sm text-gray-400">{item.size}</p>
                      <p className="text-lg font-bold text-[#D4AF37] mt-1">
                        ₹{sizeData?.price || item.price}
                      </p>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        onClick={() => handleAddToCart(item)}
                        className="p-3 rounded-lg transition-all"
                        style={{ 
                          background: 'rgba(212,175,55,0.15)',
                          border: '1px solid rgba(212,175,55,0.3)'
                        }}
                        title="Add to Cart"
                      >
                        <ShoppingCart size={18} className="text-[#D4AF37]" />
                      </button>
                      <button
                        onClick={() => handleRemove(item.productId, item.size)}
                        className="p-3 rounded-lg transition-all hover:bg-red-500/20"
                        style={{ 
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.1)'
                        }}
                        title="Remove"
                      >
                        <Trash2 size={18} className="text-red-400" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Continue Shopping */}
          {wishlist.length > 0 && (
            <div className="text-center mt-10">
              <Link
                href="/#fragrances"
                className="inline-flex items-center gap-2 text-[#D4AF37] hover:underline"
              >
                Continue Shopping
                <ArrowRight size={16} />
              </Link>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
