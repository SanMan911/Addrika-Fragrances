'use client';

import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext(null);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    // Return default during SSR
    return { isDarkMode: true, toggleDarkMode: () => {}, setDarkMode: () => {} };
  }
  return context;
}

export function ThemeProvider({ children }) {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check localStorage
    const saved = localStorage.getItem('addrika_dark_mode');
    if (saved !== null) {
      setIsDarkMode(saved === 'true');
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('addrika_dark_mode', isDarkMode.toString());
  }, [isDarkMode, mounted]);

  const toggleDarkMode = () => {
    setIsDarkMode(prev => !prev);
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleDarkMode, setDarkMode: setIsDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
}
