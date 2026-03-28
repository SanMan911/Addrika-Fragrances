'use client';

import { useRouter } from 'next/navigation';
import { useTheme } from '../context/ThemeContext';
import { ShoppingBag, ArrowRight, Sparkles } from 'lucide-react';

export default function CTASection() {
  const { isDarkMode } = useTheme();
  const router = useRouter();

  return (
    <section 
      className="py-20 sm:py-28 relative overflow-hidden"
      style={{ 
        background: isDarkMode 
          ? 'linear-gradient(180deg, #0f1419 0%, #1a2332 100%)' 
          : 'linear-gradient(180deg, #2B3A4A 0%, #1a252f 100%)'
      }}
    >
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute top-0 left-1/4 w-[400px] h-[400px] rounded-full blur-3xl opacity-20"
          style={{ backgroundColor: 'var(--metallic-gold)' }}
        />
        <div 
          className="absolute bottom-0 right-1/4 w-[300px] h-[300px] rounded-full blur-3xl opacity-15"
          style={{ backgroundColor: 'var(--metallic-gold)' }}
        />
      </div>

      {/* Gold accent line */}
      <div 
        className="absolute top-0 left-0 right-0 h-1"
        style={{ 
          background: 'linear-gradient(90deg, transparent 10%, var(--metallic-gold) 50%, transparent 90%)'
        }}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative text-center">
        {/* Badge */}
        <div 
          className="inline-flex items-center gap-2 px-5 py-2 rounded-full mb-8"
          style={{ 
            background: 'rgba(212,175,55,0.15)', 
            border: '1px solid rgba(212,175,55,0.3)'
          }}
        >
          <Sparkles size={16} style={{ color: '#D4AF37' }} />
          <span className="text-sm font-medium tracking-wider" style={{ color: '#D4AF37' }}>
            LIMITED TIME OFFER
          </span>
        </div>

        {/* Heading */}
        <h2 
          className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6 text-white"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          Experience Sacred Luxury
        </h2>

        {/* Subheading */}
        <p className="text-lg sm:text-xl mb-10 text-white/70 max-w-2xl mx-auto">
          Begin your journey with Addrika's premium zero-charcoal incense. 
          Free shipping on orders above ₹499.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={() => document.getElementById('fragrances')?.scrollIntoView({ behavior: 'smooth' })}
            className="group flex items-center gap-3 px-8 py-4 rounded-xl font-semibold text-lg transition-all hover:-translate-y-1"
            style={{ 
              background: 'linear-gradient(135deg, #D4AF37 0%, #f5d67a 50%, #D4AF37 100%)',
              color: '#1a1a2e',
              boxShadow: '0 10px 40px rgba(212,175,55,0.4)'
            }}
          >
            <ShoppingBag size={22} />
            Shop Now
            <ArrowRight size={20} className="transition-transform group-hover:translate-x-1" />
          </button>
          
          <button
            onClick={() => router.push('/our-story')}
            className="flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-lg text-white/90 border-2 border-white/30 hover:bg-white/10 transition-all"
          >
            Learn Our Story
          </button>
        </div>

        {/* Trust indicators */}
        <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 mt-12 pt-10 border-t border-white/10">
          <div className="text-center">
            <div className="text-2xl font-bold text-white">10,000+</div>
            <div className="text-xs text-white/50 uppercase tracking-wider">Happy Customers</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white">4.8★</div>
            <div className="text-xs text-white/50 uppercase tracking-wider">Average Rating</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white">100%</div>
            <div className="text-xs text-white/50 uppercase tracking-wider">Natural Ingredients</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold" style={{ color: '#D4AF37' }}>Zero</div>
            <div className="text-xs text-white/50 uppercase tracking-wider">Charcoal Added</div>
          </div>
        </div>
      </div>
    </section>
  );
}
