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

  return (
    <nav className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm z-50">
      <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl border border-white/40 dark:border-white/10 shadow-xl shadow-slate-200/50 dark:shadow-black/50 rounded-full px-6 py-3 flex items-center justify-between relative">
        
        {/* Akun */}
        <Link 
          href="/dashboard/profil"
          className={`flex flex-col items-center gap-1 transition-all duration-300 active:scale-95 ${
            isProfilActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400 hover:text-emerald-500'
          }`}
        >
          <div className="relative">
            <NavIcon d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" className={isProfilActive ? 'w-6 h-6 stroke-[2.5px]' : 'w-6 h-6'} />
            {isProfilActive && <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />}
          </div>
          <span className="text-[10px] font-semibold tracking-wide">Akun</span>
        </Link>

        {/* Beranda (Tengah, Highlighted, Mengambang) */}
        <div className="relative -top-5">
          <Link 
            href="/dashboard"
            className="flex flex-col items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 dark:from-emerald-600 dark:to-teal-700 shadow-lg shadow-emerald-500/30 text-white hover:scale-105 active:scale-95 transition-all duration-300 border-[3px] border-slate-50 dark:border-slate-950"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M11.47 3.84a.75.75 0 011.06 0l8.69 8.69a.75.75 0 101.06-1.06l-8.689-8.69a2.25 2.25 0 00-3.182 0l-8.69 8.69a.75.75 0 001.061 1.06l8.69-8.69z" />
              <path d="M12 5.432l8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 01-.75-.75v-4.5a.75.75 0 00-.75-.75h-3a.75.75 0 00-.75.75V21a.75.75 0 01-.75.75H5.625a1.875 1.875 0 01-1.875-1.875v-6.198a2.29 2.29 0 00.091-.086L12 5.43z" />
            </svg>
          </Link>
        </div>

        {/* Notifikasi */}
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
    </nav>
  );
}
