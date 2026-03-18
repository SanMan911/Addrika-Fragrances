import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const DarkModeToggle = ({ className = '' }) => {
  const { isDarkMode, toggleDarkMode } = useTheme();

  return (
    <button
      onClick={toggleDarkMode}
      className={`relative p-2 rounded-full transition-all duration-300 hover:bg-gray-100 dark:hover:bg-gray-700 ${className}`}
      aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
      data-testid="dark-mode-toggle"
      title={isDarkMode ? 'Light Mode' : 'Dark Mode'}
    >
      <div className="relative w-5 h-5">
        {/* Sun icon - visible in dark mode */}
        <Sun 
          size={20} 
          className={`absolute inset-0 transition-all duration-300 ${
            isDarkMode 
              ? 'opacity-100 rotate-0 scale-100' 
              : 'opacity-0 rotate-90 scale-0'
          }`}
          style={{ color: 'var(--metallic-gold)' }}
        />
        {/* Moon icon - visible in light mode */}
        <Moon 
          size={20} 
          className={`absolute inset-0 transition-all duration-300 ${
            isDarkMode 
              ? 'opacity-0 -rotate-90 scale-0' 
              : 'opacity-100 rotate-0 scale-100'
          }`}
          style={{ color: 'var(--japanese-indigo)' }}
        />
      </div>
    </button>
  );
};

export default DarkModeToggle;
