import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Gift, ShoppingCart, Heart, ArrowLeft, Home, Loader2, AlertCircle, Check, CreditCard } from 'lucide-react';
import axios from 'axios';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { useCart } from '../context/CartContext';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const SharedWishlistPage = () => {
  const { shareCode } = useParams();
  const navigate = useNavigate();
  const { addToCart, setIsCartOpen } = useCart();

  const [wishlist, setWishlist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedItems, setSelectedItems] = useState([]);
  const [addingToCart, setAddingToCart] = useState(false);

  useEffect(() => {
    const fetchSharedWishlist = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/wishlist/shared/${shareCode}`);
        setWishlist(response.data);
        // Select all items by default
        setSelectedItems(response.data.items.map((_, idx) => idx));
      } catch (err) {
        setError(err.response?.data?.detail || 'Wishlist not found or no longer shared');
      } finally {
        setLoading(false);
      }
    };

    if (shareCode) {
      fetchSharedWishlist();
    }
  }, [shareCode]);

  const toggleItemSelection = (index) => {
    setSelectedItems(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  const selectAll = () => {
    if (selectedItems.length === wishlist.items.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(wishlist.items.map((_, idx) => idx));
    }
  };

  const handleAddSelectedToCart = () => {
    setAddingToCart(true);
    const itemsToAdd = selectedItems.map(idx => wishlist.items[idx]);
    
    itemsToAdd.forEach(item => {
      addToCart({
        id: item.productId,
        productId: item.productId,
        name: item.name,
        size: item.size,
        price: item.mrp || item.price,
        mrp: item.mrp || item.price,
        quantity: 1,
        image: item.image,
        isGift: true,
        giftFor: wishlist.owner_name
      });
    });

    toast.success(`${itemsToAdd.length} item${itemsToAdd.length > 1 ? 's' : ''} added to cart as gift!`);
    setAddingToCart(false);
    setIsCartOpen(true);
  };

  const handleBuyNow = () => {
    handleAddSelectedToCart();
    setTimeout(() => {
      navigate('/checkout');
    }, 500);
  };

  const calculateSelectedTotal = () => {
    return selectedItems.reduce((total, idx) => {
      const item = wishlist.items[idx];
      return total + (item.mrp || item.price);
    }, 0);
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-white dark:bg-slate-900">
        <Header />
        <main className="flex-1 pt-24 pb-16 flex items-center justify-center">
          <div className="text-center">
            <Loader2 size={48} className="animate-spin mx-auto mb-4" style={{ color: 'var(--metallic-gold)' }} />
            <p className="text-gray-600">Loading wishlist...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex flex-col bg-white dark:bg-slate-900">
        <Header />
        <main className="flex-1 pt-24 pb-16">
          <div className="max-w-2xl mx-auto px-4 py-12 text-center">
            <AlertCircle size={64} className="mx-auto mb-4 text-red-500" />
            <h1 className="text-2xl font-bold mb-4" style={{ color: 'var(--japanese-indigo)' }}>
              Wishlist Not Found
            </h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <Button 
              onClick={() => navigate('/')}
              className="text-white"
              style={{ backgroundColor: 'var(--japanese-indigo)' }}
            >
              Go to Homepage
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-slate-900">
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

          {/* Gift banner */}
          <div 
            className="mb-8 p-6 rounded-xl text-center"
            style={{ 
              background: 'linear-gradient(135deg, var(--japanese-indigo) 0%, #2a4a5e 100%)',
              border: '2px solid var(--metallic-gold)'
            }}
          >
            <Gift size={48} className="mx-auto mb-3" style={{ color: 'var(--metallic-gold)' }} />
            <h1 className="text-2xl font-bold text-white mb-2">
              {wishlist.owner_name}'s Wishlist
            </h1>
            {wishlist.message && (
              <p className="text-gray-200 italic mb-3">"{wishlist.message}"</p>
            )}
            <p className="text-gray-300 text-sm">
              Select items to purchase as a gift for {wishlist.owner_name}
            </p>
          </div>

          {/* Selection controls */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={selectAll}
              className="text-sm font-medium hover:underline"
              style={{ color: 'var(--metallic-gold)' }}
            >
              {selectedItems.length === wishlist.items.length ? 'Deselect All' : 'Select All'}
            </button>
            <p className="text-sm text-gray-600">
              {selectedItems.length} of {wishlist.items.length} items selected
            </p>
          </div>

          {/* Wishlist items */}
          <div className="space-y-4 mb-8">
            {wishlist.items.map((item, index) => {
              const isSelected = selectedItems.includes(index);
              return (
                <div 
                  key={`${item.productId}-${item.size}`}
                  onClick={() => toggleItemSelection(index)}
                  className={`flex items-center gap-4 p-4 rounded-lg cursor-pointer transition-all ${
                    isSelected 
                      ? 'bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-500' 
                      : 'bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 hover:border-amber-300'
                  }`}
                  data-testid={`shared-wishlist-item-${index}`}
                >
                  {/* Selection checkbox */}
                  <div 
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      isSelected ? 'bg-amber-500 border-amber-500' : 'border-gray-300'
                    }`}
                  >
                    {isSelected && <Check size={14} className="text-white" />}
                  </div>

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
                </div>
              );
            })}
          </div>

          {/* Purchase section */}
          {selectedItems.length > 0 && (
            <div 
              className="sticky bottom-4 p-6 rounded-xl shadow-lg"
              style={{ 
                backgroundColor: 'white',
                border: '2px solid var(--metallic-gold)'
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-gray-600">
                    Gift for {wishlist.owner_name}
                  </p>
                  <p className="text-2xl font-bold" style={{ color: 'var(--metallic-gold)' }}>
                    ₹{calculateSelectedTotal().toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {selectedItems.length} item{selectedItems.length > 1 ? 's' : ''} selected
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={handleAddSelectedToCart}
                    disabled={addingToCart}
                    variant="outline"
                    className="flex items-center gap-2"
                    style={{ borderColor: 'var(--japanese-indigo)', color: 'var(--japanese-indigo)' }}
                  >
                    <ShoppingCart size={18} />
                    Add to Cart
                  </Button>
                  <Button
                    onClick={handleBuyNow}
                    disabled={addingToCart}
                    className="flex items-center gap-2 text-white px-6"
                    style={{ backgroundColor: 'var(--japanese-indigo)' }}
                    data-testid="buy-gift-btn"
                  >
                    <CreditCard size={18} />
                    Buy as Gift
                  </Button>
                </div>
              </div>
              <p className="text-xs text-center text-gray-500">
                The order will be shipped to {wishlist.owner_name}'s address
              </p>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default SharedWishlistPage;
