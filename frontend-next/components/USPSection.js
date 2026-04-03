'use client';

import { Leaf, Wind, Clock, Shield, Sparkles, Heart } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const uspItems = [
  {
    icon: Leaf,
    title: 'Zero Charcoal',
    description: 'Our incense sticks contain absolutely no charcoal, ensuring a cleaner, purer fragrance experience.',
    color: '#10B981'
  },
  {
    icon: Wind,
    title: '80% Less Smoke',
    description: 'Revolutionary formula produces significantly less smoke while delivering the same rich aroma.',
    color: '#3B82F6'
  },
  {
    icon: Clock,
    title: '40-50 Min Burn',
    description: 'Extended burn time lets you enjoy the soothing fragrance throughout your meditation or prayer.',
    color: '#D4AF37'
  },
  {
    icon: Shield,
    title: 'CSR Commitment',
    description: 'Every purchase supports local artisans and community welfare initiatives across India.',
    color: '#8B5CF6'
  },
  {
    icon: Sparkles,
    title: 'Crafted in India',
    description: 'Each stick is carefully crafted in India using traditional methods passed down through generations.',
    color: '#EC4899'
  },
  {
    icon: Heart,
    title: 'Quality Packaging',
    description: 'Premium glass jars for Bakhoor, durable plastic & paper packs for agarbattis and incense.',
    color: '#14B8A6'
  }
];

export default function USPSection() {
  const { isDarkMode } = useTheme();

  return (
    <section 
      className="py-20 sm:py-28 relative overflow-hidden"
      style={{ 
        background: isDarkMode 
          ? 'linear-gradient(180deg, #0f1419 0%, #1a2332 50%, #0f1419 100%)' 
          : 'linear-gradient(180deg, #ffffff 0%, #faf7f2 100%)'
      }}
    >
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
        <div 
          className="absolute top-20 -right-20 w-[400px] h-[400px] rounded-full blur-3xl"
          style={{ backgroundColor: 'var(--metallic-gold)', opacity: 0.1 }}
        />
        <div 
          className="absolute bottom-20 -left-20 w-[300px] h-[300px] rounded-full blur-3xl"
          style={{ backgroundColor: 'var(--japanese-indigo)', opacity: 0.1 }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Section Header */}
        <div className="text-center mb-16">
          <span 
            className="inline-block px-5 py-2 rounded-full text-sm font-medium tracking-wider mb-6"
            style={{ 
              background: 'rgba(212,175,55,0.1)', 
              color: '#D4AF37',
              border: '1px solid rgba(212,175,55,0.2)'
            }}
          >
            WHY ADDRIKA
          </span>
          <h2 
            className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6"
            style={{ 
              fontFamily: "'Playfair Display', serif",
              color: isDarkMode ? '#ffffff' : 'var(--japanese-indigo)'
            }}
          >
            The Addrika Difference
          </h2>
          <p 
            className="text-lg max-w-2xl mx-auto"
            style={{ color: isDarkMode ? 'rgba(255,255,255,0.7)' : 'var(--text-subtle)' }}
          >
            Experience the perfect blend of tradition and innovation with our premium zero-charcoal incense
          </p>
        </div>

        {/* USP Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {uspItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <div 
                key={index}
                className="group p-6 lg:p-8 rounded-2xl transition-all duration-300 hover:-translate-y-2"
                style={{ 
                  background: isDarkMode 
                    ? 'linear-gradient(165deg, rgba(26,26,46,0.8) 0%, rgba(22,33,62,0.8) 100%)'
                    : 'rgba(255,255,255,0.8)',
                  backdropFilter: 'blur(10px)',
                  border: isDarkMode 
                    ? '1px solid rgba(255,255,255,0.1)' 
                    : '1px solid rgba(0,0,0,0.05)',
                  boxShadow: isDarkMode
                    ? '0 10px 40px rgba(0,0,0,0.3)'
                    : '0 10px 40px rgba(0,0,0,0.08)'
                }}
              >
                <div 
                  className="w-14 h-14 rounded-xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110"
                  style={{ 
                    background: `linear-gradient(135deg, ${item.color}20 0%, ${item.color}10 100%)`,
                    border: `1px solid ${item.color}30`
                  }}
                >
                  <Icon size={28} style={{ color: item.color }} />
                </div>
                <h3 
                  className="text-xl font-semibold mb-3"
                  style={{ 
                    color: isDarkMode ? '#ffffff' : 'var(--japanese-indigo)',
                    fontFamily: "'Playfair Display', serif"
                  }}
                >
                  {item.title}
                </h3>
                <p 
                  className="text-sm leading-relaxed"
                  style={{ color: isDarkMode ? 'rgba(255,255,255,0.6)' : 'var(--text-subtle)' }}
                >
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
