'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  Store, Package, MessageSquare, AlertTriangle, ShoppingBag,
  Trophy, Award, FileEdit, LogOut, Menu, X, ChevronRight, Receipt, Headset
} from 'lucide-react';
import { RetailerAuthProvider, useRetailerAuth } from '../../context/RetailerAuthContext';
import { toast } from 'sonner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

// Navigation items
const navItems = [
  { icon: Store, label: 'Dashboard', path: '/retailer/dashboard' },
  { icon: Package, label: 'Orders', path: '/retailer/orders', badgeKey: 'pending_orders' },
  { icon: ShoppingBag, label: 'B2B Orders', path: '/retailer/b2b' },
  { icon: Receipt, label: 'Bills & Invoices', path: '/retailer/bills' },
  { icon: Headset, label: 'Admin Chat', path: '/retailer/admin-chat' },
  { icon: Trophy, label: 'Leaderboard', path: '/retailer/leaderboard' },
  { icon: Award, label: 'Badges', path: '/retailer/badges' },
  { icon: FileEdit, label: 'Profile Requests', path: '/retailer/profile-requests' },
  { icon: AlertTriangle, label: 'Grievances', path: '/retailer/grievances', badgeKey: 'open_grievances' },
  { icon: MessageSquare, label: 'Messages', path: '/retailer/messages', badgeKey: 'unread_messages' },
];

// Inner layout component that uses the auth context
function RetailerLayoutInner({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { retailer, isAuthenticated, isLoading, logout, fetchWithAuth } = useRetailerAuth();
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [metrics, setMetrics] = useState(null);

  // Check if we're on the login page - don't apply auth layout to login
  const isLoginPage = pathname === '/retailer/login';

  // Check auth - only redirect if not on login page
  useEffect(() => {
    if (!isLoading && !isAuthenticated && !isLoginPage) {
      router.push('/retailer/login');
    }
  }, [isAuthenticated, isLoading, router, isLoginPage]);

  // Fetch metrics for badges
  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/retailer-dashboard/performance`);
      if (res.ok) {
        const data = await res.json();
        setMetrics(data.metrics || data);
      }
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchMetrics();
    }
  }, [isAuthenticated, fetchMetrics]);

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out successfully');
    router.push('/retailer/login');
  };

  // For login page, just render children without the layout
  if (isLoginPage) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="w-12 h-12 border-4 border-[#2B3A4A] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const NavItem = ({ item }) => {
    const isActive = pathname === item.path || (item.path !== '/retailer/dashboard' && pathname.startsWith(item.path));
    const badge = metrics?.[item.badgeKey];

    return (
      <Link
        href={item.path}
        className={`flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
          isActive 
            ? 'bg-white/10 text-white' 
            : 'text-white/70 hover:bg-white/5 hover:text-white'
        }`}
        data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, '-')}`}
      >
        <div className="flex items-center gap-3">
          <item.icon className="w-5 h-5" />
          <span>{item.label}</span>
        </div>
        {badge > 0 && (
          <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            {badge}
          </span>
        )}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed top-0 left-0 h-full w-64 z-50 transform transition-transform lg:translate-x-0 bg-[#2B3A4A] ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#D4AF37]">
              <Store className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Addrika</h1>
              <p className="text-xs text-white/60">Retailer Portal</p>
            </div>
          </div>
        </div>

        {/* Nav Items */}
        <nav className="p-4 space-y-2">
          {navItems.map((item) => (
            <NavItem key={item.path} item={item} />
          ))}
        </nav>

        {/* User Info & Logout */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10">
          {retailer && (
            <div className="mb-4 px-4">
              <p className="text-white font-medium truncate">{retailer.store_name || retailer.storeName}</p>
              <p className="text-white/60 text-sm truncate">{retailer.email}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
            data-testid="retailer-logout"
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[#2B3A4A] flex items-center justify-between px-4 z-40">
        <div className="flex items-center gap-2">
          <Store className="w-6 h-6 text-[#D4AF37]" />
          <span className="font-bold text-white">Retailer Portal</span>
        </div>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-lg hover:bg-white/10 text-white"
          data-testid="mobile-menu-toggle"
        >
          {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Main Content */}
      <main className="lg:ml-64 pt-16 lg:pt-0 min-h-screen">
        <div className="p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}

// Export wrapper that provides the context
export default function RetailerLayout({ children }) {
  return (
    <RetailerAuthProvider>
      <RetailerLayoutInner>{children}</RetailerLayoutInner>
    </RetailerAuthProvider>
  );
}
