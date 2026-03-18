/**
 * ScentPyramid - Displays the fragrance notes pyramid
 * Top Notes -> Heart Notes -> Base Notes
 */
import React from 'react';
import { useTheme } from '../context/ThemeContext';

const ScentPyramid = ({ scentPyramid }) => {
  const { isDarkMode } = useTheme();
  
  if (!scentPyramid) return null;
  
  const { top, heart, base } = scentPyramid;
  
  const NoteRow = ({ label, notes, icon, color, delay }) => (
    <div 
      className="flex items-start gap-3 animate-fade-in"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div 
        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-lg"
        style={{ 
          backgroundColor: `${color}20`,
          border: `2px solid ${color}`
        }}
      >
        {icon}
      </div>
      <div className="flex-1">
        <h4 
          className="text-xs font-bold uppercase tracking-wider mb-1"
          style={{ color }}
        >
          {label}
        </h4>
        <div className="flex flex-wrap gap-1.5">
          {notes.map((note, idx) => (
            <span 
              key={idx}
              className="px-2.5 py-1 rounded-full text-xs font-medium"
              style={{ 
                backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(30, 58, 82, 0.08)',
                color: 'var(--japanese-indigo)'
              }}
            >
              {note}
            </span>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div 
      className="rounded-xl p-5 space-y-4"
      style={{ 
        backgroundColor: isDarkMode ? 'rgba(26, 35, 50, 0.5)' : 'rgba(248, 246, 243, 0.8)',
        border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(30, 58, 82, 0.1)'
      }}
      data-testid="scent-pyramid"
    >
      <h3 
        className="text-sm font-bold uppercase tracking-wider flex items-center gap-2"
        style={{ color: 'var(--metallic-gold)' }}
      >
        <span>🔺</span> Scent Journey
      </h3>
      
      <div className="space-y-4">
        {/* Top Notes - First impression, evaporate quickly */}
        <NoteRow 
          label="Top Notes" 
          notes={top} 
          icon="🌟"
          color="#FFD700"
          delay={0}
        />
        
        {/* Heart Notes - The core of the fragrance */}
        <NoteRow 
          label="Heart Notes" 
          notes={heart} 
          icon="💗"
          color="#E91E63"
          delay={100}
        />
        
        {/* Base Notes - Long lasting foundation */}
        <NoteRow 
          label="Base Notes" 
          notes={base} 
          icon="🪨"
          color="#795548"
          delay={200}
        />
      </div>
      
      <p 
        className="text-xs pt-2"
        style={{ 
          color: 'var(--text-subtle)',
          borderTop: isDarkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(30, 58, 82, 0.1)'
        }}
      >
        <strong>Tip:</strong> Top notes greet you first, heart notes emerge as it burns, and base notes linger longest.
      </p>
    </div>
  );
};

export default ScentPyramid;
