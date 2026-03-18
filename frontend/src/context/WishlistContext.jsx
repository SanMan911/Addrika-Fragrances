import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';

const WishlistContext = createContext();

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error('useWishlist must be used within WishlistProvider');
  }
  return context;
};

export const WishlistProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [wishlistItems, setWishlistItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [shareCode, setShareCode] = useState(null);
  const [isShared, setIsShared] = useState(false);

  // Fetch wishlist from server
  const fetchWishlist = useCallback(async () => {
    if (!isAuthenticated) {
      setWishlistItems([]);
      setShareCode(null);
      setIsShared(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/wishlist`, {
        withCredentials: true
      });
      setWishlistItems(response.data.items || []);
      setShareCode(response.data.share_code);
      setIsShared(response.data.is_shared || false);
    } catch (error) {
      console.error('Failed to fetch wishlist:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  // Fetch on auth change
  useEffect(() => {
    fetchWishlist();
  }, [fetchWishlist]);

  // Add item to wishlist
  const addToWishlist = async (item) => {
    if (!isAuthenticated) {
      toast.error('Please login to add items to wishlist');
      return false;
    }

    try {
      const response = await axios.post(
        `${API_URL}/api/wishlist/add`,
        {
          item: {
            productId: item.productId || item.id,
            name: item.name,
            size: item.size,
            price: item.price,
            mrp: item.mrp || item.price,
            image: item.image
          }
        },
        { withCredentials: true }
      );
      setWishlistItems(response.data.items || []);
      toast.success(`${item.name} added to wishlist!`);
      return true;
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to add to wishlist';
      toast.error(message);
      return false;
    }
  };

  // Remove item from wishlist
  const removeFromWishlist = async (productId, size) => {
    try {
      const response = await axios.delete(
        `${API_URL}/api/wishlist/remove/${productId}/${size}`,
        { withCredentials: true }
      );
      setWishlistItems(response.data.items || []);
      toast.success('Item removed from wishlist');
      return true;
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to remove item';
      toast.error(message);
      return false;
    }
  };

  // Check if item is in wishlist
  const isInWishlist = (productId, size) => {
    return wishlistItems.some(
      item => item.productId === productId && item.size === size
    );
  };

  // Share wishlist
  const shareWishlist = async (message = null, recipientName = null) => {
    try {
      const response = await axios.post(
        `${API_URL}/api/wishlist/share`,
        { message, recipient_name: recipientName },
        { withCredentials: true }
      );
      setShareCode(response.data.share_code);
      setIsShared(true);
      toast.success('Wishlist is now shareable!');
      return response.data;
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to share wishlist';
      toast.error(message);
      return null;
    }
  };

  // Unshare wishlist
  const unshareWishlist = async () => {
    try {
      await axios.delete(`${API_URL}/api/wishlist/share`, {
        withCredentials: true
      });
      setIsShared(false);
      toast.success('Wishlist sharing disabled');
      return true;
    } catch (error) {
      toast.error('Failed to disable sharing');
      return false;
    }
  };

  // Clear wishlist
  const clearWishlist = async () => {
    try {
      await axios.post(`${API_URL}/api/wishlist/clear`, {}, {
        withCredentials: true
      });
      setWishlistItems([]);
      setIsShared(false);
      toast.success('Wishlist cleared');
      return true;
    } catch (error) {
      toast.error('Failed to clear wishlist');
      return false;
    }
  };

  // Get shared wishlist (public)
  const getSharedWishlist = async (code) => {
    try {
      const response = await axios.get(`${API_URL}/api/wishlist/shared/${code}`);
      return response.data;
    } catch (error) {
      const message = error.response?.data?.detail || 'Wishlist not found';
      toast.error(message);
      return null;
    }
  };

  const value = {
    wishlistItems,
    isLoading,
    shareCode,
    isShared,
    wishlistCount: wishlistItems.length,
    addToWishlist,
    removeFromWishlist,
    isInWishlist,
    shareWishlist,
    unshareWishlist,
    clearWishlist,
    getSharedWishlist,
    refreshWishlist: fetchWishlist
  };

  return (
    <WishlistContext.Provider value={value}>
      {children}
    </WishlistContext.Provider>
  );
};
