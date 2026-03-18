import React, { useState } from 'react';
import { Sparkles, X, ChevronRight } from 'lucide-react';

const PromoBanner = () => {
  const [dismissed, setDismissed] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Show loading state or if dismissed
  if (dismissed) return null;
  
  // Only show free shipping tiers info on landing page
  const promos = [
    {
      id: 'shipping1',
      icon: '🚚',
      text: 'FREE Shipping on orders ₹999+ • Premium 9" 9-inch Incense',
      code: null,
      highlight: false
    },
    {
      id: 'shipping2',
      icon: '✨',
      text: 'Only ₹49 shipping on orders ₹249-₹998',
      code: null,
      highlight: false
    }
  ];

  // Duplicate promos for seamless loop
  const scrollingPromos = [...promos, ...promos, ...promos];

  return (
    <div 
      className="relative bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-white overflow-hidden rounded-xl shadow-lg"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Animated background shimmer */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
      
      {/* Marquee container */}
      <div className="relative py-2.5 flex items-center">
        {/* Static left icon */}
        <div className="hidden sm:flex items-center gap-2 px-4 bg-amber-700/50 h-full absolute left-0 z-10">
          <Sparkles size={16} className="animate-pulse" />
          <span className="text-xs font-semibold uppercase tracking-wider">Offers</span>
        </div>
        
        {/* Scrolling content */}
        <div className="flex-1 overflow-hidden">
          <div 
            className={`flex whitespace-nowrap ${isPaused ? 'animate-pause' : 'animate-marquee'}`}
            style={{ 
              animation: isPaused ? 'none' : 'marquee 15s linear infinite',
            }}
          >
            {scrollingPromos.map((promo, idx) => (
              <div 
                key={`${promo.id}-${idx}`}
                className="inline-flex items-center gap-2 sm:gap-3 mx-4 sm:mx-8"
              >
                <span className="text-base sm:text-lg">{promo.icon}</span>
                <span className="text-xs sm:text-sm font-medium">{promo.text}</span>
              </div>
            ))}
          </div>
        </div>
        
        {/* Dismiss button */}
        <button 
          onClick={() => setDismissed(true)}
          className="absolute right-2 p-1.5 hover:bg-amber-700/50 rounded-full transition-colors z-10"
          aria-label="Dismiss banner"
        >
          <X size={16} />
        </button>
      </div>
      
      {/* Bottom border animation */}
      <div className="h-0.5 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 animate-gradient-x" />
      
      <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-33.33%); }
        }
        
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        
        @keyframes gradient-x {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        
        .animate-marquee {
          animation: marquee 30s linear infinite;
        }
        
        .animate-shimmer {
          animation: shimmer 3s ease-in-out infinite;
        }
        
        .animate-gradient-x {
          background-size: 200% 200%;
          animation: gradient-x 3s ease infinite;
        }
      `}</style>
    </div>
  );
};

export default PromoBanner;
