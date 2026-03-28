'use client';

import { useTheme } from '../context/ThemeContext';
import { Gift, Recycle, Shield, Leaf } from 'lucide-react';

export default function PackagingSection() {
  const { isDarkMode } = useTheme();

  const features = [
    { icon: Recycle, title: 'Recyclable Materials', desc: '100% recyclable packaging' },
    { icon: Leaf, title: 'Eco-Friendly', desc: 'Biodegradable components' },
    { icon: Shield, title: 'Secure Packaging', desc: 'Protected during transit' },
    { icon: Gift, title: 'Gift Ready', desc: 'Premium presentation' }
  ];

  return (
    <section 
      className="py-20 sm:py-28 relative overflow-hidden"
      style={{ 
        background: isDarkMode 
          ? 'linear-gradient(180deg, #1a2332 0%, #0f1419 100%)' 
          : 'linear-gradient(180deg, #faf7f2 0%, #ffffff 100%)'
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Image Side */}
          <div className="relative">
            <div 
              className="absolute -inset-4 rounded-3xl opacity-20 blur-2xl"
              style={{ backgroundColor: 'var(--metallic-gold)' }}
            />
            <div 
              className="relative rounded-2xl overflow-hidden"
              style={{ 
                background: isDarkMode 
                  ? 'linear-gradient(165deg, #1a1a2e 0%, #16213e 100%)'
                  : 'linear-gradient(165deg, #f5f0e8 0%, #ffffff 100%)',
                padding: '2rem'
              }}
            >
              <img 
                src="/images/products/packaging-showcase.png"
                alt="Addrika Premium Packaging"
                className="w-full h-auto rounded-xl"
                style={{ 
                  maxHeight: '500px',
                  objectFit: 'contain'
                }}
                onError={(e) => {
                  e.target.src = '/images/products/kesar-chandan/kesar_chandan_200g.png';
                }}
              />
            </div>
          </div>

          {/* Content Side */}
          <div>
            <span 
              className="inline-block px-5 py-2 rounded-full text-sm font-medium tracking-wider mb-6"
              style={{ 
                background: 'rgba(212,175,55,0.1)', 
                color: '#D4AF37',
                border: '1px solid rgba(212,175,55,0.2)'
              }}
            >
              SUSTAINABLE PACKAGING
            </span>
            <h2 
              className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6"
              style={{ 
                fontFamily: "'Playfair Display', serif",
                color: isDarkMode ? '#ffffff' : 'var(--japanese-indigo)'
              }}
            >
              Premium & Eco-Conscious
            </h2>
            <p 
              className="text-lg mb-8 leading-relaxed"
              style={{ color: isDarkMode ? 'rgba(255,255,255,0.7)' : 'var(--text-subtle)' }}
            >
              Our commitment to sustainability extends beyond our products. Each Addrika package 
              is designed with the environment in mind, using recyclable materials without 
              compromising on the luxurious unboxing experience you deserve.
            </p>

            {/* Features Grid */}
            <div className="grid grid-cols-2 gap-4">
              {features.map((feature, idx) => {
                const Icon = feature.icon;
                return (
                  <div 
                    key={idx}
                    className="p-4 rounded-xl"
                    style={{ 
                      background: isDarkMode 
                        ? 'rgba(26,35,50,0.5)' 
                        : 'rgba(255,255,255,0.8)',
                      border: isDarkMode 
                        ? '1px solid rgba(255,255,255,0.1)' 
                        : '1px solid rgba(0,0,0,0.05)'
                    }}
                  >
                    <Icon 
                      size={24} 
                      className="mb-2"
                      style={{ color: 'var(--metallic-gold)' }}
                    />
                    <h4 
                      className="font-semibold mb-1"
                      style={{ color: isDarkMode ? '#ffffff' : 'var(--japanese-indigo)' }}
                    >
                      {feature.title}
                    </h4>
                    <p 
                      className="text-xs"
                      style={{ color: isDarkMode ? 'rgba(255,255,255,0.5)' : 'var(--text-subtle)' }}
                    >
                      {feature.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
