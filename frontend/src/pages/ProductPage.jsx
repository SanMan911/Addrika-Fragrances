import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Home, ShoppingCart, Heart, Star, Plus, Minus, ChevronLeft, ChevronRight, Loader2, ArrowRight } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import SEO from '../components/SEO';
import { Button } from '../components/ui/button';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const ProductPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { addToWishlist, isInWishlist, removeFromWishlist } = useWishlist();
  
  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [addingToCart, setAddingToCart] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchProduct();
    fetchRelatedProducts();
  }, [slug]);

  const fetchProduct = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/products/${slug}`);
      if (response.ok) {
        const data = await response.json();
        setProduct(data);
        // Default to first size
        if (data.sizes && data.sizes.length > 0) {
          setSelectedSize(data.sizes[0]);
        }
      } else if (response.status === 404) {
        setError('Product not found');
      } else {
        setError('Failed to load product');
      }
    } catch (err) {
      console.error('Error fetching product:', err);
      setError('Failed to load product');
    } finally {
      setLoading(false);
    }
  };

  const fetchRelatedProducts = async () => {
    try {
      const response = await fetch(`${API_URL}/api/products`);
      if (response.ok) {
        const allProducts = await response.json();
        // Filter out current product and get up to 3 related products
        const related = allProducts.filter(p => p.id !== slug).slice(0, 3);
        setRelatedProducts(related);
      }
    } catch (err) {
      console.error('Error fetching related products:', err);
    }
  };

  const handleSizeChange = (size) => {
    setSelectedSize(size);
    setCurrentImageIndex(0);
  };

  const handleAddToCart = async () => {
    if (!selectedSize) {
      toast.error('Please select a size');
      return;
    }
    
    setAddingToCart(true);
    try {
      addToCart({
        id: product.id,
        productId: product.id,
        name: product.name,
        size: selectedSize.size,
        price: selectedSize.mrp,
        mrp: selectedSize.mrp,
        quantity: quantity,
        image: product.image
      });
      toast.success(`${product.name} (${selectedSize.size}) added to cart!`);
    } catch (err) {
      toast.error('Failed to add to cart');
    } finally {
      setAddingToCart(false);
    }
  };

  const handleWishlistToggle = async () => {
    if (!selectedSize) {
      toast.error('Please select a size first');
      return;
    }
    
    setWishlistLoading(true);
    try {
      const wishlistKey = `${product.id}-${selectedSize.size}`;
      if (isInWishlist(product.id, selectedSize.size)) {
        await removeFromWishlist(product.id, selectedSize.size);
        toast.success('Removed from wishlist');
      } else {
        await addToWishlist({
          productId: product.id,
          name: product.name,
          size: selectedSize.size,
          price: selectedSize.mrp,
          mrp: selectedSize.mrp,
          image: product.image
        });
        toast.success('Added to wishlist');
      }
    } catch (err) {
      toast.error('Failed to update wishlist');
    } finally {
      setWishlistLoading(false);
    }
  };

  const currentImages = selectedSize?.images || [product?.image];

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % currentImages.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + currentImages.length) % currentImages.length);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 pt-24 flex items-center justify-center" style={{ backgroundColor: 'var(--cream)' }}>
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin mx-auto" style={{ color: 'var(--japanese-indigo)' }} />
            <p className="mt-4" style={{ color: 'var(--text-subtle)' }}>Loading product...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 pt-24 flex items-center justify-center" style={{ backgroundColor: 'var(--cream)' }}>
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4" style={{ color: 'var(--japanese-indigo)' }}>
              {error || 'Product not found'}
            </h1>
            <Button onClick={() => navigate('/')} style={{ backgroundColor: 'var(--japanese-indigo)' }}>
              Return to Home
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const inWishlist = selectedSize ? isInWishlist(product.id, selectedSize.size) : false;

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-slate-900">
      <SEO 
        title={`${product.name} - ${product.tagline} | Addrika Premium Incense`}
        description={product.description}
        url={`https://centraders.com/products/${slug}`}
        image={product.image}
        type="product"
        keywords={`${product.name}, ${product.notes?.join(', ')}, premium incense, agarbatti, addrika`}
        product={{
          name: product.name,
          description: product.description,
          image: product.image,
          price: selectedSize?.mrp || product.sizes[0]?.mrp,
          rating: product.rating,
          reviewCount: product.reviews
        }}
      />
      <Header />
      
      <main className="flex-1 pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 mb-8 text-sm">
            <button
              onClick={() => navigate('/')}
              className="hover:opacity-70 transition-opacity"
              style={{ color: 'var(--japanese-indigo)' }}
            >
              Home
            </button>
            <span style={{ color: 'var(--text-subtle)' }}>/</span>
            <button
              onClick={() => navigate('/#fragrances')}
              className="hover:opacity-70 transition-opacity"
              style={{ color: 'var(--japanese-indigo)' }}
            >
              Fragrances
            </button>
            <span style={{ color: 'var(--text-subtle)' }}>/</span>
            <span style={{ color: 'var(--text-subtle)' }}>{product.name}</span>
          </nav>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Image Gallery */}
            <div className="space-y-4">
              <div className="relative aspect-square rounded-2xl overflow-hidden bg-gray-100 dark:bg-slate-800">
                <img
                  src={currentImages[currentImageIndex]}
                  alt={`${product.name} - Image ${currentImageIndex + 1}`}
                  className="w-full h-full object-cover"
                />
                
                {/* Image Navigation */}
                {currentImages.length > 1 && (
                  <>
                    <button
                      onClick={prevImage}
                      className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 dark:bg-slate-800/80 flex items-center justify-center hover:bg-white dark:hover:bg-slate-700 transition-colors"
                      data-testid="prev-image-btn"
                    >
                      <ChevronLeft size={24} style={{ color: 'var(--japanese-indigo)' }} />
                    </button>
                    <button
                      onClick={nextImage}
                      className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 dark:bg-slate-800/80 flex items-center justify-center hover:bg-white dark:hover:bg-slate-700 transition-colors"
                      data-testid="next-image-btn"
                    >
                      <ChevronRight size={24} style={{ color: 'var(--japanese-indigo)' }} />
                    </button>
                  </>
                )}
                
                {/* Image Counter */}
                {currentImages.length > 1 && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
                    {currentImageIndex + 1} / {currentImages.length}
                  </div>
                )}
              </div>
              
              {/* Thumbnail Gallery */}
              {currentImages.length > 1 && (
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {currentImages.map((img, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentImageIndex(index)}
                      className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                        index === currentImageIndex 
                          ? 'border-[var(--metallic-gold)] ring-2 ring-[var(--metallic-gold)]/30' 
                          : 'border-transparent hover:border-gray-300'
                      }`}
                    >
                      <img src={img} alt={`Thumbnail ${index + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product Info */}
            <div className="space-y-6">
              <div>
                <p className="text-sm font-medium mb-2" style={{ color: 'var(--metallic-gold)' }}>
                  {product.tagline}
                </p>
                <h1 
                  className="text-3xl sm:text-4xl font-bold mb-4 font-serif"
                  style={{ color: 'var(--japanese-indigo)' }}
                >
                  {product.name}
                </h1>
                
                {/* Rating */}
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex items-center">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        size={18}
                        fill={i < Math.floor(product.rating) ? 'var(--metallic-gold)' : 'transparent'}
                        color="var(--metallic-gold)"
                      />
                    ))}
                  </div>
                  <span className="text-sm" style={{ color: 'var(--text-subtle)' }}>
                    {product.rating} ({product.reviews} reviews)
                  </span>
                </div>
                
                <p className="text-lg leading-relaxed" style={{ color: 'var(--text-dark)' }}>
                  {product.description}
                </p>
              </div>

              {/* Notes */}
              <div>
                <h3 className="text-sm font-semibold mb-2 uppercase tracking-wide" style={{ color: 'var(--text-subtle)' }}>
                  Fragrance Notes
                </h3>
                <div className="flex flex-wrap gap-2">
                  {product.notes?.map((note, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 rounded-full text-sm"
                      style={{ 
                        backgroundColor: 'rgba(212, 175, 55, 0.15)',
                        color: 'var(--japanese-indigo)'
                      }}
                    >
                      {note}
                    </span>
                  ))}
                </div>
              </div>

              {/* Burn Time */}
              <div className="flex items-center gap-2">
                <span className="text-sm" style={{ color: 'var(--text-subtle)' }}>Burn Time:</span>
                <span className="font-semibold" style={{ color: 'var(--japanese-indigo)' }}>
                  {product.burnTime}
                </span>
              </div>

              {/* Size Selection */}
              <div>
                <h3 className="text-sm font-semibold mb-3 uppercase tracking-wide" style={{ color: 'var(--text-subtle)' }}>
                  Select Size
                </h3>
                <div className="flex flex-wrap gap-3">
                  {product.sizes.map((size) => (
                    <button
                      key={size.size}
                      onClick={() => handleSizeChange(size)}
                      className={`px-6 py-3 rounded-lg border-2 transition-all ${
                        selectedSize?.size === size.size
                          ? 'border-[var(--metallic-gold)] bg-[var(--metallic-gold)]/10'
                          : 'border-gray-300 dark:border-slate-600 hover:border-[var(--metallic-gold)]'
                      }`}
                      data-testid={`size-${size.size}`}
                    >
                      <span className="font-semibold block" style={{ color: 'var(--japanese-indigo)' }}>
                        {size.size}
                      </span>
                      <span className="text-lg font-bold" style={{ color: 'var(--japanese-indigo)' }}>
                        ₹{size.mrp}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantity */}
              <div>
                <h3 className="text-sm font-semibold mb-3 uppercase tracking-wide" style={{ color: 'var(--text-subtle)' }}>
                  Quantity
                </h3>
                <div className="flex items-center gap-4">
                  <div className="flex items-center border rounded-lg" style={{ borderColor: 'var(--border)' }}>
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="p-3 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-l-lg transition-colors"
                      disabled={quantity <= 1}
                      data-testid="decrease-qty"
                    >
                      <Minus size={18} style={{ color: 'var(--japanese-indigo)' }} />
                    </button>
                    <span 
                      className="px-6 py-3 font-semibold min-w-[60px] text-center"
                      style={{ color: 'var(--japanese-indigo)' }}
                    >
                      {quantity}
                    </span>
                    <button
                      onClick={() => setQuantity(quantity + 1)}
                      className="p-3 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-r-lg transition-colors"
                      data-testid="increase-qty"
                    >
                      <Plus size={18} style={{ color: 'var(--japanese-indigo)' }} />
                    </button>
                  </div>
                  
                  {selectedSize && (
                    <span className="text-lg font-bold" style={{ color: 'var(--japanese-indigo)' }}>
                      Total: ₹{selectedSize.mrp * quantity}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Button
                  onClick={handleAddToCart}
                  disabled={addingToCart || !selectedSize}
                  className="flex-1 py-6 text-lg font-semibold text-white"
                  style={{ backgroundColor: 'var(--japanese-indigo)' }}
                  data-testid="add-to-cart-btn"
                >
                  {addingToCart ? (
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  ) : (
                    <ShoppingCart className="w-5 h-5 mr-2" />
                  )}
                  Add to Cart
                </Button>
                
                <Button
                  onClick={handleWishlistToggle}
                  disabled={wishlistLoading || !selectedSize}
                  variant="outline"
                  className="py-6 px-6"
                  style={{ 
                    borderColor: inWishlist ? 'var(--metallic-gold)' : 'var(--border)',
                    color: inWishlist ? 'var(--metallic-gold)' : 'var(--japanese-indigo)'
                  }}
                  data-testid="wishlist-btn"
                >
                  {wishlistLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Heart 
                      className="w-5 h-5" 
                      fill={inWishlist ? 'var(--metallic-gold)' : 'transparent'}
                    />
                  )}
                </Button>
              </div>

              {/* Trust Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-6 border-t" style={{ borderColor: 'var(--border)' }}>
                <div className="text-center">
                  <p className="font-semibold text-sm" style={{ color: 'var(--japanese-indigo)' }}>Free Shipping</p>
                  <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>Orders above ₹499</p>
                </div>
                <div className="text-center">
                  <p className="font-semibold text-sm" style={{ color: 'var(--japanese-indigo)' }}>Natural Ingredients</p>
                  <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>100% Pure</p>
                </div>
                <div className="text-center col-span-2 sm:col-span-1">
                  <p className="font-semibold text-sm" style={{ color: 'var(--japanese-indigo)' }}>Easy Returns</p>
                  <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>7-day policy</p>
                </div>
              </div>
            </div>
          </div>

          {/* Related Products Section */}
          {relatedProducts.length > 0 && (
            <div className="mt-16 pt-12 border-t" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 
                    className="text-2xl sm:text-3xl font-bold font-serif"
                    style={{ color: 'var(--japanese-indigo)' }}
                  >
                    You May Also Like
                  </h2>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-subtle)' }}>
                    Explore more premium fragrances from our collection
                  </p>
                </div>
                <Link 
                  to="/#fragrances"
                  className="hidden sm:flex items-center gap-1 text-sm font-medium hover:opacity-70 transition-opacity"
                  style={{ color: 'var(--metallic-gold)' }}
                >
                  View All
                  <ArrowRight size={16} />
                </Link>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {relatedProducts.map((relatedProduct) => (
                  <Link
                    key={relatedProduct.id}
                    to={`/products/${relatedProduct.id}`}
                    className="group block rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300"
                    style={{ backgroundColor: 'white' }}
                    data-testid={`related-product-${relatedProduct.id}`}
                  >
                    {/* Product Image */}
                    <div className="relative aspect-[4/3] overflow-hidden">
                      <img
                        src={relatedProduct.image}
                        alt={relatedProduct.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div 
                        className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"
                      />
                      <div className="absolute bottom-3 left-3 right-3">
                        <p 
                          className="text-xs font-medium mb-1"
                          style={{ color: 'var(--metallic-gold)' }}
                        >
                          {relatedProduct.tagline}
                        </p>
                        <h3 className="text-lg font-bold text-white">
                          {relatedProduct.name}
                        </h3>
                      </div>
                    </div>
                    
                    {/* Product Info */}
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1">
                          <Star size={14} fill="var(--metallic-gold)" color="var(--metallic-gold)" />
                          <span className="text-sm font-semibold" style={{ color: 'var(--japanese-indigo)' }}>
                            {relatedProduct.rating}
                          </span>
                          <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                            ({relatedProduct.reviews})
                          </span>
                        </div>
                        <span 
                          className="text-lg font-bold"
                          style={{ color: 'var(--japanese-indigo)' }}
                        >
                          ₹{relatedProduct.sizes[0]?.mrp}
                        </span>
                      </div>
                      
                      <p className="text-xs line-clamp-2" style={{ color: 'var(--text-subtle)' }}>
                        {relatedProduct.description}
                      </p>
                      
                      <div className="mt-3 flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--metallic-gold)' }}>
                        View Details
                        <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
              
              {/* Mobile View All Link */}
              <div className="mt-6 text-center sm:hidden">
                <Link 
                  to="/#fragrances"
                  className="inline-flex items-center gap-1 text-sm font-medium"
                  style={{ color: 'var(--metallic-gold)' }}
                >
                  View All Fragrances
                  <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default ProductPage;
