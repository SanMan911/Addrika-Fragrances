'use client';

import Link from 'next/link';
import { Mail, Phone, MapPin, Facebook, Instagram, Twitter } from 'lucide-react';

const companyInfo = {
  brandName: 'Addrika',
  companyName: 'Centsible Traders Private Limited',
  email: 'care@centraders.com',
  phone: '+91 98765 43210',
  address: 'New Delhi, India'
};

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer 
      id="contact"
      className="relative overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #1a252f 0%, #141c23 100%)' }}
    >
      {/* Gold accent line */}
      <div 
        className="absolute top-0 left-0 w-full h-[2px]"
        style={{ background: 'linear-gradient(90deg, transparent 10%, var(--metallic-gold) 50%, transparent 90%)' }}
      />
      
      {/* Subtle glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute top-0 left-1/2 transform -translate-x-1/2 w-[600px] h-[200px] opacity-[0.06] blur-3xl"
          style={{ backgroundColor: 'var(--metallic-gold)' }}
        />
      </div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 mb-8">
          {/* Brand Column */}
          <div>
            <img 
              src="/images/logos/addrika-logo.png" 
              alt="Addrika" 
              className="h-24 w-auto mb-4"
              style={{ filter: 'brightness(0) invert(1)' }}
            />
            <p className="mb-3" style={{ color: 'var(--text-light)' }}>
              Elegance in Every Scent
            </p>
            <p className="text-sm mb-1" style={{ color: 'var(--text-light)' }}>
              {companyInfo.companyName}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-light)', opacity: 0.8 }}>
              CIN: U46491DL2022PTC392334
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-lg font-semibold mb-4 text-white">Quick Links</h4>
            <ul className="space-y-2">
              {[
                { label: 'Fragrances', href: '/#fragrances' },
                { label: 'Our Story', href: '/our-story' },
                { label: 'About Us', href: '/about-us' },
                { label: 'Blog', href: '/blog' },
                { label: 'FAQ', href: '/faq' }
              ].map(link => (
                <li key={link.label}>
                  <Link 
                    href={link.href} 
                    className="hover:opacity-70 transition-opacity"
                    style={{ color: 'var(--text-light)' }}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="text-lg font-semibold mb-4 text-white">Support</h4>
            <ul className="space-y-2">
              {[
                { label: 'Track Order', href: '/track-order' },
                { label: 'Shipping & Returns', href: '/shipping-returns' },
                { label: 'Find Retailers', href: '/find-retailers' },
                { label: 'Privacy Policy', href: '/privacy-policy' },
                { label: 'Terms of Service', href: '/terms-of-service' }
              ].map(link => (
                <li key={link.label}>
                  <Link 
                    href={link.href} 
                    className="hover:opacity-70 transition-opacity"
                    style={{ color: 'var(--text-light)' }}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="text-lg font-semibold mb-4 text-white">Contact Us</h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <Mail size={18} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--metallic-gold)' }} />
                <a 
                  href={`mailto:${companyInfo.email}`}
                  className="hover:opacity-70 transition-opacity text-sm"
                  style={{ color: 'var(--text-light)' }}
                >
                  {companyInfo.email}
                </a>
              </li>
              <li className="flex items-start gap-3">
                <Phone size={18} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--metallic-gold)' }} />
                <a 
                  href={`tel:${companyInfo.phone}`}
                  className="hover:opacity-70 transition-opacity text-sm"
                  style={{ color: 'var(--text-light)' }}
                >
                  {companyInfo.phone}
                </a>
              </li>
              <li className="flex items-start gap-3">
                <MapPin size={18} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--metallic-gold)' }} />
                <span className="text-sm" style={{ color: 'var(--text-light)' }}>
                  {companyInfo.address}
                </span>
              </li>
            </ul>
          </div>

          {/* Social & Newsletter */}
          <div>
            <h4 className="text-lg font-semibold mb-4 text-white">Follow Us</h4>
            <div className="flex gap-3 mb-6">
              <a 
                href="https://facebook.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110"
                style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
              >
                <Facebook size={18} className="text-white" />
              </a>
              <a 
                href="https://instagram.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110"
                style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
              >
                <Instagram size={18} className="text-white" />
              </a>
              <a 
                href="https://twitter.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110"
                style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
              >
                <Twitter size={18} className="text-white" />
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div 
          className="pt-8 mt-8 flex flex-col sm:flex-row items-center justify-between gap-4"
          style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}
        >
          <p className="text-sm text-center sm:text-left" style={{ color: 'var(--text-light)' }}>
            © {currentYear} {companyInfo.companyName}. All rights reserved.
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: 'var(--text-light)', opacity: 0.7 }}>
              Made with ❤️ in India
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
