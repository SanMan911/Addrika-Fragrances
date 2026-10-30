'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Package, Search, Loader2, AlertCircle, Truck, MapPin, CheckCircle } from 'lucide-react';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const STATUS_STEPS = ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered'];

function statusIndex(status) {
  const s = (status || '').toLowerCase().replace(/\s+/g, '_');
  const i = STATUS_STEPS.indexOf(s);
  return i === -1 ? 0 : i;
}

export default function TrackOrderPage() {
  const [orderNumber, setOrderNumber] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [order, setOrder] = useState(null);

  const handleTrack = async (e) => {
    e.preventDefault();
    setError('');
    setOrder(null);
    setLoading(true);
    try {
      const params = new URLSearchParams({ order_number: orderNumber.trim(), email: email.trim() });
      const res = await fetch(`${API_URL}/api/orders/track?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Order not found. Check your order number and email.');
      }
      setOrder(data.order);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const currentStep = order ? statusIndex(order.orderStatus || order.order_status) : 0;
  const shippingDetails = order?.shippingDetails || order?.shipping_details;

  return (
    <div style={{ backgroundColor: '#0f1419', minHeight: '100vh' }}>
      <Header />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20" data-testid="track-order-page">
        <div className="text-center mb-10">
          <p className="text-xs font-bold tracking-[3px] mb-2" style={{ color: '#D4AF37' }}>
            ORDER TRACKING
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold text-white">Track your order</h1>
          <p className="text-base mt-3" style={{ color: 'var(--text-light)' }}>
            Enter your order number and the email you used at checkout.
          </p>
        </div>

        <form
          onSubmit={handleTrack}
          className="rounded-2xl p-6 sm:p-8"
          style={{
            background: 'linear-gradient(160deg, #1a252f 0%, #141c23 100%)',
            border: '1px solid rgba(212,175,55,0.25)',
          }}
          data-testid="track-order-form"
        >
          <label className="block text-sm font-semibold text-white mb-2" htmlFor="order-number">
            Order number
          </label>
          <input
            id="order-number"
            data-testid="track-order-number-input"
            type="text"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            placeholder="e.g. AAR-123456"
            required
            className="w-full rounded-lg px-4 py-3 mb-4 text-white outline-none focus:ring-2"
            style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
          />

          <label className="block text-sm font-semibold text-white mb-2" htmlFor="track-email">
            Email address
          </label>
          <input
            id="track-email"
            data-testid="track-order-email-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className="w-full rounded-lg px-4 py-3 mb-6 text-white outline-none focus:ring-2"
            style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
          />

          {error && (
            <div
              className="flex items-center gap-2 rounded-lg px-4 py-3 mb-4 text-sm"
              style={{ backgroundColor: 'rgba(220,38,38,0.12)', color: '#fca5a5' }}
              data-testid="track-order-error"
            >
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            data-testid="track-order-submit"
            className="w-full inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-semibold transition-all hover:scale-[1.02] disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #D4AF37 0%, #c9a432 100%)', color: '#1a1a2e' }}
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
            {loading ? 'Finding your order…' : 'Track order'}
          </button>
        </form>

        {order && (
          <div
            className="rounded-2xl p-6 sm:p-8 mt-8"
            style={{
              background: 'linear-gradient(160deg, #1a252f 0%, #141c23 100%)',
              border: '1px solid rgba(212,175,55,0.25)',
            }}
            data-testid="track-order-result"
          >
            <div className="flex items-center justify-between flex-wrap gap-2 mb-6">
              <div>
                <p className="text-xs" style={{ color: 'var(--text-light)' }}>Order</p>
                <p className="text-lg font-bold text-white" data-testid="track-order-number-result">
                  {order.orderNumber || order.order_number}
                </p>
              </div>
              <span
                className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
                style={{ backgroundColor: 'rgba(212,175,55,0.15)', color: '#D4AF37' }}
                data-testid="track-order-status-badge"
              >
                {(order.orderStatus || order.order_status || 'pending').replace(/_/g, ' ')}
              </span>
            </div>

            {/* Progress steps */}
            <div className="flex items-center mb-8" data-testid="track-order-progress">
              {STATUS_STEPS.map((step, i) => (
                <div key={step} className="flex items-center flex-1 last:flex-none">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{
                      backgroundColor: i <= currentStep ? '#D4AF37' : 'rgba(255,255,255,0.1)',
                      color: i <= currentStep ? '#1a1a2e' : 'rgba(255,255,255,0.4)',
                    }}
                  >
                    {i < currentStep ? <CheckCircle size={14} /> : <span className="text-[10px] font-bold">{i + 1}</span>}
                  </div>
                  {i < STATUS_STEPS.length - 1 && (
                    <div
                      className="h-[2px] flex-1 mx-1"
                      style={{ backgroundColor: i < currentStep ? '#D4AF37' : 'rgba(255,255,255,0.1)' }}
                    />
                  )}
                </div>
              ))}
            </div>

            {shippingDetails && (
              <div
                className="rounded-lg px-4 py-3 mb-6 flex items-start gap-3"
                style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
                data-testid="track-order-shipping-details"
              >
                <Truck size={18} className="mt-0.5 flex-shrink-0" style={{ color: '#D4AF37' }} />
                <div className="text-sm" style={{ color: 'var(--text-light)' }}>
                  {shippingDetails.courier_name && (
                    <p className="text-white font-semibold">{shippingDetails.courier_name}</p>
                  )}
                  {(shippingDetails.awb_code || shippingDetails.awb_number) && (
                    <p>AWB: {shippingDetails.awb_code || shippingDetails.awb_number}</p>
                  )}
                  {shippingDetails.tracking_url && (
                    <a
                      href={shippingDetails.tracking_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-1 font-semibold"
                      style={{ color: '#D4AF37' }}
                      data-testid="track-order-courier-link"
                    >
                      Track on courier site →
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Items */}
            <div className="space-y-3 mb-6" data-testid="track-order-items">
              {(order.items || []).map((item, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <Package size={16} className="flex-shrink-0" style={{ color: '#D4AF37' }} />
                  <span className="text-white flex-1">{item.name || item.product_name}</span>
                  <span style={{ color: 'var(--text-light)' }}>× {item.quantity}</span>
                </div>
              ))}
            </div>

            {order.shipping?.address && (
              <div className="flex items-start gap-3 text-sm" style={{ color: 'var(--text-light)' }}>
                <MapPin size={16} className="mt-0.5 flex-shrink-0" style={{ color: '#D4AF37' }} />
                <span>
                  {[order.shipping.address, order.shipping.city, order.shipping.state, order.shipping.pincode]
                    .filter(Boolean)
                    .join(', ')}
                </span>
              </div>
            )}
          </div>
        )}

        <p className="text-center text-sm mt-8" style={{ color: 'var(--text-light)' }}>
          Can&apos;t find your order?{' '}
          <Link href="/orders" className="font-semibold" style={{ color: '#D4AF37' }} data-testid="track-order-signin-link">
            Sign in to view your orders
          </Link>
        </p>
      </main>
      <Footer />
    </div>
  );
}
