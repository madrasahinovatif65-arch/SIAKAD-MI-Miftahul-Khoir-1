'use client';

import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useTheme } from '@/components/EyeCareMode';
import useSWR from 'swr';
import { supabase } from '@/lib/supabase';

const NAV_CONFIG = {
  Admin: [
    { label: 'Dashboard', href: '/dashboard', icon: 'M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0[...]
    { label: 'Buat Pengumuman', href: '/dashboard/admin/pengumuman', icon: 'M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 1 1 0-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.[...]
    { label: 'Presensi', href: '/dashboard/presensi', icon: 'M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 [...]
    { label: 'Jurnal Guru', href: '/dashboard/jurnal', icon: 'M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966[...]
    { label: 'Jadwal Pelajaran', href: '/dashboard/jadwal', icon: 'M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c[...]
    { label: 'Rekapitulasi', href: '/dashboard/rekap', icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.[...]
    { label: 'Riwayat Absen', href: '/dashboard/riwayat-guru', icon: 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z' },
    { label: 'Kelola Pengguna', href: '/dashboard/users', icon: 'M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.[...]
    { label: 'Kelola Mapel', href: '/dashboard/mapel', icon: 'M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966[...]
    { label: 'Pengaturan', href: '/dashboard/pengaturan', icon: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.[...]
    { label: 'Kalender Akademik', href: '/dashboard/kalender', icon: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 2[...]
    { label: 'Pusat Backup', href: '/dashboard/backup', icon: 'M20.25 7.5l-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.12[...]
    { label: 'Bank Soal Kognitif', href: '/dashboard/bank-soal', icon: 'M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45[...]
    { label: 'Bank Soal', href: '/dashboard/bank-soal-sumatif', icon: 'M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45[...]
  ],
  'Kepala Madrasah': [
    { label: 'Dashboard', href: '/dashboard', icon: 'M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0[...]
    { label: 'Buat Pengumuman', href: '/dashboard/admin/pengumuman', icon: 'M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 1 1 0-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.[...]
    { label: 'Verifikasi Guru', href: '/dashboard/verifikasi', icon: 'M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z' },
    { label: 'Rekap Jurnal Guru', href: '/dashboard/jurnal', icon: 'M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966[...]
    { label: 'Rekap Absen Guru', href: '/dashboard/riwayat-guru', icon: 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z' },
    { label: 'Bank Soal', href: '/dashboard/bank-soal-sumatif', icon: 'M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45[...]
  ],
  'Wali Kelas': [
    { label: 'Dashboard', href: '/dashboard', icon: 'M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0[...]
    { label: 'Presensi', href: '/dashboard/presensi', icon: 'M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 [...]
    { label: 'Asesmen', href: '/dashboard/asesmen', icon: 'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.8[...]
    { label: 'Rekapitulasi', href: '/dashboard/rekap', icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.[...]
    { label: 'Jurnal Guru', href: '/dashboard/jurnal', icon: 'M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966[...]
    { label: 'Jadwal Pelajaran', href: '/dashboard/jadwal', icon: 'M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c[...]
    { label: 'Riwayat Absen', href: '/dashboard/riwayat-guru', icon: 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z' },
    { label: 'Bank Soal', href: '/dashboard/bank-soal-sumatif', icon: 'M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45[...]
  ],
  'Guru Mapel': [
    { label: 'Dashboard', href: '/dashboard', icon: 'M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0[...]
    { label: 'Jurnal Guru', href: '/dashboard/jurnal', icon: 'M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966[...]
    { label: 'Asesmen', href: '/dashboard/asesmen', icon: 'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.8[...]
    { label: 'Jadwal Pelajaran', href: '/dashboard/jadwal', icon: 'M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c[...]
    { label: 'Rekapitulasi', href: '/dashboard/rekap', icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.[...]
    { label: 'Riwayat Absen', href: '/dashboard/riwayat-guru', icon: 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z' },
    { label: 'Bank Soal', href: '/dashboard/bank-soal-sumatif', icon: 'M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45[...]
  ],
  Murid: [
    { label: 'Dashboard', href: '/dashboard', icon: 'M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0[...]
    { label: 'Riwayat Absen', href: '/dashboard/riwayat-murid', icon: 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z' },
    { label: 'Asesmen', href: '/dashboard/asesmen-kognitif', icon: 'M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.8[...]
    { label: 'Perkembangan Saya', href: '/dashboard/asesmen', icon: 'M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941' },
    { label: 'Taman Ilmu', href: '/dashboard/eperpus', icon: 'M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966[...]
  ],
};

function NavIcon({ d }) {
  return (
    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

export default function Sidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const { isEyeCare, toggleMode } = useTheme();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { data: unreadCount = 0 } = useSWR(
    user ? `notif_unread_${user.id_user}_${user.role}` : null,
    async () => {
      const { count } = await supabase
        .from('notifikasi')
        .select('id', { count: 'exact', head: true })
        .or(`id_user.eq.${user.id_user},and(id_user.is.null,role_target.eq.${user.role}),and(id_user.is.null,role_target.eq.Umum)`)
        .eq('is_read', false);
      return count || 0;
    },
    { refreshInterval: 30000 }
  );

  if (!user) return null;

  const navItems = NAV_CONFIG[user.role] || [];

  return (
    <aside className={`hidden lg:flex flex-col sticky top-0 h-screen transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-72'} bg-white bg-gradient-to-b from-white via-emerald-50 to-teal-50 dar[...]
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-full p-1.5 shadow-md text-slate-500 hover:text-emerald-500 dark:text-slat[...]
      >
        {isCollapsed ? (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        )}
      </button>

      <div className={`p-6 border-b border-slate-200 dark:border-white/10 flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-4'} transition-all duration-300`}>
        <div className="w-12 h-12 flex items-center justify-center shrink-0 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-white/5">
          <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain drop-shadow-[0_0_8px_rgba(52,211,148,0.5)]" />
        </div>
        {!isCollapsed && (
          <div className="flex-1 min-w-0 transition-opacity duration-300">
            <p className="text-slate-900 dark:text-white font-bold truncate text-sm">{user.nama}</p>
            <p className="text-emerald-600 dark:text-emerald-400 font-medium text-[11px] uppercase tracking-wider mt-0.5">{user.role}</p>
            {user.rombel && user.rombel !== '-' && <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">{user.rombel}</p>}
          </div>
        )}
      </div>
      
      <nav className={`flex-1 ${isCollapsed ? 'px-2' : 'px-4'} py-6 space-y-1.5 overflow-y-auto hide-scrollbar transition-all`}>
        {navItems.map(item => {
          const isActive = pathname === item.href;
          return (
            <Link key={item.href} href={item.href}
              title={isCollapsed ? item.label : ''}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center p-3.5' : 'gap-3 px-4 py-3.5'} rounded-2xl text-sm font-semibold transition-all duration-200 ${
                isActive ? 'bg-emerald-500 text-white shadow-[0_4px_15px_rgba(16,185,129,0.3)]' : 'text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-e[...]
              }`}>
              <NavIcon d={item.icon} />
              {!isCollapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>
      
      <div className={`p-4 border-t border-slate-200 dark:border-white/10 space-y-1.5 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md ${isCollapsed ? 'px-2' : ''}`}>
        
        <Link href="/dashboard/notifikasi"
          title={isCollapsed ? 'Notifikasi' : ''}
          className={`w-full flex items-center ${isCollapsed ? 'justify-center p-3.5 relative' : 'justify-between px-4 py-3.5'} rounded-2xl text-sm font-semibold transition-all duration-200 ${
            pathname === '/dashboard/notifikasi' ? 'bg-emerald-500 text-white shadow-[0_4px_15px_rgba(16,185,129,0.3)]' : 'text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:tex[...]
          }`}>
          <div className="flex items-center gap-3">
            <NavIcon d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255[...]
            {!isCollapsed && <span>Notifikasi</span>}
          </div>
          {unreadCount > 0 && (
            isCollapsed ? (
              <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white dark:border-slate-800" />
            ) : (
              <span className="min-w-[20px] h-[20px] px-1 bg-rose-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )
          )}
        </Link>

        <button onClick={toggleMode}
          title={isCollapsed ? (isEyeCare ? 'Mode Terang' : 'Mode Gelap') : ''}
          className={`w-full flex items-center ${isCollapsed ? 'justify-center p-3.5' : 'gap-3 px-4 py-3.5'} rounded-2xl text-sm font-semibold transition-all duration-200 text-slate-600 dark:text[...]
          {isEyeCare ? (
            <NavIcon d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 [...]
          ) : (
            <NavIcon d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.0[...]
          )}
          {!isCollapsed && <span>{isEyeCare ? 'Mode Terang' : 'Mode Gelap'}</span>}
        </button>

        <Link href="/dashboard/profil"
          title={isCollapsed ? 'Profil Saya' : ''}
          className={`w-full flex items-center ${isCollapsed ? 'justify-center p-3.5' : 'gap-3 px-4 py-3.5'} rounded-2xl text-sm font-semibold transition-all duration-200 ${
            pathname === '/dashboard/profil' ? 'bg-emerald-500 text-white shadow-[0_4px_15px_rgba(16,185,129,0.3)]' : 'text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-em[...]
          }`}>
          <NavIcon d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
          {!isCollapsed && <span>Profil Saya</span>}
        </Link>

        <button onClick={() => { logout(); }}
          title={isCollapsed ? 'Keluar' : ''}
          className={`w-full flex items-center ${isCollapsed ? 'justify-center p-3.5' : 'gap-3 px-4 py-3.5'} rounded-2xl text-sm font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700[...]
          <NavIcon d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
          {!isCollapsed && <span>Keluar</span>}
        </button>
      </div>
    </aside>
  );
}
