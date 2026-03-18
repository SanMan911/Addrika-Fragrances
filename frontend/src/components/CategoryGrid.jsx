import React from 'react';
import { productCategories } from '../mockData';
import { Sparkles, ArrowRight, Clock, Flame, Award } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { ScrollReveal, StaggeredReveal } from '../hooks/useScrollAnimation';

const CategoryGrid = () => {
  const { isDarkMode } = useTheme();
  
  // Only show active categories (hide Coming Soon items)
  const activeCategories = productCategories.filter(cat => cat.active);
  
  const handleCategoryClick = (category) => {
    if (category.active && category.scrollTarget) {
      document.getElementById(category.scrollTarget)?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section 
      id="categories" 
      className="py-16 sm:py-24 relative transition-colors duration-500"
      style={{ 
        background: isDarkMode 
          ? 'linear-gradient(180deg, #0f1419 0%, #1a2332 50%, #0f1419 100%)'
          : 'linear-gradient(180deg, #faf8f5 0%, #ffffff 50%, #faf8f5 100%)'
      }}
    >
      {/* Subtle decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute top-20 left-1/4 w-[400px] h-[400px] rounded-full blur-3xl transition-opacity duration-500"
          style={{ 
            backgroundColor: isDarkMode ? '#e5c158' : 'var(--metallic-gold)',
            opacity: isDarkMode ? 0.08 : 0.04
          }}
        />
        <div 
          className="absolute bottom-20 right-1/4 w-[350px] h-[350px] rounded-full blur-3xl transition-opacity duration-500"
          style={{ 
            backgroundColor: isDarkMode ? '#4a7199' : 'var(--japanese-indigo)',
            opacity: isDarkMode ? 0.06 : 0.03
          }}
        />
      </div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Section Header */}
        <div className="text-center mb-12">
          <ScrollReveal animation="fade-in-up">
            <h2 
              className="text-4xl sm:text-5xl font-bold mb-4 font-serif"
              style={{ color: 'var(--japanese-indigo)' }}
              data-testid="category-section-title"
            >
              Addrika Fragrances
            </h2>
          </ScrollReveal>
          <ScrollReveal animation="fade-in-up" delay={100}>
            <p 
              className="text-lg sm:text-xl max-w-2xl mx-auto"
              style={{ color: 'var(--text-subtle)' }}
            >
              Discover our curated collections of premium fragrances and lifestyle essentials
            </p>
          </ScrollReveal>
        </div>

        {/* Category Grid - Only Active Categories */}
        <div className={`grid grid-cols-1 ${activeCategories.length === 1 ? 'max-w-md mx-auto' : 'sm:grid-cols-2 lg:grid-cols-4'} gap-6`}>
          {activeCategories.map((category, index) => (
            <ScrollReveal 
              key={category.id}
              animation="fade-in-up" 
              delay={100 + index * 100}
            >
              <div
                onClick={() => handleCategoryClick(category)}
                className="group relative rounded-2xl overflow-hidden shadow-md transition-all duration-300 h-full hover:shadow-xl hover:-translate-y-2 cursor-pointer"
                style={{ 
                  backgroundColor: isDarkMode ? '#1a2332' : '#ffffff',
                  border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(30, 58, 82, 0.08)'
                }}
                data-testid={`category-card-${category.id}`}
              >
                {/* Image/Placeholder Area */}
                <div 
                  className="relative h-44 overflow-hidden"
                  style={{ backgroundColor: isDarkMode ? '#243447' : '#f8f6f3' }}
                >
                  {category.image ? (
                    <img
                      src={category.image}
                      alt={category.name}
                      className="w-full h-full object-contain p-4 transition-all duration-500 group-hover:scale-110"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Sparkles 
                      size={48} 
                      className="opacity-30"
                      style={{ color: 'var(--japanese-indigo)' }}
                    />
                  </div>
                )}

                {/* Gradient overlay */}
                <div 
                  className="absolute inset-0"
                  style={{ 
                    background: 'linear-gradient(to top, rgba(30, 58, 82, 0.6) 0%, transparent 50%)'
                  }}
                />

                {/* Badge */}
                <div 
                  className="absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: category.badgeColor }}
                  data-testid={`category-badge-${category.id}`}
                >
                  {category.badge}
                </div>
              </div>

              {/* Content */}
              <div className="p-5">
                <h3 
                  className="text-lg font-bold mb-1"
                  style={{ color: 'var(--japanese-indigo)' }}
                >
                  {category.name}
                </h3>
                <p 
                  className="text-sm mb-2"
                  style={{ color: 'var(--metallic-gold)' }}
                >
                  {category.subtitle}
                </p>
                <p 
                  className="text-sm leading-relaxed mb-3"
                  style={{ color: 'var(--text-subtle)' }}
                >
                  {category.description}
                </p>

                {/* Product specs */}
                {category.specs && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {category.specs.map((spec, idx) => (
                      <div 
                        key={idx}
                        className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
                        style={{ 
                          backgroundColor: 'var(--metallic-gold)',
                          color: 'white'
                        }}
                      >
                        {spec.icon === 'clock' && <Clock size={12} />}
                        {spec.icon === 'flame' && <Flame size={12} />}
                        {spec.icon === 'award' && <Award size={12} />}
                        <span>{spec.text}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Arrow link */}
                <div 
                  className="flex items-center gap-2 text-sm font-semibold group-hover:gap-3 transition-all"
                  style={{ color: 'var(--metallic-gold)' }}
                >
                  <span>Explore Collection</span>
                  <ArrowRight size={16} />
                </div>
              </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CategoryGrid;
