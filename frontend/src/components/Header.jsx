import React, { useState, useEffect } from 'react';
import { Menu, X, ShoppingBag, Home, User, Package, Heart } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button } from './ui/button';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useInquiry } from '../context/InquiryContext';
import { useTheme } from '../context/ThemeContext';
import { useWishlist } from '../context/WishlistContext';
import DarkModeToggle from './DarkModeToggle';
import GoogleTranslate from './GoogleTranslate';

const Header = ({ onInquiryClick }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { getCartCount, setIsCartOpen } = useCart();
  const { user, isAuthenticated } = useAuth();
  const { wishlistCount } = useWishlist();
  const { openInquiry } = useInquiry();
  const navigate = useNavigate();
  const location = useLocation();

  // Use the global inquiry context, fallback to prop for backward compatibility
  const handleInquiryClick = () => {
    if (onInquiryClick) {
      onInquiryClick();
    } else {
      openInquiry('wholesale');
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = [
    { label: 'Fragrances', href: '#fragrances', type: 'scroll' },
    { label: 'Our Story', href: '/our-story', type: 'route' },
    { label: 'CSR', href: '#csr', type: 'scroll' },
    { label: 'Find Retailers', href: '/find-retailers', type: 'route' },
    { label: 'Track Order', href: '/track-order', type: 'route' },
    { label: 'Contact', href: '#contact', type: 'scroll' }
  ];

  const handleNavClick = (item, e) => {
    if (item.type === 'scroll') {
      e.preventDefault();
      // If not on home page, navigate to home first then scroll
      if (location.pathname !== '/') {
        navigate('/');
        // Wait for navigation then scroll
        setTimeout(() => {
          const element = document.querySelector(item.href);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
          }
        }, 100);
      } else {
        const element = document.querySelector(item.href);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }
    } else if (item.type === 'route') {
      e.preventDefault();
      navigate(item.href);
    }
    setIsMobileMenuOpen(false);
  };

  const handleLogoClick = (e) => {
    e.preventDefault();
    
    // Check if we're on checkout page with form data
    if (location.pathname === '/checkout') {
      const confirmed = window.confirm(
        'Are you sure you want to leave? Any unsaved information will be lost.'
      );
      if (!confirmed) return;
    }
    
    navigate('/');
  };

  const cartCount = getCartCount();
  const { isDarkMode } = useTheme();

  return (
    <header 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled 
          ? isDarkMode 
            ? 'bg-slate-900/95 backdrop-blur-md shadow-md' 
            : 'bg-white/95 backdrop-blur-md shadow-md' 
          : isDarkMode
            ? 'bg-slate-900/80 backdrop-blur-sm'
            : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo - Clickable */}
          <a 
            href="/"
            onClick={handleLogoClick}
            className="flex items-center cursor-pointer hover:opacity-80 transition-opacity"
            data-testid="logo-home-link"
          >
            <img 
              src={isDarkMode 
                ? "/images/logos/addrika-logo-gold.png" 
                : "/images/logos/addrika-logo-transparent.png?v=5"
              }
              alt="Addrika - Elegance in Every Scent" 
              className="h-16 md:h-20 w-auto"
              style={{ 
                transition: 'all 0.3s ease',
                maxWidth: '200px'
              }}
              onError={(e) => {
                // Fallback to original logo if image not found
                e.target.src = '/images/logos/addrika-logo.png?v=4';
              }}
            />
          </a>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8 ml-16">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={(e) => handleNavClick(item, e)}
                className="text-sm font-medium transition-colors hover:opacity-70"
                style={{ color: isDarkMode ? '#e8e6e3' : 'var(--text-dark)' }}
              >
                {item.label}
              </a>
            ))}
            
            {/* Language Selector */}
            <div className="hidden lg:block">
              <GoogleTranslate />
            </div>
            
            {/* Dark Mode Toggle */}
            <DarkModeToggle />
            
            {/* Account/Login Button */}
            <button
              onClick={() => navigate(isAuthenticated ? '/account' : '/login')}
              className="relative p-2 flex items-center gap-1"
              style={{ color: isDarkMode ? 'var(--metallic-gold)' : 'var(--japanese-indigo)' }}
              data-testid="account-button"
            >
              <User size={22} />
              {isAuthenticated && user && (
                <span className="text-sm font-medium hidden lg:inline">
                  {user.name?.split(' ')[0]}
                </span>
              )}
            </button>
            
            {/* Orders Button - Only for authenticated users */}
            {isAuthenticated && (
              <button
                onClick={() => navigate('/orders')}
                className="relative p-2"
                style={{ color: isDarkMode ? 'var(--metallic-gold)' : 'var(--japanese-indigo)' }}
                data-testid="orders-button"
                title="My Orders"
              >
                <Package size={22} />
              </button>
            )}
            
            {/* Cart Icon */}
            {/* Wishlist Icon */}
            <button
              onClick={() => navigate('/wishlist')}
              className="relative p-2"
              style={{ color: 'var(--japanese-indigo)' }}
              data-testid="wishlist-icon-button"
            >
              <Heart size={24} />
              {wishlistCount > 0 && (
                <span 
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ backgroundColor: '#ef4444' }}
                >
                  {wishlistCount}
                </span>
              )}
            </button>

            {/* Cart Icon */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative p-2"
              style={{ color: 'var(--japanese-indigo)' }}
              data-testid="cart-icon-button"
            >
              <ShoppingBag size={24} />
              {cartCount > 0 && (
                <span 
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ backgroundColor: 'var(--metallic-gold)' }}
                >
                  {cartCount}
                </span>
              )}
            </button>

            <Button
              onClick={handleInquiryClick}
              className="text-white font-medium"
              style={{ 
                backgroundColor: 'var(--japanese-indigo)',
                transition: 'transform 0.3s ease, opacity 0.3s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.85'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            >
              Wholesale Inquiry
            </Button>
          </nav>

          {/* Mobile Cart & Menu Buttons */}
          <div className="md:hidden flex items-center gap-2">
            {/* Dark Mode Toggle - Mobile */}
            <DarkModeToggle />
            
            {/* Mobile Account Icon */}
            <button
              onClick={() => navigate(isAuthenticated ? '/account' : '/login')}
              className="relative p-2"
              style={{ color: 'var(--japanese-indigo)' }}
              data-testid="mobile-account-button"
            >
              <User size={22} />
            </button>
            
            {/* Mobile Wishlist Icon */}
            <button
              onClick={() => navigate('/wishlist')}
              className="relative p-2"
              style={{ color: 'var(--japanese-indigo)' }}
              data-testid="mobile-wishlist-icon"
            >
              <Heart size={22} />
              {wishlistCount > 0 && (
                <span 
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                  style={{ backgroundColor: '#ef4444' }}
                >
                  {wishlistCount}
                </span>
              )}
            </button>
            
            {/* Mobile Cart Icon */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative p-2"
              style={{ color: 'var(--japanese-indigo)' }}
              data-testid="mobile-cart-icon"
            >
              <ShoppingBag size={24} />
              {cartCount > 0 && (
                <span 
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ backgroundColor: 'var(--metallic-gold)' }}
                >
                  {cartCount}
                </span>
              )}
            </button>
            
            {/* Mobile Menu Button */}
            <button
              className="p-2"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              style={{ color: 'var(--japanese-indigo)' }}
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden py-4 border-t" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card-background)' }}>
            <nav className="flex flex-col space-y-4 px-4">
              {navItems.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={(e) => handleNavClick(item, e)}
                  className="text-sm font-medium transition-colors hover:opacity-70"
                  style={{ color: 'var(--text-dark)' }}
                >
                  {item.label}
                </a>
              ))}
              
              {/* Mobile Language Selector */}
              <div className="py-2">
                <GoogleTranslate />
              </div>
              
              <Button
                onClick={() => {
                  handleInquiryClick();
                  setIsMobileMenuOpen(false);
                }}
                className="w-full text-white font-medium"
                style={{ backgroundColor: 'var(--japanese-indigo)' }}
              >
                Wholesale Inquiry
              </Button>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;