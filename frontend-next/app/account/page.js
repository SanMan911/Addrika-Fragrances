'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { User, Package, Heart, Settings, LogOut, ChevronRight, MapPin, Bell, CreditCard } from 'lucide-react';

export default function AccountPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout, getUserOrders } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    const fetchOrders = async () => {
      if (isAuthenticated) {
        const userOrders = await getUserOrders();
        setOrders(userOrders.slice(0, 3)); // Get latest 3 orders
        setLoadingOrders(false);
      }
    };
    fetchOrders();
  }, [isAuthenticated, getUserOrders]);

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F0E8]">
        <div className="w-12 h-12 border-4 border-[#2B3A4A] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const menuItems = [
    { icon: Package, label: 'My Orders', href: '/orders', description: 'View order history & track shipments' },
    { icon: Heart, label: 'Wishlist', href: '/wishlist', description: 'Items you\'ve saved for later' },
    { icon: MapPin, label: 'Addresses', href: '/account/addresses', description: 'Manage delivery addresses' },
    { icon: Bell, label: 'Notifications', href: '/account/notifications', description: 'Email & push preferences' },
    { icon: CreditCard, label: 'Payment Methods', href: '/account/payments', description: 'Saved cards & UPI' },
    { icon: Settings, label: 'Settings', href: '/account/settings', description: 'Password & account settings' },
  ];

  return (
    <div className="min-h-screen bg-[#F5F0E8]">
      {/* Header */}
      <header className="bg-[#2B3A4A] text-white py-6 px-4">
        <div className="max-w-4xl mx-auto">
          <Link href="/" className="text-xl font-bold text-[#D4AF37] mb-4 inline-block">ADDRIKA</Link>
          
          <div className="flex items-center gap-4 mt-4">
            <div className="w-16 h-16 bg-[#D4AF37] rounded-full flex items-center justify-center">
              <User size={28} className="text-[#2B3A4A]" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{user?.name || 'Welcome'}</h1>
              <p className="text-gray-300 text-sm">{user?.email}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Recent Orders */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-[#2B3A4A]">Recent Orders</h2>
            <Link href="/orders" className="text-[#D4AF37] text-sm font-medium hover:underline">
              View All
            </Link>
          </div>
          
          {loadingOrders ? (
            <div className="bg-white rounded-xl p-8 text-center">
              <div className="w-8 h-8 border-2 border-[#2B3A4A] border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center">
              <Package size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No orders yet</p>
              <Link href="/" className="text-[#D4AF37] font-medium hover:underline mt-2 inline-block">
                Start Shopping
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <Link
                  key={order.order_id}
                  href={`/orders?id=${order.order_id}`}
                  className="block bg-white rounded-xl p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-[#2B3A4A]">Order #{order.order_id?.slice(-8)}</p>
                      <p className="text-sm text-gray-500">{order.items?.length || 0} items • ₹{order.pricing?.final_total || order.total}</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        order.order_status === 'delivered' ? 'bg-green-100 text-green-700' :
                        order.order_status === 'shipped' ? 'bg-blue-100 text-blue-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {order.order_status?.charAt(0).toUpperCase() + order.order_status?.slice(1)}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Menu Items */}
        <section className="mb-8">
          <h2 className="text-lg font-bold text-[#2B3A4A] mb-4">Account Settings</h2>
          <div className="bg-white rounded-xl overflow-hidden">
            {menuItems.map((item, index) => (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors ${
                  index !== menuItems.length - 1 ? 'border-b border-gray-100' : ''
                }`}
              >
                <div className="w-10 h-10 bg-[#F5F0E8] rounded-full flex items-center justify-center">
                  <item.icon size={20} className="text-[#2B3A4A]" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-[#2B3A4A]">{item.label}</p>
                  <p className="text-sm text-gray-500">{item.description}</p>
                </div>
                <ChevronRight size={20} className="text-gray-400" />
              </Link>
            ))}
          </div>
        </section>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full bg-white rounded-xl p-4 flex items-center gap-4 text-red-600 hover:bg-red-50 transition-colors"
        >
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
            <LogOut size={20} />
          </div>
          <span className="font-medium">Log Out</span>
        </button>
      </main>
    </div>
  );
}
