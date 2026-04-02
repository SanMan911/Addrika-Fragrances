'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, Package, Truck, CheckCircle, Clock, Loader2, ArrowRight } from 'lucide-react';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://auth-preview-23.preview.emergentagent.com';

export default function TrackOrderPage() {
  const [orderNumber, setOrderNumber] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');

  const handleTrack = async (e) => {
    e.preventDefault();
    if (!orderNumber.trim()) {
      setError('Please enter an order number');
      return;
    }
    
    setLoading(true);
    setError('');
    setOrder(null);
    
    try {
      const res = await fetch(`${API_URL}/api/orders/track/${orderNumber}?email=${encodeURIComponent(email)}`);
      if (res.ok) {
        const data = await res.json();
        setOrder(data);
      } else if (res.status === 404) {
        setError('Order not found. Please check your order number.');
      } else {
        setError('Unable to track order. Please try again.');
      }
    } catch (err) {
      setError('Unable to track order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'delivered':
        return <CheckCircle className="w-6 h-6 text-green-400" />;
      case 'shipped':
      case 'in_transit':
        return <Truck className="w-6 h-6 text-blue-400" />;
      case 'processing':
        return <Package className="w-6 h-6 text-yellow-400" />;
      default:
        return <Clock className="w-6 h-6 text-gray-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'delivered':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'shipped':
      case 'in_transit':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'processing':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #0f1419 0%, #1a2332 100%)' }}>
      <Header />
      
      <main className="pt-24 pb-16">
        <div className="max-w-xl mx-auto px-4">
          {/* Header */}
          <div className="text-center mb-10">
            <div 
              className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(212,175,55,0.15)' }}
            >
              <Package className="w-10 h-10 text-[#D4AF37]" />
            </div>
            <h1 
              className="text-3xl sm:text-4xl font-bold text-white mb-3"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Track Your Order
            </h1>
            <p className="text-gray-400">
              Enter your order number to see the current status
            </p>
          </div>

          {/* Search Form */}
          <form onSubmit={handleTrack} className="mb-8">
            <div 
              className="p-6 rounded-2xl space-y-4"
              style={{ 
                background: 'linear-gradient(165deg, rgba(26,26,46,0.8) 0%, rgba(22,33,62,0.8) 100%)',
                border: '1px solid rgba(255,255,255,0.1)'
              }}
            >
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Order Number *
                </label>
                <input
                  type="text"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  placeholder="e.g., ADD20250101-XXXX"
                  className="w-full px-4 py-3 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                  style={{ 
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Email (optional)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Your email address"
                  className="w-full px-4 py-3 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                  style={{ 
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}
                />
              </div>
              
              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                  {error}
                </div>
              )}
              
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                style={{ 
                  background: 'linear-gradient(135deg, #D4AF37 0%, #c9a432 100%)',
                  color: '#1a1a2e'
                }}
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Search className="w-5 h-5" />
                )}
                Track Order
              </button>
            </div>
          </form>

          {/* Order Result */}
          {order && (
            <div 
              className="p-6 rounded-2xl"
              style={{ 
                background: 'linear-gradient(165deg, rgba(26,26,46,0.8) 0%, rgba(22,33,62,0.8) 100%)',
                border: '1px solid rgba(255,255,255,0.1)'
              }}
            >
              <div className="flex items-start justify-between mb-6">
                <div>
                  <p className="text-gray-500 text-sm">Order Number</p>
                  <p className="text-[#D4AF37] font-mono font-semibold">{order.order_id}</p>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(order.status)}`}>
                  {order.status?.replace('_', ' ').toUpperCase()}
                </div>
              </div>

              <div className="flex items-center gap-4 mb-6">
                {getStatusIcon(order.status)}
                <div>
                  <p className="text-white font-medium">
                    {order.status === 'delivered' ? 'Delivered!' : 
                     order.status === 'shipped' ? 'On its way' :
                     order.status === 'processing' ? 'Processing your order' : 'Order placed'}
                  </p>
                  {order.estimated_delivery && (
                    <p className="text-gray-400 text-sm">
                      Estimated delivery: {new Date(order.estimated_delivery).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>

              {/* Order Items */}
              {order.items && order.items.length > 0 && (
                <div className="border-t border-white/10 pt-4">
                  <p className="text-gray-400 text-sm mb-3">Items in your order:</p>
                  <div className="space-y-2">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-gray-300">{item.name} ({item.size}) × {item.quantity}</span>
                        <span className="text-white">₹{item.price * item.quantity}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between mt-4 pt-4 border-t border-white/10">
                    <span className="font-semibold text-white">Total</span>
                    <span className="font-bold text-[#D4AF37]">₹{order.total}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Help Section */}
          <div className="mt-8 text-center">
            <p className="text-gray-500 text-sm mb-2">Need help with your order?</p>
            <a 
              href="mailto:contact.us@centraders.com"
              className="text-[#D4AF37] hover:underline text-sm flex items-center justify-center gap-1"
            >
              Contact Support
              <ArrowRight size={14} />
            </a>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
