import React from 'react';
import { packageSizes } from '../data/staticContent';
import { Package, Check } from 'lucide-react';

const PackagingSection = () => {
  return (
    <section 
      id="packaging"
      className="py-20 sm:py-32 relative overflow-hidden"
      style={{ 
        background: 'var(--section-bg-alt, linear-gradient(180deg, #faf8f5 0%, #f5f0e8 50%, #faf8f5 100%))'
      }}
    >
      {/* Dark mode background override */}
      <style>{`
        .dark #packaging {
          --section-bg-alt: linear-gradient(180deg, #0f172a 0%, #1e293b 50%, #0f172a 100%) !important;
        }
      `}</style>
      {/* Subtle decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute top-1/3 left-0 w-[400px] h-[400px] rounded-full opacity-[0.04] blur-3xl"
          style={{ backgroundColor: 'var(--metallic-gold)' }}
        />
        <div 
          className="absolute bottom-1/3 right-0 w-[350px] h-[350px] rounded-full opacity-[0.03] blur-3xl"
          style={{ backgroundColor: 'var(--japanese-indigo)' }}
        />
      </div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 
            className="text-4xl sm:text-5xl font-bold mb-6 font-serif"
            style={{ color: 'var(--japanese-indigo)' }}
          >
            Choose Your Perfect Size
          </h2>
          <p 
            className="text-lg sm:text-xl max-w-3xl mx-auto"
            style={{ color: 'var(--text-subtle)' }}
          >
            Available in two convenient sizes to suit your needs
          </p>
        </div>

        {/* Package Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {packageSizes.map((pkg, index) => (
            <div
              key={index}
              className="group relative bg-white dark:bg-slate-800 rounded-2xl p-10 shadow-lg hover:shadow-2xl"
              style={{ 
                transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                border: '2px solid rgba(30, 58, 82, 0.1)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.borderColor = 'var(--metallic-gold)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.borderColor = 'rgba(30, 58, 82, 0.1)';
              }}
            >
              {/* Icon */}
              <div className="flex justify-center mb-6">
                <div 
                  className="w-20 h-20 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: 'var(--japanese-indigo)' }}
                >
                  <Package size={40} color="white" />
                </div>
              </div>

              {/* Weight */}
              <div className="text-center mb-6">
                <h3 
                  className="text-5xl font-bold mb-2"
                  style={{ color: 'var(--metallic-gold)' }}
                >
                  {pkg.weight}
                </h3>
                <p className="text-xl" style={{ color: 'var(--text-dark)' }}>
                  {pkg.sticks}
                </p>
              </div>

              {/* Details */}
              <div className="space-y-4 mb-8">
                <div className="flex items-center justify-center gap-2">
                  <Check size={20} style={{ color: 'var(--metallic-gold)' }} />
                  <span style={{ color: 'var(--text-subtle)' }}>All 4 Fragrances Available</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <Check size={20} style={{ color: 'var(--metallic-gold)' }} />
                  <span style={{ color: 'var(--text-subtle)' }}>40+ Min Burn Time</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <Check size={20} style={{ color: 'var(--metallic-gold)' }} />
                  <span style={{ color: 'var(--text-subtle)' }}>{pkg.duration}</span>
                </div>
              </div>

              {/* Badge */}
              <div className="text-center">
                <div 
                  className="inline-block px-6 py-2 rounded-full font-semibold"
                  style={{ 
                    backgroundColor: 'var(--metallic-gold)',
                    color: 'white'
                  }}
                >
                  {pkg.duration}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PackagingSection;