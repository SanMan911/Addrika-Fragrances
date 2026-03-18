import React, { useState, useEffect } from 'react';
import { RefreshCw, ShoppingCart, Package, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { toast } from 'sonner';

const QuickReorder = () => {
  const { isAuthenticated, getUserOrders } = useAuth();
  const { addToCart } = useCart();
  const [lastOrder, setLastOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reordering, setReordering] = useState(false);

  useEffect(() => {
    const fetchLastOrder = async () => {
      if (!isAuthenticated) {
        setLoading(false);
        return;
      }

      try {
        const orders = await getUserOrders();
        if (orders && orders.length > 0) {
          // Get the most recent completed order
          const completedOrders = orders.filter(
            o => o.payment_status === 'paid' || o.order_status === 'delivered'
          );
          if (completedOrders.length > 0) {
            setLastOrder(completedOrders[0]);
          }
        }
      } catch (error) {
        console.error('Failed to fetch orders:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLastOrder();
  }, [isAuthenticated, getUserOrders]);

  const handleReorder = async () => {
    if (!lastOrder?.items) return;

    setReordering(true);
    try {
      let addedCount = 0;
      for (const item of lastOrder.items) {
        // Add each item from the last order to the cart
        addToCart({
          id: item.productId,
          productId: item.productId,
          name: item.name,
          size: item.size,
          price: item.mrp || item.price,
          mrp: item.mrp || item.price,
          quantity: item.quantity,
          image: item.image || '/placeholder-product.jpg'
        });
        addedCount += item.quantity;
      }
      toast.success(`Added ${addedCount} item${addedCount > 1 ? 's' : ''} to cart!`);
    } catch (error) {
      console.error('Reorder failed:', error);
      toast.error('Failed to add items to cart');
    } finally {
      setReordering(false);
    }
  };

  // Don't render if not authenticated or no last order
  if (!isAuthenticated || loading) {
    return null;
  }

  if (!lastOrder) {
    return null;
  }

  // Format order date
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-IN', { 
        day: 'numeric', 
        month: 'short'
      });
    } catch {
      return '';
    }
  };

  const orderDate = formatDate(lastOrder.created_at || lastOrder.paid_at);
  const itemCount = lastOrder.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  const totalAmount = lastOrder.pricing?.final_total || lastOrder.pricing?.mrp_total || 0;

  return (
    <div 
      className="mx-auto max-w-md px-4 mb-8 animate-fade-in"
      data-testid="quick-reorder-section"
    >
      <div 
        className="relative overflow-hidden rounded-2xl p-4 shadow-lg"
        style={{ 
          background: 'linear-gradient(135deg, var(--japanese-indigo) 0%, #2a4a5e 100%)',
          border: '1px solid rgba(212, 175, 55, 0.3)'
        }}
      >
        {/* Decorative gold accent */}
        <div 
          className="absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl opacity-20"
          style={{ backgroundColor: 'var(--metallic-gold)' }}
        />
        
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div 
                className="p-2 rounded-full"
                style={{ backgroundColor: 'rgba(212, 175, 55, 0.2)' }}
              >
                <RefreshCw size={18} style={{ color: 'var(--metallic-gold)' }} />
              </div>
              <div>
                <h3 className="font-semibold text-white text-sm">
                  Reorder Your Last Purchase
                </h3>
                <p className="text-xs text-gray-300">
                  {orderDate} • {itemCount} item{itemCount > 1 ? 's' : ''} • ₹{totalAmount.toFixed(0)}
                </p>
              </div>
            </div>
          </div>

          {/* Items preview */}
          <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
            {lastOrder.items?.slice(0, 3).map((item, idx) => (
              <div 
                key={idx}
                className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
              >
                <Package size={14} className="text-gray-300" />
                <span className="text-xs text-white whitespace-nowrap">
                  {item.name} ({item.size})
                </span>
              </div>
            ))}
            {lastOrder.items?.length > 3 && (
              <div 
                className="flex-shrink-0 flex items-center px-3 py-2 rounded-lg"
                style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
              >
                <span className="text-xs text-gray-300">
                  +{lastOrder.items.length - 3} more
                </span>
              </div>
            )}
          </div>

          <Button
            onClick={handleReorder}
            disabled={reordering}
            className="w-full text-sm font-semibold py-5 group"
            style={{ 
              backgroundColor: 'var(--metallic-gold)',
              color: 'var(--japanese-indigo)'
            }}
            data-testid="quick-reorder-btn"
          >
            {reordering ? (
              <span className="flex items-center gap-2">
                <RefreshCw size={16} className="animate-spin" />
                Adding to Cart...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <ShoppingCart size={16} />
                Add All to Cart
                <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default QuickReorder;
