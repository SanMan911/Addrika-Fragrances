/**
 * FragranceFilter - Filter fragrances by mood, notes, and intensity
 * Displays as a horizontal filter bar with pill buttons
 */
import React, { useState } from 'react';
import { Filter, X, Sparkles } from 'lucide-react';
import { fragranceFilters } from '../services/productService';
import { useTheme } from '../context/ThemeContext';

const FragranceFilter = ({ onFilterChange, activeFilters = {} }) => {
  const { isDarkMode } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  
  const handleFilterToggle = (category, filterId) => {
    const currentFilters = activeFilters[category] || [];
    let newFilters;
    
    if (currentFilters.includes(filterId)) {
      newFilters = currentFilters.filter(f => f !== filterId);
    } else {
      newFilters = [...currentFilters, filterId];
    }
    
    onFilterChange({
      ...activeFilters,
      [category]: newFilters
    });
  };
  
  const clearAllFilters = () => {
    onFilterChange({});
  };
  
  const hasActiveFilters = Object.values(activeFilters).some(arr => arr?.length > 0);
  const activeCount = Object.values(activeFilters).reduce((sum, arr) => sum + (arr?.length || 0), 0);

  return (
    <div 
      className="mb-8 rounded-2xl overflow-hidden transition-all duration-300"
      style={{ 
        backgroundColor: isDarkMode ? 'rgba(26, 35, 50, 0.8)' : 'rgba(255, 255, 255, 0.9)',
        border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(30, 58, 82, 0.1)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)'
      }}
      data-testid="fragrance-filter"
    >
      {/* Filter Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-5 py-4 flex items-center justify-between hover:opacity-90 transition-opacity"
        data-testid="filter-toggle-btn"
      >
        <div className="flex items-center gap-3">
          <div 
            className="p-2 rounded-lg"
            style={{ backgroundColor: 'var(--metallic-gold)', color: 'white' }}
          >
            <Sparkles size={18} />
          </div>
          <div className="text-left">
            <h3 
              className="font-semibold text-base"
              style={{ color: 'var(--japanese-indigo)' }}
            >
              Find Your Perfect Fragrance
            </h3>
            <p 
              className="text-sm"
              style={{ color: 'var(--text-subtle)' }}
            >
              Filter by mood, scent notes, or intensity
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {hasActiveFilters && (
            <span 
              className="px-2 py-1 rounded-full text-xs font-bold"
              style={{ backgroundColor: 'var(--metallic-gold)', color: 'white' }}
            >
              {activeCount} active
            </span>
          )}
          <Filter 
            size={20} 
            className={`transform transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
            style={{ color: 'var(--metallic-gold)' }}
          />
        </div>
      </button>
      
      {/* Expanded Filter Options */}
      <div 
        className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}
      >
        <div 
          className="px-5 pb-5 pt-2 space-y-5"
          style={{ borderTop: isDarkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(30, 58, 82, 0.1)' }}
        >
          {/* Mood Filters */}
          <div>
            <h4 
              className="text-sm font-semibold mb-3 flex items-center gap-2"
              style={{ color: 'var(--japanese-indigo)' }}
            >
              <span>🎭</span> By Mood
            </h4>
            <div className="flex flex-wrap gap-2">
              {fragranceFilters.moods.map(mood => {
                const isActive = activeFilters.mood?.includes(mood.id);
                return (
                  <button
                    key={mood.id}
                    onClick={() => handleFilterToggle('mood', mood.id)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                      isActive ? 'ring-2 ring-offset-2' : 'hover:scale-105'
                    }`}
                    style={{ 
                      backgroundColor: isActive ? 'var(--metallic-gold)' : (isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(30, 58, 82, 0.08)'),
                      color: isActive ? 'white' : 'var(--japanese-indigo)',
                      ringColor: 'var(--metallic-gold)'
                    }}
                    title={mood.description}
                    data-testid={`filter-mood-${mood.id}`}
                  >
                    <span>{mood.icon}</span>
                    <span>{mood.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          
          {/* Notes Filters */}
          <div>
            <h4 
              className="text-sm font-semibold mb-3 flex items-center gap-2"
              style={{ color: 'var(--japanese-indigo)' }}
            >
              <span>🎵</span> By Scent Notes
            </h4>
            <div className="flex flex-wrap gap-2">
              {fragranceFilters.notes.map(note => {
                const isActive = activeFilters.notes?.includes(note.id);
                return (
                  <button
                    key={note.id}
                    onClick={() => handleFilterToggle('notes', note.id)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                      isActive ? 'ring-2 ring-offset-2' : 'hover:scale-105'
                    }`}
                    style={{ 
                      backgroundColor: isActive ? 'var(--metallic-gold)' : (isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(30, 58, 82, 0.08)'),
                      color: isActive ? 'white' : 'var(--japanese-indigo)',
                      ringColor: 'var(--metallic-gold)'
                    }}
                    title={note.description}
                    data-testid={`filter-note-${note.id}`}
                  >
                    <span>{note.icon}</span>
                    <span>{note.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          
          {/* Intensity Filters */}
          <div>
            <h4 
              className="text-sm font-semibold mb-3 flex items-center gap-2"
              style={{ color: 'var(--japanese-indigo)' }}
            >
              <span>💨</span> By Intensity
            </h4>
            <div className="flex flex-wrap gap-2">
              {fragranceFilters.intensity.map(int => {
                const isActive = activeFilters.intensity?.includes(int.id);
                return (
                  <button
                    key={int.id}
                    onClick={() => handleFilterToggle('intensity', int.id)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                      isActive ? 'ring-2 ring-offset-2' : 'hover:scale-105'
                    }`}
                    style={{ 
                      backgroundColor: isActive ? 'var(--metallic-gold)' : (isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(30, 58, 82, 0.08)'),
                      color: isActive ? 'white' : 'var(--japanese-indigo)',
                      ringColor: 'var(--metallic-gold)'
                    }}
                    title={int.description}
                    data-testid={`filter-intensity-${int.id}`}
                  >
                    {int.label}
                  </button>
                );
              })}
            </div>
          </div>
          
          {/* Clear Filters */}
          {hasActiveFilters && (
            <div className="pt-2">
              <button
                onClick={clearAllFilters}
                className="flex items-center gap-2 text-sm font-medium hover:opacity-80 transition-opacity"
                style={{ color: 'var(--metallic-gold)' }}
                data-testid="clear-filters-btn"
              >
                <X size={16} />
                Clear all filters
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FragranceFilter;
