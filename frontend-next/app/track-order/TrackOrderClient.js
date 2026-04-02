'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Package, Search, Truck, CheckCircle, Clock, MapPin, ArrowRight } from 'lucide-react';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { toast } from 'sonner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export default function TrackOrderClient() {
  const [orderId, setOrderId] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [orderData, setOrderData] = useState(null);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setOrderData(null);

    if (!orderId.trim()) {
      setError('Please enter your Order ID');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/orders/track/${orderId.trim()}${email ? `?email=${encodeURIComponent(email)}` : ''}`);
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Order not found');
      }
      
      const data = await response.json();
      setOrderData(data);
    } catch (err) {
      setError(err.message || 'Unable to find order. Please check your Order ID.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'delivered': return 'text-green-500';
      case 'shipped': case 'in_transit': return 'text-blue-500';
      case 'processing': case 'confirmed': return 'text-yellow-500';
      case 'cancelled': return 'text-red-500';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'delivered': return <CheckCircle className="text-green-500" size={24} />;
      case 'shipped': case 'in_transit': return <Truck className="text-blue-500" size={24} />;
      case 'processing': case 'confirmed': return <Clock className="text-yellow-500" size={24} />;
      default: return <Package className="text-gray-400" size={24} />;
    }
  };

  const inputStyles = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.15)',
    color: 'white'
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg, #0f1419 0%, #1a2332 100%)' }}>
      <Header />

      <main className="flex-1 pt-24 pb-16 px-4">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-10">
            <div 
              className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(212,175,55,0.15)' }}
            >
              <Truck className="w-10 h-10 text-[#D4AF37]" />
            </div>
            <h1 
              className="text-3xl sm:text-4xl font-bold text-white mb-3"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Track Your Order
            </h1>
            <p className="text-gray-400">
              Enter your Order ID to check the status of your shipment
            </p>
          </div>

          {/* Search Form */}
          <div 
            className="rounded-2xl p-6 sm:p-8 mb-8"
            style={{ 
              background: 'linear-gradient(165deg, rgba(26,26,46,0.9) 0%, rgba(22,33,62,0.9) 100%)',
              border: '1px solid rgba(255,255,255,0.1)'
            }}
          >
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="orderId" className="block text-sm font-medium text-gray-300 mb-2">
                  Order ID *
                </label>
                <div className="relative">
                  <Package className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                  <input
                    id="orderId"
                    type="text"
                    value={orderId}
                    onChange={(e) => setOrderId(e.target.value)}
                    placeholder="e.g., ORD-XXXX-XXXX"
                    className="w-full pl-12 pr-4 py-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D4AF37] placeholder-gray-500"
                    style={inputStyles}
                    data-testid="track-order-id-input"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                  Email (Optional - for faster lookup)
                </label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full pl-12 pr-4 py-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D4AF37] placeholder-gray-500"
                    style={inputStyles}
                    data-testid="track-order-email-input"
                  />
                </div>
              </div>

              {error && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-xl font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ 
                  background: 'linear-gradient(135deg, #D4AF37 0%, #c9a432 100%)',
                  color: '#1a1a2e'
                }}
                data-testid="track-order-submit-btn"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search size={18} />
                    Track Order
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Order Results */}
          {orderData && (
            <div 
              className="rounded-2xl p-6 sm:p-8"
              style={{ 
                background: 'linear-gradient(165deg, rgba(26,26,46,0.9) 0%, rgba(22,33,62,0.9) 100%)',
                border: '1px solid rgba(255,255,255,0.1)'
              }}
              data-testid="track-order-result"
            >
              <div className="flex items-center gap-4 mb-6">
                {getStatusIcon(orderData.order_status)}
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    Order {orderData.order_id}
                  </h2>
                  <p className={`text-sm font-medium capitalize ${getStatusColor(orderData.order_status)}`}>
                    {orderData.order_status?.replace(/_/g, ' ')}
                  </p>
                </div>
              </div>

              {orderData.tracking_number && (
                <div className="p-4 rounded-xl mb-4" style={{ background: 'rgba(212,175,55,0.1)' }}>
                  <p className="text-sm text-gray-400 mb-1">Tracking Number</p>
                  <p className="text-lg font-semibold text-[#D4AF37]">{orderData.tracking_number}</p>
                </div>
              )}

              {orderData.estimated_delivery && (
                <div className="p-4 rounded-xl mb-4" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <p className="text-sm text-gray-400 mb-1">Estimated Delivery</p>
                  <p className="text-white font-medium">{orderData.estimated_delivery}</p>
                </div>
              )}

              <Link
                href={`/orders?id=${orderData.order_id}`}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-medium text-[#D4AF37] transition-all hover:bg-[#D4AF37]/10"
                style={{ border: '1px solid rgba(212,175,55,0.3)' }}
              >
                View Full Order Details
                <ArrowRight size={16} />
              </Link>
            </div>
          )}

          {/* Help Text */}
          <div className="text-center mt-8">
            <p className="text-gray-500 text-sm">
              Can&apos;t find your order?{' '}
              <Link href="/faq" className="text-[#D4AF37] hover:underline">
                Check our FAQ
              </Link>
              {' '}or{' '}
              <a href="mailto:contact.us@centraders.com" className="text-[#D4AF37] hover:underline">
                contact support
              </a>
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
