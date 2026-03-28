'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { Menu, X, ShoppingBag, User, Package, Heart, Sun, Moon } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useWishlist } from '../context/WishlistContext';
import { useTheme } from '../context/ThemeContext';

export default function Header({ onInquiryClick }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { getCartCount, setIsCartOpen } = useCart();
  const { user, isAuthenticated } = useAuth();
  const { wishlistCount } = useWishlist();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  // Always use dark mode styling for consistency
  const useDarkStyle = true;

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
      if (pathname !== '/') {
        router.push('/');
        setTimeout(() => {
          const element = document.querySelector(item.href);
          if (element) element.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      } else {
        const element = document.querySelector(item.href);
        if (element) element.scrollIntoView({ behavior: 'smooth' });
      }
    }
    setIsMobileMenuOpen(false);
  };

  const cartCount = getCartCount();

  return (
    <header 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled 
          ? 'bg-[#0f1419]/95 backdrop-blur-md shadow-lg' 
          : 'bg-[#0f1419]/80 backdrop-blur-sm'
      }`}
      style={{ borderBottom: isScrolled ? '1px solid rgba(212,175,55,0.2)' : 'none' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center cursor-pointer hover:opacity-80 transition-opacity">
            <img 
              src="/images/logos/addrika-logo-gold.png"
              alt="Addrika - Elegance in Every Scent" 
              className="h-16 md:h-20 w-auto"
              style={{ maxWidth: '200px' }}
            />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8 ml-16">
            {navItems.map((item) => (
              item.type === 'route' ? (
                <Link
                  key={item.label}
                  href={item.href}
                  className="text-sm font-medium transition-colors hover:text-[#D4AF37]"
                  style={{ color: '#e8e6e3' }}
                >
                  {item.label}
                </Link>
              ) : (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={(e) => handleNavClick(item, e)}
                  className="text-sm font-medium transition-colors hover:text-[#D4AF37]"
                  style={{ color: '#e8e6e3' }}
                >
                  {item.label}
                </a>
              )
            ))}
            
            {/* Account Button */}
            <button
              onClick={() => router.push(isAuthenticated ? '/account' : '/login')}
              className="relative p-2 flex items-center gap-1 text-[#D4AF37] hover:opacity-80 transition-opacity"
            >
              <User size={22} />
              {isAuthenticated && user && (
                <span className="text-sm font-medium hidden lg:inline text-[#e8e6e3]">
                  {user.name?.split(' ')[0]}
                </span>
              )}
            </button>
            
            {/* Orders Button */}
            {isAuthenticated && (
              <button
                onClick={() => router.push('/orders')}
                className="relative p-2 text-[#D4AF37] hover:opacity-80 transition-opacity"
                title="My Orders"
              >
                <Package size={22} />
              </button>
            )}
            
            {/* Wishlist Icon */}
            <button
              onClick={() => router.push('/wishlist')}
              className="relative p-2 text-[#D4AF37] hover:opacity-80 transition-opacity"
            >
              <Heart size={24} />
              {wishlistCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white bg-red-500">
                  {wishlistCount}
                </span>
              )}
            </button>

            {/* Cart Icon */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative p-2 text-[#D4AF37] hover:opacity-80 transition-opacity"
            >
              <ShoppingBag size={24} />
              {cartCount > 0 && (
                <span 
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ backgroundColor: '#D4AF37', color: '#1a1a2e' }}
                >
                  {cartCount}
                </span>
              )}
            </button>

            <button
              onClick={onInquiryClick}
              className="px-4 py-2 rounded-md font-medium transition-all hover:opacity-90"
              style={{ 
                background: 'linear-gradient(135deg, #D4AF37 0%, #c9a432 100%)',
                color: '#1a1a2e'
              }}
            >
              Wholesale Inquiry
            </button>
          </nav>

          {/* Mobile Right Side */}
          <div className="md:hidden flex items-center gap-2">
            <button onClick={() => router.push(isAuthenticated ? '/account' : '/login')} className="relative p-2 text-[#D4AF37]">
              <User size={22} />
            </button>
            
            <button onClick={() => router.push('/wishlist')} className="relative p-2 text-[#D4AF37]">
              <Heart size={22} />
              {wishlistCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold text-white bg-red-500">
                  {wishlistCount}
                </span>
              )}
            </button>
            
            <button onClick={() => setIsCartOpen(true)} className="relative p-2 text-[#D4AF37]">
              <ShoppingBag size={24} />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: '#D4AF37', color: '#1a1a2e' }}>
                  {cartCount}
                </span>
              )}
            </button>
            
            <button className="p-2 text-[#e8e6e3]" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden py-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.1)', backgroundColor: '#0f1419' }}>
            <nav className="flex flex-col space-y-4 px-4">
              {navItems.map((item) => (
                item.type === 'route' ? (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-sm font-medium transition-colors hover:text-[#D4AF37]"
                    style={{ color: '#e8e6e3' }}
                  >
                    {item.label}
                  </Link>
                ) : (
                  <a
                    key={item.label}
                    href={item.href}
                    onClick={(e) => handleNavClick(item, e)}
                    className="text-sm font-medium transition-colors hover:text-[#D4AF37]"
                    style={{ color: '#e8e6e3' }}
                  >
                    {item.label}
                  </a>
                )
              ))}
              
              <button
                onClick={() => { onInquiryClick?.(); setIsMobileMenuOpen(false); }}
                className="w-full py-2 rounded-md font-medium"
                style={{ 
                  background: 'linear-gradient(135deg, #D4AF37 0%, #c9a432 100%)',
                  color: '#1a1a2e'
                }}
              >
                Wholesale Inquiry
              </button>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
