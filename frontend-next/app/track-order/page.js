'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, Package, Truck, CheckCircle, Clock, Loader2 } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://ecommerce-nextjs-2.preview.emergentagent.com';

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
        return <CheckCircle className="w-6 h-6 text-green-500" />;
      case 'shipped':
      case 'in_transit':
        return <Truck className="w-6 h-6 text-blue-500" />;
      case 'processing':
        return <Package className="w-6 h-6 text-yellow-500" />;
      default:
        return <Clock className="w-6 h-6 text-gray-500" />;
    }
  };

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
        <div className="max-w-xl mx-auto px-4">
          {/* Header */}
          <div className="text-center mb-8">
            <Package className="w-16 h-16 text-[#D4AF37] mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-[#2B3A4A] font-serif mb-2">
              Track Your Order
            </h1>
            <p className="text-gray-600">
              Enter your order number to see the current status
            </p>
          </div>

          {/* Search Form */}
          <form onSubmit={handleTrack} className="bg-white rounded-xl p-6 shadow-sm mb-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#2B3A4A] mb-1">
                  Order Number *
                </label>
                <input
                  type="text"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  placeholder="e.g., ADD-123456"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#2B3A4A] mb-1">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#2B3A4A] text-white py-3 rounded-lg font-semibold hover:bg-[#1a252f] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
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

          {/* Error */}
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
              {error}
            </div>
          )}

          {/* Order Details */}
          {order && (
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                {getStatusIcon(order.status)}
                <div>
                  <p className="font-semibold text-[#2B3A4A]">Order #{order.order_number}</p>
                  <p className="text-sm text-gray-500 capitalize">{order.status?.replace('_', ' ')}</p>
                </div>
              </div>
              
              {order.tracking_number && (
                <div className="bg-[#F5F0E8] rounded-lg p-4 mb-4">
                  <p className="text-sm text-gray-600">Tracking Number</p>
                  <p className="font-semibold text-[#2B3A4A]">{order.tracking_number}</p>
                </div>
              )}
              
              {order.estimated_delivery && (
                <p className="text-sm text-gray-600">
                  <strong>Estimated Delivery:</strong> {order.estimated_delivery}
                </p>
              )}
            </div>
          )}

          {/* Help */}
          <div className="text-center mt-8">
            <p className="text-gray-600 text-sm">
              Can&apos;t find your order? Contact us at{' '}
              <a href="mailto:contact.us@centraders.com" className="text-[#D4AF37] hover:underline">
                contact.us@centraders.com
              </a>
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#2B3A4A] text-white py-12 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-[#D4AF37] font-bold text-xl mb-2">Addrika</p>
          <p className="text-sm text-gray-400">© 2026 Centsibl Traders Private Limited. All rights reserved.</p>
        </div>
      </footer>
    </>
  );
}
