import React from 'react';
import { Mail, Phone, MapPin, Facebook, Instagram, Twitter } from 'lucide-react';
import { companyInfo } from '../mockData';
import NewsletterSubscribe from './NewsletterSubscribe';
import { useInquiry } from '../context/InquiryContext';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const { openInquiry } = useInquiry();

  return (
    <footer 
      className="relative overflow-hidden"
      style={{ 
        background: 'linear-gradient(180deg, #1a252f 0%, #141c23 100%)'
      }}
    >
      {/* Gold accent line at top */}
      <div 
        className="absolute top-0 left-0 w-full h-[2px]"
        style={{ 
          background: 'linear-gradient(90deg, transparent 10%, var(--metallic-gold) 50%, transparent 90%)'
        }}
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
              src="/images/logos/addrika-logo.png?v=2" 
              alt="Addrika - Elegance in Every Scent" 
              className="h-24 w-auto mb-4"
              style={{ filter: 'brightness(0) invert(1)' }}
              onError={(e) => {
                // Fallback to text if image not found
                console.log('Footer logo failed to load');
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'block';
              }}
            />
            <h3 
              className="text-2xl font-bold mb-4 font-serif text-white"
              style={{ display: 'none' }}
            >
              {companyInfo.brandName}
            </h3>
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
              <li>
                <a 
                  href="#fragrances" 
                  className="hover:opacity-70"
                  style={{ color: 'var(--text-light)', transition: 'opacity 0.3s ease' }}
                >
                  Fragrances
                </a>
              </li>
              <li>
                <a 
                  href="/our-story" 
                  className="hover:opacity-70"
                  style={{ color: 'var(--text-light)', transition: 'opacity 0.3s ease' }}
                >
                  Our Story
                </a>
              </li>
              <li>
                <a 
                  href="/about-us" 
                  className="hover:opacity-70"
                  style={{ color: 'var(--text-light)', transition: 'opacity 0.3s ease' }}
                >
                  About Us
                </a>
              </li>
              <li>
                <a 
                  href="/blog" 
                  className="hover:opacity-70"
                  style={{ color: 'var(--text-light)', transition: 'opacity 0.3s ease' }}
                >
                  Blog
                </a>
              </li>
              <li>
                <a 
                  href="#csr" 
                  className="hover:opacity-70"
                  style={{ color: 'var(--text-light)', transition: 'opacity 0.3s ease' }}
                >
                  CSR Initiatives
                </a>
              </li>
              <li>
                <a 
                  href="/find-retailers" 
                  className="hover:opacity-70"
                  style={{ color: 'var(--text-light)', transition: 'opacity 0.3s ease' }}
                >
                  Find Retailers
                </a>
              </li>
              <li>
                <a 
                  href="/track-order" 
                  className="hover:opacity-70"
                  style={{ color: 'var(--text-light)', transition: 'opacity 0.3s ease' }}
                >
                  Track Order
                </a>
              </li>
              <li>
                <a 
                  href="#contact" 
                  className="hover:opacity-70"
                  style={{ color: 'var(--text-light)', transition: 'opacity 0.3s ease' }}
                >
                  Contact
                </a>
              </li>
              <li>
                <button 
                  onClick={() => openInquiry('distributor')}
                  className="hover:opacity-70 flex items-center gap-1 text-left"
                  style={{ color: 'var(--metallic-gold)', transition: 'opacity 0.3s ease' }}
                  title="Become a regional distributor"
                  data-testid="partner-with-us-btn"
                >
                  Partner With Us
                </button>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-lg font-semibold mb-4 text-white">Legal</h4>
            <ul className="space-y-2">
              <li>
                <a 
                  href="/shipping-returns" 
                  className="hover:opacity-70"
                  style={{ color: 'var(--text-light)', transition: 'opacity 0.3s ease' }}
                >
                  Shipping & Returns
                </a>
              </li>
              <li>
                <a 
                  href="/privacy-policy" 
                  className="hover:opacity-70"
                  style={{ color: 'var(--text-light)', transition: 'opacity 0.3s ease' }}
                >
                  Privacy Policy
                </a>
              </li>
              <li>
                <a 
                  href="/terms-of-service" 
                  className="hover:opacity-70"
                  style={{ color: 'var(--text-light)', transition: 'opacity 0.3s ease' }}
                >
                  Terms of Service
                </a>
              </li>
            </ul>
            
            {/* Social Links */}
            <h4 className="text-lg font-semibold mb-4 text-white mt-6">Follow Us</h4>
            <div className="flex gap-4">
              <a
                href="https://www.facebook.com/brand.addrika"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full flex items-center justify-center hover:opacity-70"
                style={{ 
                  backgroundColor: 'var(--metallic-gold)',
                  transition: 'opacity 0.3s ease'
                }}
                data-testid="footer-facebook-link"
              >
                <Facebook size={20} color="white" />
              </a>
              <a
                href="https://www.instagram.com/addrika.fragrances/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full flex items-center justify-center hover:opacity-70"
                style={{ 
                  backgroundColor: 'var(--metallic-gold)',
                  transition: 'opacity 0.3s ease'
                }}
                data-testid="footer-instagram-link"
              >
                <Instagram size={20} color="white" />
              </a>
              <span
                className="w-10 h-10 rounded-full flex items-center justify-center cursor-not-allowed"
                style={{ 
                  backgroundColor: 'var(--metallic-gold)',
                  opacity: 0.4,
                  filter: 'grayscale(100%)'
                }}
                title="Coming soon"
                data-testid="footer-twitter-disabled"
              >
                <Twitter size={20} color="white" />
              </span>
            </div>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="text-lg font-semibold mb-4 text-white">Contact Us</h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <Mail size={20} style={{ color: 'var(--metallic-gold)' }} className="mt-0.5 flex-shrink-0" />
                <span style={{ color: 'var(--text-light)' }}>contact.us@centraders.com</span>
              </li>
              <li className="flex items-start gap-3">
                <Phone size={20} style={{ color: 'var(--metallic-gold)' }} className="mt-0.5 flex-shrink-0" />
                <span style={{ color: 'var(--text-light)' }}>(+91) 9667-269-711</span>
              </li>
              <li className="flex items-start gap-3">
                <MapPin size={20} style={{ color: 'var(--metallic-gold)' }} className="mt-0.5 flex-shrink-0" />
                <span style={{ color: 'var(--text-light)' }}>
                  M.G. Shoppie, 745, Sector 17 Pocket A Phase II, Dwarka, South West Delhi, Delhi 110078, India
                </span>
              </li>
            </ul>
          </div>

          {/* Newsletter Subscription */}
          <div>
            <NewsletterSubscribe />
            
            {/* Amazon Store QR */}
            <div className="mt-6 pt-4 border-t" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
              <h4 className="text-sm font-semibold mb-3 text-white">Also Available On</h4>
              <a
                href="https://www.amazon.in/stores/Addrika/page/47D8C89A-0CC2-4AC9-B23C-7E45B6DAC25F"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block hover:opacity-90 transition-opacity"
                data-testid="amazon-store-qr"
              >
                <img 
                  src="https://customer-assets.emergentagent.com/job_a07e6d32-9c9e-45f4-9442-1ac499c5868a/artifacts/avdotleo_1000326862.jpg"
                  alt="Scan to visit our Amazon Store"
                  className="w-24 h-24 rounded-lg"
                  style={{ 
                    border: '2px solid var(--metallic-gold)',
                    backgroundColor: 'white'
                  }}
                />
              </a>
              <p className="text-xs mt-2" style={{ color: 'var(--text-light)', opacity: 0.8 }}>
                Scan or click to shop on Amazon
              </p>
            </div>
          </div>
        </div>

        {/* Flag Counter - Visitor Stats */}
        <div className="flex justify-center py-6 mb-4" data-testid="flag-counter-container">
          <a 
            href="https://info.flagcounter.com/7JM" 
            target="_blank" 
            rel="noopener noreferrer"
            className="opacity-80 hover:opacity-100 transition-opacity"
            title="Visitors from around the world"
          >
            <img 
              src="https://s01.flagcounter.com/count2/7JM/bg_1A252F/txt_FFFFFF/border_C19A6B/columns_4/maxflags_12/viewers_0/labels_1/pageviews_1/flags_0/percent_0/" 
              alt="Visitors from around the world"
              className="max-w-full h-auto"
              style={{ 
                border: '1px solid rgba(193, 154, 107, 0.3)',
                borderRadius: '8px',
                maxWidth: '100%',
                width: 'auto',
                minHeight: '80px'
              }}
              loading="lazy"
              onError={(e) => {
                // Hide the flag counter if it fails to load
                e.target.style.display = 'none';
                e.target.parentElement.innerHTML = `
                  <div style="
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 12px 20px;
                    background: rgba(26, 37, 47, 0.8);
                    border: 1px solid rgba(193, 154, 107, 0.3);
                    border-radius: 8px;
                    color: #b8c0cc;
                    font-size: 14px;
                  ">
                    <span style="font-size: 20px;">🌍</span>
                    <span>Visitors from around the world</span>
                  </div>
                `;
              }}
            />
          </a>
        </div>

        {/* Bottom Bar */}
        <div 
          className="pt-8 border-t flex flex-col sm:flex-row justify-between items-center gap-4"
          style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}
        >
          <p className="text-sm" style={{ color: 'var(--text-light)' }}>
            © {currentYear} {companyInfo.companyName}. All rights reserved.
          </p>
          <div className="flex gap-6 text-sm">
            <a 
              href="/privacy-policy" 
              className="hover:opacity-70"
              style={{ color: 'var(--text-light)', transition: 'opacity 0.3s ease' }}
            >
              Privacy Policy
            </a>
            <a 
              href="/terms-of-service" 
              className="hover:opacity-70"
              style={{ color: 'var(--text-light)', transition: 'opacity 0.3s ease' }}
            >
              Terms of Service
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;