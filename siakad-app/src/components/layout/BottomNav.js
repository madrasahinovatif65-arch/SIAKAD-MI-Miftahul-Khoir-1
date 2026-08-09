'use client';

import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

function NavIcon({ d, className = "" }) {
  return (
    <svg className={`w-6 h-6 ${className}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

export default function BottomNav() {
  const { user } = useAuth();
  const pathname = usePathname();

  if (!user) return null;

  // Profil (Akun)
  const isProfilActive = pathname === '/dashboard/profil';
  // Beranda
  const isBerandaActive = pathname === '/dashboard';
  // Notifikasi
  const isNotifActive = pathname === '/dashboard/notifikasi';

  const showNav = isProfilActive || isBerandaActive || isNotifActive;
  if (!showNav) return null;

  // Helper to get initials
  const getInitials = (name) => {
    if (!name) return 'MI';
    const parts = name.split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <nav className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[92%] sm:w-[85%] md:w-[75%] max-w-2xl z-50">
      <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl border border-white/40 dark:border-white/10 shadow-xl shadow-slate-200/50 dark:shadow-black/50 rounded-full px-4 sm:px-10 py-2.5 grid grid-cols-3 items-center relative">
        
        {/* Akun */}
        <div className="flex justify-center w-full">
          <Link 
            href="/dashboard/profil"
            className={`flex flex-col items-center gap-1 transition-all duration-300 active:scale-95 ${
              isProfilActive ? 'opacity-100' : 'opacity-70 hover:opacity-100'
            }`}
          >
            <div className="relative">
              <div className={`w-7 h-7 rounded-full overflow-hidden flex items-center justify-center shadow-sm flex-shrink-0 transition-all ${
                isProfilActive ? 'border-2 border-emerald-500' : 'border-2 border-slate-200 dark:border-slate-700'
              } bg-slate-100 dark:bg-slate-800`}>
                {user?.foto ? (
                  <img src={user.foto} alt="Profil" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400">{getInitials(user?.nama)}</span>
                )}
              </div>
              {isProfilActive && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse border-2 border-white dark:border-slate-900" />}
            </div>
            <span className={`text-[10px] font-semibold tracking-wide ${isProfilActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>Profil</span>
          </Link>
        </div>

        {/* Beranda (Tengah, Highlighted, Mengambang) */}
        <div className="relative -top-6 flex justify-center w-full">
          <Link 
            href="/dashboard"
            className="flex flex-col items-center justify-center w-[60px] h-[60px] rounded-full bg-white dark:bg-slate-800 shadow-lg shadow-emerald-500/30 hover:scale-105 active:scale-95 transition-all duration-300 border-[4px] border-slate-50 dark:border-slate-950 flex-shrink-0"
          >
            <img src="/logo.png" alt="Dashboard" className="w-8 h-8 object-contain drop-shadow-[0_0_5px_rgba(52,211,148,0.5)]" />
          </Link>
        </div>

        {/* Notifikasi */}
        <div className="flex justify-center w-full">
          <Link 
            href="/dashboard/notifikasi"
            className={`flex flex-col items-center gap-1 transition-all duration-300 active:scale-95 ${
              isNotifActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400 hover:text-emerald-500'
            }`}
          >
            <div className="relative">
              <NavIcon d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" className={isNotifActive ? 'w-6 h-6 stroke-[2.5px]' : 'w-6 h-6'} />
              {/* Indikator unread dummy */}
              <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-rose-500 rounded-full border border-white dark:border-slate-900" />
            </div>
            <span className="text-[10px] font-semibold tracking-wide">Notifikasi</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}
