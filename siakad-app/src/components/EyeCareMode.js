'use client';

import { useState, useEffect, createContext, useContext } from 'react';

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

export default function EyeCareMode({ children }) {
  const [isEyeCare, setIsEyeCare] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('eyeCareMode');
    // Default to false (Light mode) if not set, or read from storage
    const isDark = saved === null ? false : saved === 'true';
    setIsEyeCare(isDark);
    
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleMode = () => {
    const newVal = !isEyeCare;
    setIsEyeCare(newVal);
    localStorage.setItem('eyeCareMode', newVal);
    
    if (newVal) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <ThemeContext.Provider value={{ isEyeCare, toggleMode, mounted }}>
      {children}
      {mounted && isEyeCare && (
        <div 
          className="fixed inset-0 z-[9998] pointer-events-none transition-all duration-700 ease-in-out" 
          style={{ 
            backgroundColor: 'rgba(255, 170, 0, 0.03)',
            mixBlendMode: 'multiply',
          }} 
        />
      )}
    </ThemeContext.Provider>
  );
}
