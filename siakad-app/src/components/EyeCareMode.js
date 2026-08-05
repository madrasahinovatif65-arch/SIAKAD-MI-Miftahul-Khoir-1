'use client';

import { useState, useEffect } from 'react';

export default function EyeCareMode({ children }) {
  const [isEyeCare, setIsEyeCare] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('eyeCareMode');
    // Default to true (Dark mode / Eye care) if not set, or read from storage
    const isDark = saved === null ? true : saved === 'true';
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
    <>
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
      {mounted && (
        <button
          onClick={toggleMode}
          className="fixed bottom-6 right-6 z-[9999] p-3 rounded-full bg-slate-800/80 backdrop-blur-md border border-slate-300 dark:border-white/10 text-slate-700 dark:text-white/70 hover:text-slate-900 dark:text-white hover:bg-slate-700/80 transition-all shadow-lg"
          title={isEyeCare ? "Matikan Eye Care Mode" : "Aktifkan Eye Care Mode (Blue Light Filter)"}
        >
          {isEyeCare ? (
            <svg className="w-6 h-6 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18.75a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-1.5a.75.75 0 01.75-.75zM6.166 17.834a.75.75 0 001.06 1.06l1.591-1.59a.75.75 0 10-1.06-1.061l-1.591 1.59zM4.5 12a.75.75 0 01-.75.75H1.5a.75.75 0 010-1.5h2.25a.75.75 0 01.75.75zM6.166 6.166a.75.75 0 00-1.06 1.06l1.59 1.591a.75.75 0 101.061-1.06l-1.59-1.591z" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
            </svg>
          )}
        </button>
      )}
    </>
  );
}
