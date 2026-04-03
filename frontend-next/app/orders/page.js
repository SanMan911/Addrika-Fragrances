'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { Package, ArrowLeft, ChevronRight, Truck, CheckCircle, Clock, XCircle } from 'lucide-react';
import { Suspense } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

function OrdersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading, getUserOrders } = useAuth();
  
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login?redirect=/orders');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    const fetchOrders = async () => {
      if (isAuthenticated) {
        const userOrders = await getUserOrders();
        setOrders(userOrders);
        
        // Check if specific order is requested
        const orderId = searchParams.get('id');
        if (orderId) {
          const order = userOrders.find(o => o.order_id === orderId);
          if (order) setSelectedOrder(order);
        }
        
        setLoading(false);
      }
    };
    fetchOrders();
  }, [isAuthenticated, getUserOrders, searchParams]);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'delivered':
        return <CheckCircle className="text-green-500" size={20} />;
      case 'shipped':
        return <Truck className="text-blue-500" size={20} />;
      case 'cancelled':
        return <XCircle className="text-red-500" size={20} />;
      default:
        return <Clock className="text-yellow-500" size={20} />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'delivered':
        return 'bg-green-100 text-green-700';
      case 'shipped':
        return 'bg-blue-100 text-blue-700';
      case 'cancelled':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-yellow-100 text-yellow-700';
    }
  };

  if (isLoading || loading) {
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
        <h1 className="text-2xl font-bold text-[#2B3A4A] mb-6">My Orders</h1>
        
        {orders.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center">
            <Package size={64} className="mx-auto text-gray-300 mb-4" />
            <h2 className="text-xl font-bold text-[#2B3A4A] mb-2">No orders yet</h2>
            <p className="text-gray-500 mb-6">Your order history will appear here</p>
            <Link
              href="/"
              className="inline-block bg-[#D4AF37] text-[#2B3A4A] px-6 py-3 rounded-xl font-semibold hover:bg-[#c9a432] transition-colors"
            >
              Start Shopping
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div
                key={order.order_id}
                className="bg-white rounded-xl p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="font-bold text-[#2B3A4A]">
                      Order #{order.order_id?.slice(-8).toUpperCase()}
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(order.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full font-medium ${getStatusColor(order.order_status)}`}>
                    {order.order_status?.charAt(0).toUpperCase() + order.order_status?.slice(1)}
                  </span>
                </div>
                
                {/* Order Items */}
                <div className="space-y-2 mb-4">
                  {order.items?.slice(0, 2).map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gray-100 rounded-lg" />
                      <div className="flex-1">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        <p className="text-xs text-gray-500">{item.size} × {item.quantity}</p>
                      </div>
                      <p className="text-sm font-medium">₹{item.price * item.quantity}</p>
                    </div>
                  ))}
                  {order.items?.length > 2 && (
                    <p className="text-sm text-gray-500">+{order.items.length - 2} more items</p>
                  )}
                </div>
                
                {/* Order Total & Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <div>
                    <p className="text-sm text-gray-500">Total</p>
                    <p className="font-bold text-[#2B3A4A]">₹{order.pricing?.final_total || order.total}</p>
                  </div>
                  <button
                    onClick={() => setSelectedOrder(selectedOrder?.order_id === order.order_id ? null : order)}
                    className="flex items-center gap-1 text-[#D4AF37] font-medium hover:underline"
                  >
                    {selectedOrder?.order_id === order.order_id ? 'Hide Details' : 'View Details'}
                    <ChevronRight size={16} className={selectedOrder?.order_id === order.order_id ? 'rotate-90' : ''} />
                  </button>
                </div>
                
                {/* Expanded Order Details */}
                {selectedOrder?.order_id === order.order_id && (
                  <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
                    {/* Shipping Address */}
                    {order.shipping_address && (
                      <div>
                        <h4 className="font-medium text-[#2B3A4A] mb-2">Delivery Address</h4>
                        <p className="text-sm text-gray-600">
                          {order.shipping_address.name}<br />
                          {order.shipping_address.address}<br />
                          {order.shipping_address.city}, {order.shipping_address.state} - {order.shipping_address.pincode}
                        </p>
                      </div>
                    )}
                    
                    {/* Order Timeline */}
                    <div>
                      <h4 className="font-medium text-[#2B3A4A] mb-2">Order Status</h4>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(order.order_status)}
                        <span className="text-sm text-gray-600">
                          {order.order_status === 'pending' && 'Your order is being processed'}
                          {order.order_status === 'confirmed' && 'Order confirmed, preparing for shipment'}
                          {order.order_status === 'shipped' && 'Your order is on the way'}
                          {order.order_status === 'delivered' && 'Order delivered successfully'}
                          {order.order_status === 'cancelled' && 'Order was cancelled'}
                        </span>
                      </div>
                    </div>
                    
                    {/* Payment Info */}
                    <div>
                      <h4 className="font-medium text-[#2B3A4A] mb-2">Payment</h4>
                      <p className="text-sm text-gray-600">
                        {order.payment_status === 'paid' ? '✓ Paid' : 'Payment pending'}
                        {order.payment_method && ` via ${order.payment_method}`}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#F5F0E8]">
        <div className="w-12 h-12 border-4 border-[#2B3A4A] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <OrdersContent />
    </Suspense>
  );
}
