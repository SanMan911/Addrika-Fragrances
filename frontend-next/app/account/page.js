'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User, Package, Heart, LogOut, Settings, ChevronRight, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://forgot-pass-4.preview.emergentagent.com';

export default function AccountPage() {
  const router = useRouter();
  const { user, logout, isAuthenticated, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated()) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (user?.email) {
      fetchOrders();
    }
  }, [user]);

  const fetchOrders = async () => {
    try {
      const res = await fetch(`${API_URL}/api/orders/user/${user.email}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    router.push('/');
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#D4AF37]" />
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-[#2B3A4A] font-bold text-xl">
            <span className="text-[#D4AF37]">Addrika</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/#fragrances" className="text-sm hover:text-[#D4AF37] transition-colors">
              Shop
            </Link>
          </nav>
        </div>
      </header>

      <main className="pt-24 pb-16 min-h-screen bg-[#F5F0E8]">
        <div className="max-w-4xl mx-auto px-4">
          {/* Profile Header */}
          <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-[#D4AF37]/10 flex items-center justify-center">
                <User className="w-8 h-8 text-[#D4AF37]" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-[#2B3A4A]">{user.name}</h1>
                <p className="text-gray-600">{user.email}</p>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="bg-white rounded-xl shadow-sm mb-6">
            <Link
              href="/account/orders"
              className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors border-b"
            >
              <div className="flex items-center gap-3">
                <Package className="w-5 h-5 text-[#D4AF37]" />
                <span className="font-medium text-[#2B3A4A]">My Orders</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </Link>
            <Link
              href="/wishlist"
              className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors border-b"
            >
              <div className="flex items-center gap-3">
                <Heart className="w-5 h-5 text-[#D4AF37]" />
                <span className="font-medium text-[#2B3A4A]">Wishlist</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </Link>
            <Link
              href="/account/settings"
              className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Settings className="w-5 h-5 text-[#D4AF37]" />
                <span className="font-medium text-[#2B3A4A]">Account Settings</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </Link>
          </div>

          {/* Recent Orders */}
          <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
            <h2 className="text-lg font-semibold text-[#2B3A4A] mb-4">Recent Orders</h2>
            
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-[#D4AF37]" />
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-8">
                <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600">No orders yet</p>
                <Link
                  href="/#fragrances"
                  className="inline-block mt-4 text-[#D4AF37] font-medium hover:underline"
                >
                  Start Shopping
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.slice(0, 3).map((order) => (
                  <div
                    key={order.order_number}
                    className="flex items-center justify-between p-4 bg-[#F5F0E8] rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-[#2B3A4A]">#{order.order_number}</p>
                      <p className="text-sm text-gray-600">
                        {new Date(order.created_at).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-[#2B3A4A]">₹{order.total?.toLocaleString('en-IN')}</p>
                      <p className={`text-sm capitalize ${
                        order.status === 'delivered' ? 'text-green-600' :
                        order.status === 'shipped' ? 'text-blue-600' :
                        'text-yellow-600'
                      }`}>
                        {order.status?.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="w-full bg-white rounded-xl p-4 shadow-sm flex items-center justify-center gap-2 text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#2B3A4A] text-white py-8 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-[#D4AF37] font-bold text-xl mb-2">Addrika</p>
          <p className="text-sm text-gray-400">© 2026 Centsibl Traders Private Limited</p>
        </div>
      </footer>
    </>
  );
}
