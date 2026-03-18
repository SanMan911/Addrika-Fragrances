import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Package, TrendingUp, Users, Tag, MessageSquare,
  Boxes, FileText, Settings, ChevronLeft, ChevronRight, LogOut,
  ShieldCheck, Menu, X, ShoppingCart, Gift, Star, Mail, Moon, Sun, Store,
  Briefcase, FileEdit, Activity
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Sidebar navigation items - organized by category
const navItems = [
  { path: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
  { path: '/admin/orders', label: 'Orders', icon: Package },
  { path: '/admin/analytics', label: 'Analytics', icon: TrendingUp },
  { path: '/admin/users', label: 'Users', icon: Users },
  { path: '/admin/retailers', label: 'Retailers', icon: Store },
  { path: '/admin/retailer-activity', label: 'Retailer Activity', icon: Activity },
  { path: '/admin/profile-tickets', label: 'Profile Tickets', icon: FileEdit },
  { path: '/admin/b2b', label: 'B2B Wholesale', icon: Briefcase },
  { path: '/admin/marketing', label: 'Marketing', icon: Tag },
  { path: '/admin/content', label: 'Content', icon: FileText },
  { path: '/admin/inventory', label: 'Inventory', icon: Boxes },
  { path: '/admin/inquiries', label: 'Inquiries', icon: MessageSquare },
  { path: '/admin/settings', label: 'Settings', icon: Settings },
];

// Helper function for authenticated fetch
export const authFetch = async (url, options = {}) => {
  const sessionToken = localStorage.getItem('addrika_session_token');
  const headers = {
    ...options.headers,
    ...(sessionToken && { 'Authorization': `Bearer ${sessionToken}` })
  };
  return fetch(url, { ...options, credentials: 'include', headers });
};

const AdminLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAdmin, isLoading, logout } = useAuth();
  
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [stats, setStats] = useState(null);
  
  // Dark mode - default to true (dark mode on)
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('admin_dark_mode');
    // Default to dark mode if no preference saved
    return saved !== null ? saved === 'true' : true;
  });

  // Apply dark mode to document
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('admin_dark_mode', darkMode.toString());
  }, [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  // Check admin access
  useEffect(() => {
    if (!isLoading && !isAdmin) {
      toast.error('Admin access required');
      navigate('/admin/login');
    }
  }, [isAdmin, isLoading, navigate]);

  // Fetch stats for badge counts
  const fetchStats = useCallback(async () => {
    try {
      const res = await authFetch(`${API_URL}/api/admin/stats`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchStats();
    }
  }, [isAdmin, fetchStats]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-slate-800"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const NavItem = ({ item }) => {
    const isActive = item.exact 
      ? location.pathname === item.path 
      : location.pathname.startsWith(item.path);
    
    // Badge counts
    let badge = null;
    if (stats) {
      if (item.path === '/admin/orders' && stats.orders?.pending > 0) {
        badge = stats.orders.pending;
      } else if (item.path === '/admin/inquiries' && stats.inquiries?.pending > 0) {
        badge = stats.inquiries.pending;
      } else if (item.path === '/admin/content' && stats.reviews?.pending > 0) {
        badge = stats.reviews.pending;
      }
    }

    return (
      <NavLink
        to={item.path}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative ${
          isActive
            ? 'bg-slate-800 text-white dark:bg-slate-700'
            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
        }`}
        data-testid={`nav-${item.label.toLowerCase()}`}
      >
        <item.icon size={20} className={`flex-shrink-0 ${isActive ? 'text-amber-400' : ''}`} />
        {!sidebarCollapsed && (
          <span className="font-medium">{item.label}</span>
        )}
        {badge && (
          <span className={`absolute ${sidebarCollapsed ? 'top-0 right-0' : 'right-3'} bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center`}>
            {badge}
          </span>
        )}
        {sidebarCollapsed && (
          <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-sm rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
            {item.label}
          </div>
        )}
      </NavLink>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex">
      {/* Sidebar - Desktop */}
      <aside
        className={`hidden lg:flex flex-col fixed left-0 top-0 h-screen bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 transition-all duration-300 z-40 ${
          sidebarCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        {/* Logo/Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2">
              <ShieldCheck size={24} className="text-amber-500" />
              <span className="font-bold text-slate-800 dark:text-white">Admin Panel</span>
            </div>
          )}
          {sidebarCollapsed && (
            <ShieldCheck size={24} className="text-amber-500 mx-auto" />
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavItem key={item.path} item={item} />
          ))}
        </nav>

        {/* Collapse Toggle, Dark Mode & Logout */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-700 space-y-2">
          {/* Dark Mode Toggle */}
          <button
            onClick={toggleDarkMode}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            data-testid="toggle-dark-mode"
          >
            {darkMode ? <Sun size={20} className="text-amber-400" /> : <Moon size={20} />}
            {!sidebarCollapsed && <span>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>}
          </button>
          
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            data-testid="toggle-sidebar"
          >
            {sidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            {!sidebarCollapsed && <span>Collapse</span>}
          </button>
          
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            data-testid="admin-logout"
          >
            <LogOut size={20} />
            {!sidebarCollapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-4 z-50">
        <div className="flex items-center gap-2">
          <ShieldCheck size={24} className="text-amber-500" />
          <span className="font-bold text-slate-800 dark:text-white">Admin</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
          data-testid="mobile-menu-toggle"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={`lg:hidden fixed left-0 top-0 h-full w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 transform transition-transform duration-300 z-50 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <ShieldCheck size={24} className="text-amber-500" />
            <span className="font-bold text-slate-800 dark:text-white">Admin Panel</span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <X size={20} />
          </button>
        </div>
        
        <nav className="p-3 space-y-1">
          {navItems.map((item) => (
            <NavItem key={item.path} item={item} />
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-slate-200 dark:border-slate-700 space-y-2">
          {/* Dark Mode Toggle - Mobile */}
          <button
            onClick={toggleDarkMode}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            {darkMode ? <Sun size={20} className="text-amber-400" /> : <Moon size={20} />}
            <span>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
          
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className={`flex-1 transition-all duration-300 ${
          sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'
        } pt-16 lg:pt-0`}
      >
        <div className="p-4 lg:p-6 min-h-screen">
          <Outlet context={{ stats, refreshStats: fetchStats, authFetch }} />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
