import React from 'react';
import { Sparkles, Heart, Award } from 'lucide-react';
import { Button } from './ui/button';
import { useTheme } from '../context/ThemeContext';
import ParticleLogo from './ParticleLogo';
import { ScrollReveal } from '../hooks/useScrollAnimation';
import { useParallax } from '../hooks/useParallax';

const Hero = ({ onBuyClick, promoBanner }) => {
  const { isDarkMode } = useTheme();
  const { getParallaxStyle, getDiagonalParallaxStyle, getScaleParallaxStyle } = useParallax();
  
  return (
    <section 
      className="relative min-h-screen flex items-center justify-center overflow-hidden transition-colors duration-500"
      style={{ 
        background: isDarkMode 
          ? `linear-gradient(180deg, #0f1419 0%, #1a2332 50%, #0f1419 100%)`
          : `
            radial-gradient(ellipse 80% 50% at 50% 0%, rgba(212, 175, 55, 0.08) 0%, transparent 50%),
            radial-gradient(ellipse 60% 40% at 80% 100%, rgba(42, 59, 73, 0.06) 0%, transparent 40%),
            linear-gradient(180deg, #faf8f5 0%, #f5f0e8 50%, #faf8f5 100%)
          `
      }}
    >
      {/* Subtle gold accent line at top */}
      <div 
        className="absolute top-0 left-0 right-0 h-1"
        style={{ 
          background: 'linear-gradient(90deg, transparent 10%, var(--metallic-gold) 50%, transparent 90%)'
        }}
      />
      
      {/* Decorative background elements with parallax */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Top-right gold blob - moves up slowly */}
        <div 
          className="absolute top-20 right-10 w-[200px] sm:w-[350px] lg:w-[500px] h-[200px] sm:h-[350px] lg:h-[500px] rounded-full blur-3xl transition-opacity duration-500 animate-float"
          style={{ 
            backgroundColor: isDarkMode ? '#e5c158' : '#d4af37',
            opacity: isDarkMode ? 0.12 : 0.07,
            animationDuration: '6s',
            ...getParallaxStyle(0.15, 'up')
          }}
        />
        {/* Bottom-left blue blob - moves down and slightly right */}
        <div 
          className="absolute bottom-20 left-10 w-[150px] sm:w-[280px] lg:w-[400px] h-[150px] sm:h-[280px] lg:h-[400px] rounded-full blur-3xl transition-opacity duration-500 animate-float"
          style={{ 
            backgroundColor: isDarkMode ? '#4a7199' : '#2a3b49',
            opacity: isDarkMode ? 0.1 : 0.05,
            animationDuration: '8s',
            animationDelay: '1s',
            ...getDiagonalParallaxStyle(0.08, 0.05, 0)
          }}
        />
        {/* Center gold blob - scales up slightly on scroll */}
        <div 
          className="absolute top-1/2 left-1/2 w-[300px] sm:w-[550px] lg:w-[800px] h-[300px] sm:h-[550px] lg:h-[800px] rounded-full blur-3xl transition-opacity duration-500"
          style={{ 
            backgroundColor: isDarkMode ? '#e5c158' : '#d4af37',
            opacity: isDarkMode ? 0.06 : 0.03,
            marginLeft: '-150px',
            marginTop: '-150px',
            ...getScaleParallaxStyle(1, 0.0003, 1.2)
          }}
        />
        {/* Additional small floating particles for depth */}
        <div 
          className="absolute top-1/3 left-1/4 w-[80px] sm:w-[140px] lg:w-[200px] h-[80px] sm:h-[140px] lg:h-[200px] rounded-full blur-2xl"
          style={{ 
            backgroundColor: isDarkMode ? '#e5c158' : '#d4af37',
            opacity: isDarkMode ? 0.08 : 0.04,
            ...getParallaxStyle(0.25, 'up')
          }}
        />
        <div 
          className="absolute bottom-1/3 right-1/4 w-[60px] sm:w-[100px] lg:w-[150px] h-[60px] sm:h-[100px] lg:h-[150px] rounded-full blur-2xl"
          style={{ 
            backgroundColor: isDarkMode ? '#4a7199' : '#2a3b49',
            opacity: isDarkMode ? 0.06 : 0.03,
            ...getDiagonalParallaxStyle(0.12, -0.08, 0)
          }}
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-32 text-center overflow-hidden">
        {/* Main heading with Particle Animation */}
        <div className="mb-4 sm:mb-6">
          <ParticleLogo 
            src="/images/logos/addrika-brand-name-gold-transparent.png"
            alt="Addrika - Elegance in Every Scent" 
            particleCount={200}
            animationDuration={2000}
            particleSize={2.5}
            className="mb-2 sm:mb-4"
            style={{ 
              filter: isDarkMode 
                ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
                : 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))',
              minHeight: 'clamp(100px, 20vw, 180px)'
            }}
          />
        </div>

        {/* Promo Banner - Between Logo and Description */}
        {promoBanner && (
          <div className="mb-4 sm:mb-6 mx-[-16px] sm:mx-0">
            {promoBanner}
          </div>
        )}

        {/* Subtitle */}
        <ScrollReveal animation="fade-in-up" delay={200}>
          <p 
            className="text-[13px] sm:text-base md:text-lg max-w-md sm:max-w-2xl mx-auto mb-4 sm:mb-8 leading-relaxed text-center"
            style={{ color: 'var(--text-subtle)' }}
          >
            Discover our curated collections of premium fragrances and home care essentials. 
            From exquisite incense sticks to traditional dhoop and bakhoor—crafted with unique ingredients for those who appreciate sacred luxury and tradition.
          </p>
        </ScrollReveal>

        {/* Feature badges - horizontal on all screens */}
        <div className="flex flex-wrap justify-center items-center gap-2 sm:gap-4 mb-5 sm:mb-8 px-4">
          <ScrollReveal animation="fade-in-up" delay={300}>
            <div 
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full backdrop-blur-sm shadow-sm transition-all duration-300 hover-lift"
              style={{ backgroundColor: isDarkMode ? 'rgba(26, 35, 50, 0.9)' : 'rgba(255, 255, 255, 0.8)' }}
            >
              <Sparkles size={14} className="sm:w-4 sm:h-4 flex-shrink-0" style={{ color: 'var(--metallic-gold)' }} />
              <span className="font-medium text-[11px] sm:text-xs whitespace-nowrap" style={{ color: 'var(--text-dark)' }}>
                Premium Fragrances
              </span>
            </div>
          </ScrollReveal>
          <ScrollReveal animation="fade-in-up" delay={400}>
            <div 
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full backdrop-blur-sm shadow-sm transition-all duration-300 hover-lift"
              style={{ backgroundColor: isDarkMode ? 'rgba(26, 35, 50, 0.9)' : 'rgba(255, 255, 255, 0.8)' }}
            >
              <Award size={14} className="sm:w-4 sm:h-4 flex-shrink-0" style={{ color: 'var(--metallic-gold)' }} />
              <span className="font-medium text-[11px] sm:text-xs whitespace-nowrap" style={{ color: 'var(--text-dark)' }}>
                Home & Personal Care
              </span>
            </div>
          </ScrollReveal>
          <ScrollReveal animation="fade-in-up" delay={500}>
            <div 
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full backdrop-blur-sm shadow-sm transition-all duration-300 hover-lift"
              style={{ backgroundColor: isDarkMode ? 'rgba(26, 35, 50, 0.9)' : 'rgba(255, 255, 255, 0.8)' }}
            >
              <Heart size={14} className="sm:w-4 sm:h-4 flex-shrink-0" style={{ color: 'var(--metallic-gold)' }} />
              <span className="font-medium text-[11px] sm:text-xs whitespace-nowrap" style={{ color: 'var(--text-dark)' }}>
                Voluntary CSR
              </span>
            </div>
          </ScrollReveal>
        </div>

        {/* CTA Buttons */}
        <ScrollReveal animation="fade-in-up" delay={600}>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 px-6 sm:px-4 max-w-md sm:max-w-none mx-auto">
            <Button
              size="lg"
              onClick={() => document.getElementById('categories').scrollIntoView({ behavior: 'smooth' })}
              className="text-white font-semibold px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-base shadow-lg hover-lift w-full sm:w-auto"
              style={{ 
                backgroundColor: 'var(--japanese-indigo)',
                transition: 'transform 0.3s ease, opacity 0.3s ease, box-shadow 0.3s ease',
                maxWidth: '280px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(30, 58, 82, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
              }}
            >
              Explore Collections
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="font-semibold px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-base border-2 w-full sm:w-auto"
              style={{ 
                borderColor: 'var(--japanese-indigo)',
                color: 'var(--japanese-indigo)',
                transition: 'transform 0.3s ease, background-color 0.3s ease',
                maxWidth: '280px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--japanese-indigo)';
                e.currentTarget.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--japanese-indigo)';
              }}
              onClick={() => document.getElementById('csr').scrollIntoView({ behavior: 'smooth' })}
            >
              Our CSR Commitment
            </Button>
          </div>
        </ScrollReveal>

        {/* Scroll hint - elegant text with chevron, hidden on mobile */}
        <button 
          className="absolute bottom-6 sm:bottom-8 left-1/2 transform -translate-x-1/2 hidden sm:flex flex-col items-center gap-1 opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
          onClick={() => document.getElementById('categories')?.scrollIntoView({ behavior: 'smooth' })}
          aria-label="Scroll to explore"
        >
          <span 
            className="text-xs font-medium tracking-wider uppercase"
            style={{ color: 'var(--text-subtle)' }}
          >
            Explore
          </span>
          <svg 
            className="w-5 h-5 animate-bounce" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
            style={{ color: 'var(--metallic-gold)' }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>
      </div>
    </section>
  );
};

export default Hero;