'use client';

import { useTheme } from '../context/ThemeContext';
import { Heart, Users, TreePine, GraduationCap, HandHeart, Globe } from 'lucide-react';

const csrInitiatives = [
  {
    icon: TreePine,
    title: 'Environmental Conservation',
    description: 'We plant a tree for every 25 orders, contributing to reforestation efforts across India.',
    impact: '50+ trees planted',
    color: '#10B981'
  },
  {
    icon: Users,
    title: 'Artisan Communities',
    description: 'Supporting traditional artisan families by providing fair wages and sustainable livelihoods.',
    impact: '7 families supported',
    color: '#3B82F6'
  },
  {
    icon: GraduationCap,
    title: 'Education Initiative',
    description: 'A portion of proceeds funds education for children in underprivileged communities.',
    impact: '12 student years funded',
    color: '#8B5CF6'
  }
];

export default function CSRSection() {
  const { isDarkMode } = useTheme();

  return (
    <section 
      id="csr"
      className="py-20 sm:py-28 relative overflow-hidden"
      style={{ 
        background: isDarkMode 
          ? 'linear-gradient(180deg, #0f1419 0%, #162033 50%, #0f1419 100%)' 
          : 'linear-gradient(180deg, #faf7f2 0%, #f5f0e8 100%)'
      }}
    >
      {/* Decorative background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full blur-3xl"
          style={{ 
            background: `radial-gradient(circle, ${isDarkMode ? 'rgba(212,175,55,0.05)' : 'rgba(212,175,55,0.08)'} 0%, transparent 70%)`
          }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div 
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full mb-6"
            style={{ 
              background: 'rgba(239,68,68,0.1)', 
              border: '1px solid rgba(239,68,68,0.2)'
            }}
          >
            <Heart size={16} style={{ color: '#EF4444' }} />
            <span className="text-sm font-medium tracking-wider" style={{ color: '#EF4444' }}>
              OUR COMMITMENT
            </span>
          </div>
          
          <h2 
            className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6"
            style={{ 
              fontFamily: "'Playfair Display', serif",
              color: isDarkMode ? '#ffffff' : 'var(--japanese-indigo)'
            }}
          >
            Giving Back to Society
          </h2>
          <p 
            className="text-lg max-w-3xl mx-auto leading-relaxed"
            style={{ color: isDarkMode ? 'rgba(255,255,255,0.7)' : 'var(--text-subtle)' }}
          >
            At Addrika, we believe business should be a force for good. Through our voluntary CSR initiatives, 
            we're committed to making a positive impact on communities and the environment.
          </p>
        </div>

        {/* CSR Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {csrInitiatives.map((item, index) => {
            const Icon = item.icon;
            return (
              <div 
                key={index}
                className="group relative rounded-2xl p-8 transition-all duration-300 hover:-translate-y-2"
                style={{ 
                  background: isDarkMode 
                    ? 'linear-gradient(165deg, rgba(26,26,46,0.9) 0%, rgba(22,33,62,0.9) 100%)'
                    : 'rgba(255,255,255,0.9)',
                  backdropFilter: 'blur(10px)',
                  border: isDarkMode 
                    ? '1px solid rgba(255,255,255,0.1)' 
                    : '1px solid rgba(0,0,0,0.05)',
                  boxShadow: isDarkMode
                    ? '0 15px 50px rgba(0,0,0,0.4)'
                    : '0 15px 50px rgba(0,0,0,0.1)'
                }}
              >
                {/* Icon */}
                <div 
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-transform duration-300 group-hover:scale-110"
                  style={{ 
                    background: `linear-gradient(135deg, ${item.color}20 0%, ${item.color}10 100%)`,
                    border: `1px solid ${item.color}30`
                  }}
                >
                  <Icon size={32} style={{ color: item.color }} />
                </div>
                
                {/* Content */}
                <h3 
                  className="text-xl font-semibold mb-3"
                  style={{ 
                    fontFamily: "'Playfair Display', serif",
                    color: isDarkMode ? '#ffffff' : 'var(--japanese-indigo)'
                  }}
                >
                  {item.title}
                </h3>
                <p 
                  className="text-sm mb-6 leading-relaxed"
                  style={{ color: isDarkMode ? 'rgba(255,255,255,0.6)' : 'var(--text-subtle)' }}
                >
                  {item.description}
                </p>
                
                {/* Impact Badge */}
                <div 
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full"
                  style={{ 
                    background: `${item.color}15`,
                    border: `1px solid ${item.color}30`
                  }}
                >
                  <HandHeart size={14} style={{ color: item.color }} />
                  <span className="text-xs font-semibold" style={{ color: item.color }}>
                    {item.impact}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Mission Statement */}
        <div 
          className="text-center rounded-2xl p-10 lg:p-14"
          style={{ 
            background: isDarkMode 
              ? 'linear-gradient(135deg, rgba(212,175,55,0.1) 0%, rgba(42,59,73,0.2) 100%)'
              : 'linear-gradient(135deg, rgba(212,175,55,0.1) 0%, rgba(42,59,73,0.05) 100%)',
            border: '1px solid rgba(212,175,55,0.2)'
          }}
        >
          <Globe 
            size={48} 
            className="mx-auto mb-6"
            style={{ color: 'var(--metallic-gold)' }}
          />
          <blockquote 
            className="text-xl sm:text-2xl lg:text-3xl font-medium italic mb-6"
            style={{ 
              fontFamily: "'Playfair Display', serif",
              color: isDarkMode ? '#ffffff' : 'var(--japanese-indigo)'
            }}
          >
            "Every fragrance we create carries the essence of our commitment to people and planet."
          </blockquote>
          <p 
            className="text-sm"
            style={{ color: isDarkMode ? 'rgba(255,255,255,0.5)' : 'var(--text-subtle)' }}
          >
            — The Addrika Team
          </p>
        </div>
      </div>
    </section>
  );
}
