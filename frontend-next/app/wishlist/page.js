'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useWishlist } from '../../context/WishlistContext';
import { useCart } from '../../context/CartContext';
import { Heart, ShoppingCart, Trash2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export default function WishlistPage() {
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
      const sizeData = product.sizes?.find(s => s.weight === item.size);
      addToCart({
        productId: item.productId,
        name: product.name,
        size: item.size,
        price: sizeData?.mrp || item.price,
        quantity: 1
      });
      toast.success('Added to cart!');
    }
  };

  const handleRemove = (productId, size) => {
    removeFromWishlist(productId, size);
    toast.info('Removed from wishlist');
  };

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F0E8]">
        <div className="w-12 h-12 border-4 border-[#2B3A4A] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F0E8]">
      {/* Header */}
      <header className="bg-white shadow-sm py-4 px-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/account" className="flex items-center gap-2 text-[#2B3A4A] hover:opacity-70">
            <ArrowLeft size={20} />
            <span>Account</span>
          </Link>
          <Link href="/" className="text-xl font-bold text-[#2B3A4A]">ADDRIKA</Link>
          <div className="w-20" />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-[#2B3A4A] mb-6 flex items-center gap-2">
          <Heart className="text-red-500" />
          My Wishlist ({wishlist.length})
        </h1>
        
        {wishlist.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center">
            <Heart size={64} className="mx-auto text-gray-300 mb-4" />
            <h2 className="text-xl font-bold text-[#2B3A4A] mb-2">Your wishlist is empty</h2>
            <p className="text-gray-500 mb-6">Save items you love for later</p>
            <Link
              href="/"
              className="inline-block bg-[#D4AF37] text-[#2B3A4A] px-6 py-3 rounded-xl font-semibold hover:bg-[#c9a432] transition-colors"
            >
              Explore Products
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {wishlist.map((item) => {
              const product = products[item.productId];
              const sizeData = product?.sizes?.find(s => s.weight === item.size);
              
              return (
                <div
                  key={`${item.productId}-${item.size}`}
                  className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                >
                  {/* Product Image */}
                  <Link href={`/products/${item.productId}`} className="block relative aspect-square">
                    {product?.image ? (
                      <Image
                        src={product.image}
                        alt={product.name}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                        <Heart size={40} className="text-gray-300" />
                      </div>
                    )}
                    
                    {/* Remove Button */}
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        handleRemove(item.productId, item.size);
                      }}
                      className="absolute top-3 right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md hover:bg-red-50 transition-colors"
                      data-testid={`remove-wishlist-${item.productId}`}
                    >
                      <Trash2 size={16} className="text-red-500" />
                    </button>
                  </Link>
                  
                  {/* Product Info */}
                  <div className="p-4">
                    <Link href={`/products/${item.productId}`}>
                      <h3 className="font-semibold text-[#2B3A4A] hover:text-[#D4AF37] transition-colors">
                        {product?.name || item.name}
                      </h3>
                    </Link>
                    <p className="text-sm text-gray-500 mb-3">{item.size}</p>
                    
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-[#2B3A4A]">
                        ₹{sizeData?.mrp || item.price}
                      </p>
                      <button
                        onClick={() => handleAddToCart(item)}
                        className="flex items-center gap-1 bg-[#D4AF37] text-[#2B3A4A] px-3 py-2 rounded-lg text-sm font-medium hover:bg-[#c9a432] transition-colors"
                        data-testid={`add-to-cart-${item.productId}`}
                      >
                        <ShoppingCart size={16} />
                        Add to Cart
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
