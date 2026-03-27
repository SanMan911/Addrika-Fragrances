import React from 'react';
import { csrActivities } from '../data/staticContent';
import { GraduationCap, Heart, Users, Leaf, Activity, Shield } from 'lucide-react';

const iconMap = {
  GraduationCap,
  Heart,
  Users,
  Leaf,
  Activity,
  Shield
};

const CSRSection = () => {
  return (
    <section 
      id="csr" 
      className="py-20 sm:py-32 relative overflow-hidden"
      style={{ 
        background: 'linear-gradient(180deg, #2a3b49 0%, #1a252f 60%, #141c23 100%)'
      }}
    >
      {/* Subtle gold glow accents */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute top-0 left-1/2 transform -translate-x-1/2 w-[800px] h-[200px] opacity-[0.08] blur-3xl"
          style={{ backgroundColor: 'var(--metallic-gold)' }}
        />
        <div 
          className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full opacity-[0.05] blur-3xl"
          style={{ backgroundColor: 'var(--metallic-gold)' }}
        />
      </div>
      
      {/* Gold accent line at top */}
      <div 
        className="absolute top-0 left-0 w-full h-[3px]"
        style={{ 
          background: 'linear-gradient(90deg, transparent 15%, var(--metallic-gold) 50%, transparent 85%)'
        }}
      />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold mb-6 font-serif text-white">
            Our CSR Commitment
          </h2>
          <p className="text-lg sm:text-xl max-w-3xl mx-auto" style={{ color: 'var(--text-light)' }}>
            At Addrika, we believe in giving back to society. Through our partnerships with dedicated NGOs,
            we're making a real difference in communities across the nation.
          </p>
        </div>

        {/* Activities Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {csrActivities.map((activity, index) => {
            const IconComponent = iconMap[activity.icon];
            return (
              <div
                key={index}
                className="group relative rounded-2xl p-8"
                style={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  transition: 'transform 0.3s ease, background-color 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                }}
              >
                {/* Icon */}
                <div 
                  className="w-14 h-14 rounded-full flex items-center justify-center mb-6"
                  style={{ backgroundColor: 'var(--metallic-gold)' }}
                >
                  <IconComponent size={28} style={{ color: 'var(--japanese-indigo)' }} />
                </div>

                {/* Content */}
                <h3 className="text-xl font-bold mb-4 font-serif text-white">
                  {activity.title}
                </h3>
                <p className="text-base leading-relaxed" style={{ color: 'var(--text-light)' }}>
                  {activity.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Bottom message */}
        <div className="mt-16 text-center">
          <div 
            className="inline-block px-8 py-4 rounded-full"
            style={{ backgroundColor: 'var(--metallic-gold)' }}
          >
            <p className="text-lg font-semibold" style={{ color: 'var(--japanese-indigo)' }}>
              Every purchase contributes to these noble causes
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CSRSection;