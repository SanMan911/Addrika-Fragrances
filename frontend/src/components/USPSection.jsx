import React from 'react';
import { Flame, Sparkles, Award, Shield, Heart } from 'lucide-react';
import { companyInfo } from '../mockData';
import { ScrollReveal } from '../hooks/useScrollAnimation';

const USPSection = () => {
  const features = [
    {
      icon: Flame,
      title: 'Long Lasting Fragrance',
      description: `Our premium ${companyInfo.stickLength} incense sticks burn for over ${companyInfo.burnTime}, delivering a divine essence that fills your sacred spaces with an inviting aroma and exceptional value.`,
      accent: 'var(--metallic-gold)'
    },
    {
      icon: Sparkles,
      title: 'Premium Natural Ingredients',
      description: 'Crafted with natural oils and unique exotic ingredients, each stick delivers authentic scents—a pure aromatic bliss experience that elevates your home aromatherapy.',
      accent: 'var(--japanese-indigo)'
    },
    {
      icon: Heart,
      title: 'Women-Led Production',
      description: 'Our incense is handcrafted in partnership with Women Self-Help Groups from rural communities. From seed to scent, every stick supports female artisans, preserving traditional craftsmanship while empowering livelihoods.',
      accent: 'var(--metallic-gold)'
    },
    {
      icon: Award,
      title: 'Great for Gifting',
      description: 'Available in 50g (perfect for trying) and 200g (best value) sizes. A thoughtful gift with earthy fusion scents, ideal for combo savers and those seeking premium attar oil alternatives.',
      accent: 'var(--japanese-indigo)'
    },
    {
      icon: Shield,
      title: 'Community-First CSR',
      description: 'Every purchase fuels our voluntary CSR initiatives—supporting education, healthcare, and women\'s welfare. Together with our SHG partners, we\'re building a more equitable future, one fragrance at a time.',
      accent: 'var(--metallic-gold)'
    }
  ];

  return (
    <section 
      id="usp" 
      className="py-20 sm:py-32 relative overflow-hidden"
      style={{ 
        background: 'var(--section-bg-usp, linear-gradient(180deg, #f5f0e8 0%, #faf8f5 50%, #ffffff 100%))'
      }}
    >
      {/* Dark mode background override */}
      <style>{`
        .dark #usp {
          --section-bg-usp: linear-gradient(180deg, #1e293b 0%, #0f172a 50%, #1e293b 100%) !important;
        }
      `}</style>
      {/* Gold accent line at top */}
      <div 
        className="absolute top-0 left-0 w-full h-[2px]"
        style={{ 
          background: 'linear-gradient(90deg, transparent 20%, var(--metallic-gold) 50%, transparent 80%)'
        }}
      />
      
      {/* Subtle decorative circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute -top-20 -right-20 w-[400px] h-[400px] rounded-full opacity-[0.04] blur-2xl"
          style={{ backgroundColor: 'var(--metallic-gold)' }}
        />
        <div 
          className="absolute -bottom-20 -left-20 w-[300px] h-[300px] rounded-full opacity-[0.03] blur-2xl"
          style={{ backgroundColor: 'var(--japanese-indigo)' }}
        />
      </div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Section Header */}
        <div className="text-center mb-16">
          <ScrollReveal animation="fade-in-up">
            <h2 
              className="text-4xl sm:text-5xl font-bold mb-6 font-serif"
              style={{ color: 'var(--japanese-indigo)' }}
            >
              Why Choose Addrika?
            </h2>
          </ScrollReveal>
          <ScrollReveal animation="fade-in-up" delay={100}>
            <p 
              className="text-lg sm:text-xl max-w-3xl mx-auto"
              style={{ color: 'var(--text-subtle)' }}
            >
              Where tradition meets modern sophistication—authentic incense with meditative properties that create spiritual connection in every moment
            </p>
          </ScrollReveal>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {features.map((feature, index) => {
            const IconComponent = feature.icon;
            return (
              <ScrollReveal 
                key={index} 
                animation="fade-in-up" 
                delay={100 + index * 100}
              >
                <div
                  className="group relative bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-md hover:shadow-xl hover-lift h-full"
                  style={{ 
                    transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                    border: '1px solid rgba(30, 58, 82, 0.1)'
                  }}
                >
                  {/* Icon */}
                  <div 
                    className="w-14 h-14 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300"
                    style={{ backgroundColor: `${feature.accent}20` }}
                  >
                    <IconComponent size={28} style={{ color: feature.accent }} />
                  </div>

                  {/* Content */}
                  <h3 
                    className="text-2xl font-bold mb-4 font-serif"
                    style={{ color: 'var(--japanese-indigo)' }}
                  >
                    {feature.title}
                  </h3>
                  <p 
                    className="text-base leading-relaxed"
                    style={{ color: 'var(--text-subtle)' }}
                  >
                    {feature.description}
                  </p>

                  {/* Decorative accent line */}
                  <div 
                    className="absolute bottom-0 left-0 w-full h-1 transform scale-x-0 group-hover:scale-x-100 origin-left"
                    style={{ 
                      backgroundColor: feature.accent,
                      transition: 'transform 0.3s ease'
                    }}
                  />
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default USPSection;