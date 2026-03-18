'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Heart, Trash2, ShoppingCart, ArrowRight } from 'lucide-react';
import { useWishlist } from '../../context/WishlistContext';
import { useCart } from '../../context/CartContext';
import { toast } from 'sonner';

export default function WishlistPage() {
  const { wishlist, removeFromWishlist, isLoaded } = useWishlist();
  const { addToCart } = useCart();
  const [movingToCart, setMovingToCart] = useState(null);

  const handleMoveToCart = (item) => {
    setMovingToCart(`${item.productId}-${item.size}`);
    addToCart({
      productId: item.productId,
      name: item.name,
      size: item.size,
      price: item.price,
      image: item.image,
      quantity: 1,
    });
    removeFromWishlist(item.productId, item.size);
    toast.success('Moved to cart');
    setMovingToCart(null);
  };

  const handleRemove = (item) => {
    removeFromWishlist(item.productId, item.size);
    toast.success('Removed from wishlist');
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-[#D4AF37] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-[#2B3A4A] font-bold text-xl">
            <span className="text-[#D4AF37]">Addrika</span>
          </Link>
        </div>
      </header>

      <main className="pt-24 pb-16 min-h-screen bg-[#F5F0E8]">
        <div className="max-w-4xl mx-auto px-4">
          <h1 className="text-3xl font-bold text-[#2B3A4A] font-serif mb-8">
            My Wishlist ({wishlist.length} items)
          </h1>

          {wishlist.length === 0 ? (
            <div className="bg-white rounded-xl p-12 text-center">
              <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-[#2B3A4A] mb-2">
                Your wishlist is empty
              </h2>
              <p className="text-gray-600 mb-6">
                Save items you love to your wishlist and shop them later.
              </p>
              <Link
                href="/#fragrances"
                className="inline-flex items-center gap-2 bg-[#2B3A4A] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#1a252f] transition-colors"
              >
                Explore Products
                <ArrowRight size={18} />
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {wishlist.map((item) => (
                <div
                  key={`${item.productId}-${item.size}`}
                  className="bg-white rounded-xl p-4 flex gap-4 shadow-sm"
                >
                  {/* Product Image */}
                  <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <Heart size={32} />
                      </div>
                    )}
                  </div>

                  {/* Product Details */}
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <div>
                        <h3 className="font-semibold text-[#2B3A4A]">{item.name}</h3>
                        <p className="text-sm text-gray-500">{item.size}</p>
                        <p className="font-bold text-[#2B3A4A] mt-1">
                          ₹{item.price?.toLocaleString('en-IN')}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemove(item)}
                        className="text-gray-400 hover:text-red-500 transition-colors h-fit"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>

                    <button
                      onClick={() => handleMoveToCart(item)}
                      disabled={movingToCart === `${item.productId}-${item.size}`}
                      className="mt-4 flex items-center gap-2 text-[#D4AF37] font-medium hover:underline"
                    >
                      <ShoppingCart size={16} />
                      Move to Cart
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#2B3A4A] text-white py-8 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-[#D4AF37] font-bold text-xl mb-2">Addrika</p>
          <p className="text-sm text-gray-400">© 2026 Centsibl Traders Private Limited</p>
        </div>
      </footer>
    </>
  );
}
