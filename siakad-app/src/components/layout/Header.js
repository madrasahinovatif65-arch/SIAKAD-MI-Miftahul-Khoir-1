'use client';

import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/components/EyeCareMode';

export default function Header() {
  const { user } = useAuth();
  const { isEyeCare, toggleMode, mounted } = useTheme();

  // Helper to get initials
  const getInitials = (name) => {
    if (!name) return 'MI';
    const parts = name.split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <header className="sticky top-0 z-30 md:hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-white/10 px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between">
        {/* Kiri: Foto Profil User atau Inisial */}
        <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-emerald-500/30 flex items-center justify-center bg-slate-100 dark:bg-slate-800 shadow-sm flex-shrink-0">
          {user?.foto ? (
            <img src={user.foto} alt="Profil" className="w-full h-full object-cover" />
          ) : (
            <span className="text-emerald-700 dark:text-emerald-400 font-bold text-sm">
              {getInitials(user?.nama)}
            </span>
          )}
        </div>
        
        {/* Tengah: Logo dan Nama */}
        <div className="flex items-center gap-2 justify-center absolute left-1/2 -translate-x-1/2">
          <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain drop-shadow-[0_0_5px_rgba(52,211,148,0.5)]" />
          <h1 className="text-base font-bold text-slate-800 dark:text-white tracking-tight">INOVATIF+</h1>
        </div>
        
        {/* Kanan: Theme Toggle */}
        <div className="flex-shrink-0">
          {mounted && (
            <button
              onClick={toggleMode}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-amber-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shadow-sm"
              title={isEyeCare ? "Matikan Mode Gelap" : "Aktifkan Mode Gelap"}
            >
              {isEyeCare ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18.75a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-1.5a.75.75 0 01.75-.75zM6.166 17.834a.75.75 0 001.06 1.06l1.591-1.59a.75.75 0 10-1.06-1.061l-1.591 1.59zM4.5 12a.75.75 0 01-.75.75H1.5a.75.75 0 010-1.5h2.25a.75.75 0 01.75.75zM6.166 6.166a.75.75 0 00-1.06 1.06l1.59 1.591a.75.75 0 101.061-1.06l-1.59-1.591z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
