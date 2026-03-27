import React from 'react';
import './App.css';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import FindRetailers from './pages/FindRetailers';
import CheckoutPage from './pages/CheckoutPage';
import TrackOrder from './pages/TrackOrder';
import ShippingReturns from './pages/ShippingReturns';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import AuthPage from './pages/AuthPage';
import AuthCallback from './pages/AuthCallback';
import AccountPage from './pages/AccountPage';
import AdminLogin from './pages/AdminLogin';
// New modular admin pages
import {
  AdminLayout,
  AdminOverviewPage,
  AdminOrdersPage,
  AdminAnalyticsPage,
  AdminUsersPage,
  AdminRetailersPage,
  AdminMarketingPage,
  AdminContentPage,
  AdminInventoryPage,
  AdminInquiriesPage,
  AdminSettingsPage,
  AdminB2BPage,
  AdminProfileTicketsPage,
  AdminRetailerActivityPage
} from './pages/admin';
import BlogPage from './pages/BlogPage';
import BlogPostPage from './pages/BlogPostPage';
import ProductPage from './pages/ProductPage';
import OurStory from './pages/OurStory';
import AboutUs from './pages/AboutUs';
import UserOrders from './pages/UserOrders';
import NotificationPreferences from './pages/NotificationPreferences';
import ReviewPage from './pages/ReviewPage';
import ThankYou from './pages/ThankYou';
import WishlistPage from './pages/WishlistPage';
import SharedWishlistPage from './pages/SharedWishlistPage';
// SEO Content Pages
import FAQPage from './pages/FAQPage';
import OurQualityPage from './pages/OurQualityPage';
import IngredientsPage from './pages/IngredientsPage';
import WhyZeroCharcoalPage from './pages/WhyZeroCharcoalPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import AdminForgotPasswordPage from './pages/AdminForgotPasswordPage';
import { Toaster } from './components/ui/sonner';
import { CartProvider } from './context/CartContext';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { InquiryProvider, useInquiry } from './context/InquiryContext';
import { WishlistProvider } from './context/WishlistContext';
import { RetailerAuthProvider } from './context/RetailerAuthContext';
import ShoppingCart from './components/ShoppingCart';
import WhatsAppButton from './components/WhatsAppButton';
import FloatingDeliveryChecker from './components/FloatingDeliveryChecker';
import InquiryModal from './components/InquiryModal';
import InstallPWA from './components/InstallPWA';
import ScrollToTop from './components/ScrollToTop';
import { SEOProvider } from './components/SEO';

// Retailer Portal Pages
import {
  RetailerLogin,
  RetailerDashboard,
  RetailerOrders,
  RetailerGrievances,
  RetailerMessages,
  RetailerB2B,
  RetailerLeaderboard,
  RetailerBadges,
  RetailerProfileRequests
} from './pages/retailer';

// Subdomain detection
import { getCurrentPortal, PORTALS } from './utils/subdomain';

// Protected route for retailer portal
function RetailerProtectedRoute({ children }) {
  const token = localStorage.getItem('retailer_token');
  if (!token) {
    return <Navigate to="/retailer/login" replace />;
  }
  return children;
}

// Customer Store Router
function CustomerRouter() {
  const location = useLocation();
  
  // Check URL fragment (not query params) for session_id - handle before ProtectedRoute runs
  if (location.hash?.includes('session_id=')) {
    return <AuthCallback />;
  }
  
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/our-story" element={<OurStory />} />
      <Route path="/about-us" element={<AboutUs />} />
      <Route path="/find-retailers" element={<FindRetailers />} />
      <Route path="/checkout" element={<CheckoutPage />} />
      <Route path="/track-order" element={<TrackOrder />} />
      <Route path="/shipping-returns" element={<ShippingReturns />} />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      <Route path="/terms-of-service" element={<TermsOfService />} />
      {/* SEO Content Pages */}
      <Route path="/faq" element={<FAQPage />} />
      <Route path="/our-quality" element={<OurQualityPage />} />
      <Route path="/ingredients" element={<IngredientsPage />} />
      <Route path="/why-zero-charcoal" element={<WhyZeroCharcoalPage />} />
      <Route path="/login" element={<AuthPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/account" element={<AccountPage />} />
      <Route path="/orders" element={<UserOrders />} />
      <Route path="/notifications" element={<NotificationPreferences />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin/forgot-password" element={<AdminForgotPasswordPage />} />
      {/* New modular admin routes with sidebar layout */}
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminOverviewPage />} />
        <Route path="orders" element={<AdminOrdersPage />} />
        <Route path="analytics" element={<AdminAnalyticsPage />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="retailers" element={<AdminRetailersPage />} />
        <Route path="retailer-activity" element={<AdminRetailerActivityPage />} />
        <Route path="b2b" element={<AdminB2BPage />} />
        <Route path="profile-tickets" element={<AdminProfileTicketsPage />} />
        <Route path="marketing" element={<AdminMarketingPage />} />
        <Route path="content" element={<AdminContentPage />} />
        <Route path="inventory" element={<AdminInventoryPage />} />
        <Route path="inquiries" element={<AdminInquiriesPage />} />
        <Route path="settings" element={<AdminSettingsPage />} />
      </Route>
      {/* Legacy admin-old route removed - use /admin instead */}
      <Route path="/blog" element={<BlogPage />} />
      <Route path="/blog/:slug" element={<BlogPostPage />} />
      {/* Individual Product Pages for SEO */}
      <Route path="/products/:slug" element={<ProductPage />} />
      <Route path="/review" element={<ReviewPage />} />
      <Route path="/thank-you" element={<ThankYou />} />
      <Route path="/wishlist" element={<WishlistPage />} />
      <Route path="/wishlist/shared/:shareCode" element={<SharedWishlistPage />} />
      {/* Redirect anchor section URLs to landing page with hash */}
      <Route path="/csr" element={<Navigate to="/#csr" replace />} />
      <Route path="/contact" element={<Navigate to="/#contact" replace />} />
      <Route path="/about" element={<Navigate to="/about-us" replace />} />
      {/* Retailer routes accessible via path (for development/fallback) */}
      <Route path="/retailer/login" element={<RetailerLogin />} />
      <Route path="/retailer/dashboard" element={
        <RetailerProtectedRoute><RetailerDashboard /></RetailerProtectedRoute>
      } />
      <Route path="/retailer/orders" element={
        <RetailerProtectedRoute><RetailerOrders /></RetailerProtectedRoute>
      } />
      <Route path="/retailer/grievances" element={
        <RetailerProtectedRoute><RetailerGrievances /></RetailerProtectedRoute>
      } />
      <Route path="/retailer/messages" element={
        <RetailerProtectedRoute><RetailerMessages /></RetailerProtectedRoute>
      } />
      <Route path="/retailer/b2b" element={
        <RetailerProtectedRoute><RetailerB2B /></RetailerProtectedRoute>
      } />
      <Route path="/retailer/leaderboard" element={
        <RetailerProtectedRoute><RetailerLeaderboard /></RetailerProtectedRoute>
      } />
      <Route path="/retailer/badges" element={
        <RetailerProtectedRoute><RetailerBadges /></RetailerProtectedRoute>
      } />
      <Route path="/retailer/profile-requests" element={
        <RetailerProtectedRoute><RetailerProfileRequests /></RetailerProtectedRoute>
      } />
      <Route path="/retailer" element={<Navigate to="/retailer/login" replace />} />
      {/* Redirect /retailers to Find Retailers page */}
      <Route path="/retailers" element={<Navigate to="/find-retailers" replace />} />
    </Routes>
  );
}

// Retailer Portal Router (for subdomain)
function RetailerRouter() {
  return (
    <Routes>
      <Route path="/login" element={<RetailerLogin />} />
      <Route path="/dashboard" element={
        <RetailerProtectedRoute><RetailerDashboard /></RetailerProtectedRoute>
      } />
      <Route path="/orders" element={
        <RetailerProtectedRoute><RetailerOrders /></RetailerProtectedRoute>
      } />
      <Route path="/grievances" element={
        <RetailerProtectedRoute><RetailerGrievances /></RetailerProtectedRoute>
      } />
      <Route path="/messages" element={
        <RetailerProtectedRoute><RetailerMessages /></RetailerProtectedRoute>
      } />
      <Route path="/b2b" element={
        <RetailerProtectedRoute><RetailerB2B /></RetailerProtectedRoute>
      } />
      <Route path="/leaderboard" element={
        <RetailerProtectedRoute><RetailerLeaderboard /></RetailerProtectedRoute>
      } />
      <Route path="/badges" element={
        <RetailerProtectedRoute><RetailerBadges /></RetailerProtectedRoute>
      } />
      <Route path="/profile-requests" element={
        <RetailerProtectedRoute><RetailerProfileRequests /></RetailerProtectedRoute>
      } />
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

// Admin Portal Router (for subdomain)
function AdminRouter() {
  return (
    <Routes>
      <Route path="/login" element={<AdminLogin />} />
      <Route path="/" element={<AdminLayout />}>
        <Route index element={<AdminOverviewPage />} />
        <Route path="orders" element={<AdminOrdersPage />} />
        <Route path="analytics" element={<AdminAnalyticsPage />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="marketing" element={<AdminMarketingPage />} />
        <Route path="content" element={<AdminContentPage />} />
        <Route path="inventory" element={<AdminInventoryPage />} />
        <Route path="inquiries" element={<AdminInquiriesPage />} />
        <Route path="settings" element={<AdminSettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// Main app content with portal detection
function AppContent() {
  const { isInquiryOpen, inquiryType, closeInquiry } = useInquiry();
  const portal = getCurrentPortal();
  
  // Retailer subdomain
  if (portal === PORTALS.RETAILER) {
    return (
      <div className="App">
        <BrowserRouter>
          <ScrollToTop />
          <RetailerRouter />
        </BrowserRouter>
        <Toaster />
      </div>
    );
  }
  
  // Admin subdomain
  if (portal === PORTALS.ADMIN) {
    return (
      <div className="App">
        <BrowserRouter>
          <ScrollToTop />
          <AdminRouter />
        </BrowserRouter>
        <Toaster />
      </div>
    );
  }
  
  // Default customer store
  return (
    <div className="App">
      <BrowserRouter>
        <ScrollToTop />
        <CustomerRouter />
        <ShoppingCart />
        <WhatsAppButton />
        <FloatingDeliveryChecker />
        <InstallPWA />
        <InquiryModal 
          isOpen={isInquiryOpen} 
          onClose={closeInquiry} 
          type={inquiryType}
        />
      </BrowserRouter>
      <Toaster />
    </div>
  );
}

function App() {
  return (
    <SEOProvider>
      <ThemeProvider>
        <AuthProvider>
          <CartProvider>
            <WishlistProvider>
              <InquiryProvider>
                <RetailerAuthProvider>
                  <AppContent />
                </RetailerAuthProvider>
              </InquiryProvider>
            </WishlistProvider>
          </CartProvider>
        </AuthProvider>
      </ThemeProvider>
    </SEOProvider>
  );
}

export default App;
