import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Heart, Trash2, ShoppingCart, Share2, Copy, Check, X, ArrowLeft, Home, Gift, ExternalLink } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import SEO from '../components/SEO';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const WishlistPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { 
    wishlistItems, 
    isLoading, 
    shareCode, 
    isShared,
    removeFromWishlist, 
    shareWishlist, 
    unshareWishlist,
    clearWishlist 
  } = useWishlist();
  const { addToCart } = useCart();

  const [showShareModal, setShowShareModal] = useState(false);
  const [shareMessage, setShareMessage] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);

  const handleAddToCart = (item) => {
    addToCart({
      id: item.productId,
      productId: item.productId,
      name: item.name,
      size: item.size,
      price: item.mrp || item.price,
      mrp: item.mrp || item.price,
      quantity: 1,
      image: item.image
    });
    toast.success(`${item.name} added to cart!`);
  };

  const handleAddAllToCart = () => {
    wishlistItems.forEach(item => {
      addToCart({
        id: item.productId,
        productId: item.productId,
        name: item.name,
        size: item.size,
        price: item.mrp || item.price,
        mrp: item.mrp || item.price,
        quantity: 1,
        image: item.image
      });
    });
    toast.success(`${wishlistItems.length} items added to cart!`);
  };

  const handleShare = async () => {
    setSharing(true);
    const result = await shareWishlist(shareMessage || null, recipientName || null);
    setSharing(false);
    if (result) {
      setShowShareModal(false);
    }
  };

  const handleCopyLink = () => {
    const shareUrl = `${window.location.origin}/wishlist/shared/${shareCode}`;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success('Link copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const calculateTotal = () => {
    return wishlistItems.reduce((total, item) => total + (item.mrp || item.price), 0);
  };

  // Not logged in view
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col bg-white dark:bg-slate-900">
        <Header />
        <main className="flex-1 pt-24 pb-16">
          <div className="max-w-2xl mx-auto px-4 py-12 text-center">
            <div 
              className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center"
              style={{ backgroundColor: 'var(--japanese-indigo)' }}
            >
              <Heart size={40} color="white" />
            </div>
            <h1 className="text-3xl font-bold mb-4" style={{ color: 'var(--japanese-indigo)' }}>
              Your Wishlist
            </h1>
            <p className="text-lg mb-6 text-gray-600 dark:text-gray-400">
              Please login to view and manage your wishlist
            </p>
            <Link to="/login">
              <Button 
                className="text-white px-8 py-6"
                style={{ backgroundColor: 'var(--japanese-indigo)' }}
              >
                Login to Continue
              </Button>
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-slate-900">
      <SEO 
        title="My Wishlist | Addrika Premium Incense"
        description="View and manage your saved Addrika products. Share your wishlist with friends and family or add items to cart."
        url="https://centraders.com/wishlist"
        noIndex={true}
      />
      <Header />
      
      <main className="flex-1 pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Navigation */}
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 hover:opacity-70 transition-opacity"
              style={{ color: 'var(--japanese-indigo)' }}
            >
              <ArrowLeft size={20} />
              <span>Back</span>
            </button>
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 hover:opacity-70 transition-opacity"
              style={{ color: 'var(--japanese-indigo)' }}
            >
              <Home size={20} />
              <span>Home</span>
            </button>
          </div>

          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <Heart size={32} style={{ color: 'var(--metallic-gold)' }} fill="var(--metallic-gold)" />
              <h1 className="text-3xl font-bold" style={{ color: 'var(--japanese-indigo)' }}>
                My Wishlist
              </h1>
              {wishlistItems.length > 0 && (
                <span 
                  className="px-3 py-1 rounded-full text-sm font-medium"
                  style={{ backgroundColor: 'var(--cream)', color: 'var(--japanese-indigo)' }}
                >
                  {wishlistItems.length} item{wishlistItems.length > 1 ? 's' : ''}
                </span>
              )}
            </div>

            {wishlistItems.length > 0 && (
              <div className="flex gap-2">
                <Button
                  onClick={() => setShowShareModal(true)}
                  variant="outline"
                  className="flex items-center gap-2"
                  style={{ borderColor: 'var(--metallic-gold)', color: 'var(--metallic-gold)' }}
                  data-testid="share-wishlist-btn"
                >
                  <Share2 size={18} />
                  Share
                </Button>
                <Button
                  onClick={handleAddAllToCart}
                  className="flex items-center gap-2 text-white"
                  style={{ backgroundColor: 'var(--japanese-indigo)' }}
                  data-testid="add-all-to-cart-btn"
                >
                  <ShoppingCart size={18} />
                  Add All to Cart
                </Button>
              </div>
            )}
          </div>

          {/* Share status banner */}
          {isShared && shareCode && (
            <div 
              className="mb-6 p-4 rounded-lg flex items-center justify-between"
              style={{ backgroundColor: 'var(--cream)', border: '1px solid var(--metallic-gold)' }}
            >
              <div className="flex items-center gap-3">
                <Gift size={24} style={{ color: 'var(--metallic-gold)' }} />
                <div>
                  <p className="font-semibold" style={{ color: 'var(--japanese-indigo)' }}>
                    Your wishlist is being shared!
                  </p>
                  <p className="text-sm text-gray-600">
                    Anyone with the link can view and purchase items for you
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleCopyLink}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? 'Copied!' : 'Copy Link'}
                </Button>
                <Button
                  onClick={unshareWishlist}
                  variant="ghost"
                  size="sm"
                  className="text-red-500"
                >
                  Stop Sharing
                </Button>
              </div>
            </div>
          )}

          {/* Empty state */}
          {wishlistItems.length === 0 ? (
            <div className="text-center py-16">
              <Heart size={64} className="mx-auto mb-4 text-gray-300" />
              <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--japanese-indigo)' }}>
                Your wishlist is empty
              </h2>
              <p className="text-gray-500 mb-6">
                Save items you love by clicking the heart icon on products
              </p>
              <Link to="/#categories">
                <Button 
                  className="text-white"
                  style={{ backgroundColor: 'var(--japanese-indigo)' }}
                >
                  Explore Products
                </Button>
              </Link>
            </div>
          ) : (
            <>
              {/* Wishlist items */}
              <div className="space-y-4 mb-8">
                {wishlistItems.map((item, index) => (
                  <div 
                    key={`${item.productId}-${item.size}`}
                    className="flex items-center gap-4 p-4 rounded-lg bg-white dark:bg-slate-800 shadow-md"
                    style={{ border: '1px solid var(--border)' }}
                    data-testid={`wishlist-item-${index}`}
                  >
                    <img
                      src={item.image || '/placeholder-product.jpg'}
                      alt={item.name}
                      className="w-20 h-20 object-cover rounded-lg"
                    />
                    <div className="flex-1">
                      <h3 className="font-semibold" style={{ color: 'var(--japanese-indigo)' }}>
                        {item.name}
                      </h3>
                      <p className="text-sm text-gray-500">{item.size}</p>
                      <p className="font-bold mt-1" style={{ color: 'var(--metallic-gold)' }}>
                        ₹{(item.mrp || item.price).toFixed(2)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => handleAddToCart(item)}
                        size="sm"
                        className="text-white"
                        style={{ backgroundColor: 'var(--japanese-indigo)' }}
                      >
                        <ShoppingCart size={16} className="mr-1" />
                        Add to Cart
                      </Button>
                      <Button
                        onClick={() => removeFromWishlist(item.productId, item.size)}
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 size={18} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div 
                className="p-4 rounded-lg text-right"
                style={{ backgroundColor: 'var(--cream)' }}
              >
                <p className="text-sm text-gray-600">Total Value</p>
                <p className="text-2xl font-bold" style={{ color: 'var(--metallic-gold)' }}>
                  ₹{calculateTotal().toFixed(2)}
                </p>
              </div>

              {/* Clear wishlist */}
              <div className="mt-4 text-center">
                <button
                  onClick={clearWishlist}
                  className="text-sm text-gray-500 hover:text-red-500 underline"
                >
                  Clear entire wishlist
                </button>
              </div>
            </>
          )}
        </div>
      </main>

      <Footer />

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div 
            className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6"
            data-testid="share-modal"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold" style={{ color: 'var(--japanese-indigo)' }}>
                Share Your Wishlist
              </h2>
              <button onClick={() => setShowShareModal(false)}>
                <X size={24} className="text-gray-500" />
              </button>
            </div>

            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Share your wishlist with friends and family. They can view your items and even purchase them as a gift!
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--japanese-indigo)' }}>
                  Recipient's Name (optional)
                </label>
                <Input
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="e.g., Mom, Dad, Best Friend"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--japanese-indigo)' }}>
                  Add a Message (optional)
                </label>
                <textarea
                  value={shareMessage}
                  onChange={(e) => setShareMessage(e.target.value)}
                  placeholder="e.g., These are my favorite incense scents!"
                  className="w-full p-3 border rounded-lg resize-none h-24"
                  style={{ borderColor: 'var(--border)' }}
                />
              </div>

              {isShared && shareCode && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200">
                  <p className="text-sm text-green-700 dark:text-green-300 mb-2">
                    Your shareable link:
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={`${window.location.origin}/wishlist/shared/${shareCode}`}
                      className="flex-1 p-2 text-sm bg-white dark:bg-slate-700 border rounded"
                    />
                    <Button onClick={handleCopyLink} size="sm" variant="outline">
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                onClick={() => setShowShareModal(false)}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleShare}
                disabled={sharing}
                className="flex-1 text-white"
                style={{ backgroundColor: 'var(--japanese-indigo)' }}
              >
                {sharing ? 'Creating Link...' : isShared ? 'Update & Copy Link' : 'Create Shareable Link'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WishlistPage;
