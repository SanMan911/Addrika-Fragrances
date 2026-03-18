import React from 'react';
import { Button } from './ui/button';
import { ShoppingCart, Building2, MapPin } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const CTASection = ({ onRetailClick, onWholesaleClick }) => {
  const { isDarkMode } = useTheme();
  
  return (
    <section 
      id="contact" 
      className="py-16 sm:py-24 relative overflow-hidden transition-colors duration-500"
      style={{ 
        background: isDarkMode 
          ? 'linear-gradient(180deg, #0f1419 0%, #1a2332 50%, #0f1419 100%)'
          : 'linear-gradient(180deg, #faf8f5 0%, #ffffff 50%, #faf8f5 100%)'
      }}
    >
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[400px] sm:w-[600px] h-[400px] sm:h-[600px] rounded-full blur-3xl transition-opacity duration-500"
          style={{ 
            backgroundColor: isDarkMode ? '#e5c158' : 'var(--metallic-gold)',
            opacity: isDarkMode ? 0.06 : 0.03
          }}
        />
        <div 
          className="absolute top-20 right-10 w-[200px] sm:w-[300px] h-[200px] sm:h-[300px] rounded-full blur-3xl transition-opacity duration-500"
          style={{ 
            backgroundColor: isDarkMode ? '#4a7199' : 'var(--japanese-indigo)',
            opacity: isDarkMode ? 0.08 : 0.04
          }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Section Header */}
        <div className="text-center mb-10 sm:mb-16">
          <h2 
            className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 font-serif"
            style={{ color: isDarkMode ? '#f5f5f5' : 'var(--japanese-indigo)' }}
          >
            Ready to Experience Addrika?
          </h2>
          <p 
            className="text-base sm:text-lg lg:text-xl max-w-2xl mx-auto"
            style={{ color: isDarkMode ? '#b8c0cc' : 'var(--text-subtle)' }}
          >
            Choose your preferred way to purchase our premium agarbattis
          </p>
        </div>

        {/* CTA Buttons Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 max-w-5xl mx-auto">
          {/* Retail Purchase */}
          <div 
            className="group rounded-2xl p-6 sm:p-8 hover:shadow-xl transition-all duration-300"
            style={{ 
              backgroundColor: isDarkMode ? 'rgba(26, 35, 50, 0.8)' : 'white',
              border: isDarkMode ? '1px solid rgba(212, 175, 55, 0.2)' : '1px solid rgba(30, 58, 82, 0.1)',
              boxShadow: isDarkMode 
                ? '0 4px 20px rgba(0, 0, 0, 0.3)' 
                : '0 4px 20px rgba(0, 0, 0, 0.08)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div 
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-5"
              style={{ backgroundColor: 'var(--metallic-gold)' }}
            >
              <ShoppingCart size={22} className="sm:w-6 sm:h-6" color="white" />
            </div>
            <h3 
              className="text-lg sm:text-xl font-bold mb-2 sm:mb-3 font-serif text-center"
              style={{ color: isDarkMode ? '#f5f5f5' : 'var(--japanese-indigo)' }}
            >
              Buy Now
            </h3>
            <p 
              className="mb-4 sm:mb-5 text-sm text-center"
              style={{ color: isDarkMode ? '#9aa0a6' : 'var(--text-subtle)' }}
            >
              Purchase directly for personal use
            </p>
            <Button
              onClick={() => document.getElementById('fragrances').scrollIntoView({ behavior: 'smooth' })}
              className="w-full text-white font-semibold"
              style={{ backgroundColor: 'var(--metallic-gold)' }}
            >
              Shop Now
            </Button>
          </div>

          {/* Wholesale Inquiry */}
          <div 
            className="group rounded-2xl p-6 sm:p-8 hover:shadow-xl transition-all duration-300"
            style={{ 
              backgroundColor: isDarkMode ? 'rgba(26, 35, 50, 0.8)' : 'white',
              border: isDarkMode ? '1px solid rgba(212, 175, 55, 0.2)' : '1px solid rgba(30, 58, 82, 0.1)',
              boxShadow: isDarkMode 
                ? '0 4px 20px rgba(0, 0, 0, 0.3)' 
                : '0 4px 20px rgba(0, 0, 0, 0.08)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div 
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-5"
              style={{ backgroundColor: 'var(--metallic-gold)' }}
            >
              <Building2 size={22} className="sm:w-6 sm:h-6" color="white" />
            </div>
            <h3 
              className="text-lg sm:text-xl font-bold mb-2 sm:mb-3 font-serif text-center"
              style={{ color: isDarkMode ? '#f5f5f5' : 'var(--japanese-indigo)' }}
            >
              Wholesale
            </h3>
            <p 
              className="mb-4 sm:mb-5 text-sm text-center"
              style={{ color: isDarkMode ? '#9aa0a6' : 'var(--text-subtle)' }}
            >
              Bulk orders for businesses
            </p>
            <Button
              onClick={onWholesaleClick}
              className="w-full text-white font-semibold"
              style={{ backgroundColor: 'var(--metallic-gold)' }}
            >
              Contact Us
            </Button>
          </div>

          {/* Find Retailers */}
          <div 
            className="group rounded-2xl p-6 sm:p-8 hover:shadow-xl transition-all duration-300"
            style={{ 
              backgroundColor: isDarkMode ? 'rgba(26, 35, 50, 0.8)' : 'white',
              border: isDarkMode ? '1px solid rgba(212, 175, 55, 0.2)' : '1px solid rgba(30, 58, 82, 0.1)',
              boxShadow: isDarkMode 
                ? '0 4px 20px rgba(0, 0, 0, 0.3)' 
                : '0 4px 20px rgba(0, 0, 0, 0.08)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div 
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-5"
              style={{ backgroundColor: 'var(--metallic-gold)' }}
            >
              <MapPin size={22} className="sm:w-6 sm:h-6" color="white" />
            </div>
            <h3 
              className="text-lg sm:text-xl font-bold mb-2 sm:mb-3 font-serif text-center"
              style={{ color: isDarkMode ? '#f5f5f5' : 'var(--japanese-indigo)' }}
            >
              Find Retailers
            </h3>
            <p 
              className="mb-4 sm:mb-5 text-sm text-center"
              style={{ color: isDarkMode ? '#9aa0a6' : 'var(--text-subtle)' }}
            >
              Locate authorized retailers near you
            </p>
            <Button
              onClick={onRetailClick}
              className="w-full text-white font-semibold"
              style={{ backgroundColor: 'var(--metallic-gold)' }}
            >
              Find Store
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTASection;