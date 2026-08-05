'use client';

import { AuthProvider, useAuth } from '@/context/AuthContext';
import LoginPage from '@/components/LoginPage';
import Sidebar from '@/components/Sidebar';
import PresensiPage from '@/components/PresensiPage';
import JurnalPage from '@/components/JurnalPage';
import AbsenGPSPage from '@/components/AbsenGPSPage';
import VerifikasiPage from '@/components/VerifikasiPage';
import RiwayatGuruPage from '@/components/RiwayatGuruPage';
import RiwayatMuridPage from '@/components/RiwayatMuridPage';
import LiburPage from '@/components/LiburPage';
import ProfilPage from '@/components/ProfilPage';
import EPerpusPage from '@/components/EPerpusPage';
import RekapPage from '@/components/RekapPage';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

// ============================================================================
// PAGE ROUTER - SPA routing tanpa full page reload
// ============================================================================
const PAGES = {
  dashboard: { component: DashboardHome, label: 'Dashboard' },
  presensi: { component: PresensiPage, label: 'Presensi' },
  jurnal: { component: JurnalPage, label: 'Jurnal Guru' },
  'absen-gps': { component: AbsenGPSPage, label: 'Absen GPS' },
  verifikasi: { component: VerifikasiPage, label: 'Verifikasi' },
  'riwayat-guru': { component: RiwayatGuruPage, label: 'Riwayat Guru' },
  'riwayat-murid': { component: RiwayatMuridPage, label: 'Riwayat Murid' },
  libur: { component: LiburPage, label: 'Kelola Libur' },
  eperpus: { component: EPerpusPage, label: 'E-Perpus' },
  rekap: { component: RekapPage, label: 'Rekapitulasi' },
  profil: { component: ProfilPage, label: 'Profil Saya' },
};

// ============================================================================
// SIDEBAR NAVIGATION CONFIG (override Sidebar.js href-based nav)
// ============================================================================
const NAV_CONFIG = {
  Admin: [
    { label: 'Dashboard', page: 'dashboard', icon: 'M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z' },
    { label: 'Verifikasi Guru', page: 'verifikasi', icon: 'M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z' },
    { label: 'Riwayat Guru', page: 'riwayat-guru', icon: 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z' },
    { label: 'Kelola Libur', page: 'libur', icon: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5' },
    { label: 'Rekapitulasi', page: 'rekap', icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z' },
    { label: 'Jurnal Guru', page: 'jurnal', icon: 'M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25' },
    { label: 'E-Perpus', page: 'eperpus', icon: 'M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25' },
  ],
  'Wali Kelas': [
    { label: 'Dashboard', page: 'dashboard', icon: 'M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z' },
    { label: 'Presensi', page: 'presensi', icon: 'M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0 1 18 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3 1.5 1.5 3-3.75' },
    { label: 'Rekapitulasi', page: 'rekap', icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z' },
    { label: 'Jurnal Guru', page: 'jurnal', icon: 'M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25' },
    { label: 'Absen GPS', page: 'absen-gps', icon: 'M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z' },
    { label: 'Riwayat Absen', page: 'riwayat-guru', icon: 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z' },
    { label: 'E-Perpus', page: 'eperpus', icon: 'M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25' },
  ],
  'Guru Mapel': [
    { label: 'Dashboard', page: 'dashboard', icon: 'M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z' },
    { label: 'Jurnal Guru', page: 'jurnal', icon: 'M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25' },
    { label: 'Absen GPS', page: 'absen-gps', icon: 'M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z' },
    { label: 'Riwayat Absen', page: 'riwayat-guru', icon: 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z' },
    { label: 'E-Perpus', page: 'eperpus', icon: 'M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25' },
  ],
  Murid: [
    { label: 'Dashboard', page: 'dashboard', icon: 'M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z' },
    { label: 'Riwayat Absen', page: 'riwayat-murid', icon: 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z' },
    { label: 'E-Perpus', page: 'eperpus', icon: 'M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25' },
  ],
};

function NavIcon({ d }) {
  return (
    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

// ============================================================================
// INLINE SIDEBAR (replaces Sidebar.js with page-based navigation)
// ============================================================================
function InlineSidebar({ isOpen, onClose, currentPage, onNavigate }) {
  const { user, logout } = useAuth();
  if (!user) return null;
  const navItems = NAV_CONFIG[user.role] || [];

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" onClick={onClose} />
      )}
      <aside className={`fixed top-0 left-0 h-full w-72 z-50 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-r border-white/5 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:z-auto ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-blue-500/20">
              {user.nama?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold truncate text-sm">{user.nama}</p>
              <p className="text-blue-300/60 text-xs">{user.role}</p>
              {user.rombel && user.rombel !== '-' && <p className="text-blue-300/40 text-xs">{user.rombel}</p>}
            </div>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(item => (
            <button key={item.page} onClick={() => { onNavigate(item.page); onClose(); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                currentPage === item.page ? 'bg-blue-500/15 text-blue-300 shadow-inner' : 'text-white/50 hover:text-white/80 hover:bg-white/5'
              }`}>
              <NavIcon d={item.icon} />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-white/5 space-y-1">
          <button onClick={() => { onNavigate('profil'); onClose(); }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-white/50 hover:text-white/80 hover:bg-white/5 transition-all">
            <NavIcon d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            Profil Saya
          </button>
          <button onClick={() => { logout(); onClose(); }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-all">
            <NavIcon d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
            Keluar
          </button>
        </div>
      </aside>
    </>
  );
}

// ============================================================================
// APP SHELL
// ============================================================================
function AppShell() {
  const { user, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-white/40 text-sm">Memuat aplikasi...</p>
        </div>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  const PageComponent = PAGES[currentPage]?.component || DashboardHome;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      <InlineSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        currentPage={currentPage}
        onNavigate={setCurrentPage}
      />
      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-30 lg:hidden bg-slate-900/80 backdrop-blur-xl border-b border-white/5 px-4 py-3">
          <div className="flex items-center justify-between">
            <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-white/5 transition-colors">
              <svg className="w-6 h-6 text-white/70" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
            <h1 className="text-sm font-semibold text-white/80">{PAGES[currentPage]?.label || 'SIAKAD'}</h1>
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-sm">
              {user.nama?.charAt(0)?.toUpperCase() || '?'}
            </div>
          </div>
        </header>
        <div className="p-6 lg:p-8">
          <PageComponent />
        </div>
      </main>
    </div>
  );
}

// ============================================================================
// DASHBOARD HOME
// ============================================================================
function DashboardHome() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ guru: '-', murid: '-', pending: '-', jurnal: '-' });
  const [muridStats, setMuridStats] = useState({ hadir: 0, izin: 0, sakit: 0, alpa: 0, persentase: 0 });
  const [chartData, setChartData] = useState(null);

  useEffect(() => {
    async function fetchStats() {
      const today = new Date().toISOString().split('T')[0];
      const monthStart = today.slice(0, 7) + '-01';

      if (user.role === 'Murid') {
        const { data: absenMurid } = await supabase
          .from('data_absensi')
          .select('status')
          .eq('nisn', user.id_user);
          
        if (absenMurid) {
          let h = 0, i = 0, s = 0, a = 0;
          absenMurid.forEach(ab => {
            if (ab.status === 'Hadir') h++;
            else if (ab.status === 'Izin') i++;
            else if (ab.status === 'Sakit') s++;
            else if (ab.status === 'Alpa') a++;
          });
          const total = h + i + s + a;
          const pct = total > 0 ? Math.round((h / total) * 100) : 0;
          setMuridStats({ hadir: h, izin: i, sakit: s, alpa: a, persentase: pct });
        }
      } else {
        const [guruRes, muridRes, pendingRes, jurnalRes] = await Promise.all([
          supabase.from('master_user').select('id', { count: 'exact', head: true }).in('role', ['Wali Kelas', 'Guru Mapel']).eq('status_aktif', 'Aktif'),
          supabase.from('master_murid').select('id', { count: 'exact', head: true }).eq('status', 'Aktif'),
          supabase.from('log_gps_guru').select('id', { count: 'exact', head: true }).eq('tanggal', today).eq('status', 'Menunggu Verifikasi'),
          supabase.from('jurnal_guru').select('id', { count: 'exact', head: true }).gte('tanggal', monthStart).eq('id_guru', user.id_user),
        ]);

        setStats({
          guru: guruRes.count ?? '-',
          murid: muridRes.count ?? '-',
          pending: pendingRes.count ?? '-',
          jurnal: jurnalRes.count ?? '-',
        });

        // Admin charts logic
        if (user.role === 'Admin') {
          const { data: todayAbsen } = await supabase.from('data_absensi').select('status').eq('tanggal', today);
          let th = 0, ti = 0, ts = 0, ta = 0;
          (todayAbsen || []).forEach(ab => {
            if (ab.status === 'Hadir') th++;
            else if (ab.status === 'Izin') ti++;
            else if (ab.status === 'Sakit') ts++;
            else if (ab.status === 'Alpa') ta++;
          });

          // Generate last 7 days
          const dates = [];
          for (let i=6; i>=0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            dates.push(d.toISOString().split('T')[0]);
          }

          const { data: weekAbsen } = await supabase.from('data_absensi').select('tanggal, status').in('tanggal', dates);
          const barData = dates.map(d => {
            return (weekAbsen || []).filter(a => a.tanggal === d && a.status === 'Hadir').length;
          });

          setChartData({
            doughnut: {
              labels: ['Hadir', 'Izin', 'Sakit', 'Alpa'],
              datasets: [{
                data: [th, ti, ts, ta],
                backgroundColor: ['#10b981', '#f59e0b', '#ef4444', '#6b7280'],
                borderWidth: 0,
              }]
            },
            bar: {
              labels: dates.map(d => d.slice(5)),
              datasets: [{
                label: 'Hadir',
                data: barData,
                backgroundColor: '#3b82f6',
                borderRadius: 4,
              }]
            }
          });
        }
      }
    }
    fetchStats();
  }, [user]);

  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const cardsConfig = {
    Admin: [
      { label: 'Total Guru', value: stats.guru, sub: 'Aktif', gradient: 'from-emerald-600/20 to-emerald-800/20' },
      { label: 'Total Murid', value: stats.murid, sub: 'Aktif', gradient: 'from-amber-600/20 to-amber-800/20' },
      { label: 'Perlu Verifikasi', value: stats.pending, sub: 'Hari ini', gradient: 'from-red-600/20 to-red-800/20' },
    ],
    'Wali Kelas': [
      { label: 'Jurnal Bulan Ini', value: stats.jurnal, sub: 'Entri', gradient: 'from-emerald-600/20 to-emerald-800/20' },
      { label: 'Total Murid', value: stats.murid, sub: 'Aktif', gradient: 'from-amber-600/20 to-amber-800/20' },
    ],
    'Guru Mapel': [
      { label: 'Jurnal Bulan Ini', value: stats.jurnal, sub: 'Entri', gradient: 'from-emerald-600/20 to-emerald-800/20' },
    ],
    Murid: [
      { label: 'Wali Kelas', value: user.wali_kelas || '-', sub: user.rombel, gradient: 'from-emerald-600/20 to-emerald-800/20' },
    ],
  };

  const cards = [
    { label: 'Hari Ini', value: new Date().getDate(), sub: new Date().toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }), gradient: 'from-blue-600/20 to-blue-800/20' },
    ...(cardsConfig[user.role] || []),
  ];

  return (
    <div className="space-y-8">
      <div>
        {user.role === 'Murid' ? (
          <div className="bg-gradient-to-r from-emerald-900/50 to-teal-900/50 p-6 rounded-2xl border border-emerald-500/20 mb-6">
            <h2 className="text-2xl lg:text-3xl font-bold text-white mb-2">
              Assalamu&apos;alaikum, <span className="text-emerald-400">{user.nama}</span>
            </h2>
            <p className="text-emerald-200/70 italic text-sm">"Menuntut ilmu adalah taqwa. Menyampaikannya adalah ibadah. Mengulang-ulangnya adalah zikir. Mencari-carinya adalah jihad." - Imam Al-Ghazali</p>
          </div>
        ) : (
          <>
            <h2 className="text-2xl lg:text-3xl font-bold text-white">
              Assalamu&apos;alaikum, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">{user.nama}</span> 👋
            </h2>
            <p className="text-white/40 mt-1">{today}</p>
          </>
        )}
      </div>
      
      {user.role === 'Murid' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 bg-white/5 border border-white/5 rounded-2xl p-6 text-center">
            <div className="w-24 h-24 mx-auto bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-4xl font-bold mb-4 shadow-lg shadow-blue-500/20">
              {muridStats.persentase}%
            </div>
            <h3 className="text-white font-semibold">Tingkat Kehadiran</h3>
            <p className="text-white/50 text-sm mt-1">Total {muridStats.hadir + muridStats.izin + muridStats.sakit + muridStats.alpa} hari efektif</p>
          </div>
          
          <div className="md:col-span-2 grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center">
              <p className="text-emerald-400 text-3xl font-bold">{muridStats.hadir}</p>
              <p className="text-white/60 text-xs uppercase tracking-wider mt-1">Hadir</p>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-center">
              <p className="text-amber-400 text-3xl font-bold">{muridStats.izin}</p>
              <p className="text-white/60 text-xs uppercase tracking-wider mt-1">Izin</p>
            </div>
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
              <p className="text-red-400 text-3xl font-bold">{muridStats.sakit}</p>
              <p className="text-white/60 text-xs uppercase tracking-wider mt-1">Sakit</p>
            </div>
            <div className="bg-slate-500/10 border border-slate-500/20 rounded-xl p-4 text-center">
              <p className="text-slate-400 text-3xl font-bold">{muridStats.alpa}</p>
              <p className="text-white/60 text-xs uppercase tracking-wider mt-1">Alpa</p>
            </div>
            
            <div className="col-span-2 lg:col-span-4 bg-white/5 border border-white/5 rounded-xl p-5 mt-2">
              <h4 className="text-white/70 text-sm font-semibold mb-3">Informasi Akademik</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-white/40">NISN</p>
                  <p className="text-white font-medium">{user.id_user}</p>
                </div>
                <div>
                  <p className="text-white/40">Kelas</p>
                  <p className="text-white font-medium">{user.rombel}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-white/40">Wali Kelas</p>
                  <p className="text-white font-medium">{user.wali_kelas || '-'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((card, idx) => (
          <div key={idx} className={`relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br ${card.gradient} border border-white/5 shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-300`}>
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-8 -mt-8" />
            <div className="relative z-10">
              <p className="text-white/60 text-xs font-medium uppercase tracking-wider">{card.label}</p>
              <p className="text-3xl font-bold text-white mt-2">{card.value}</p>
              <p className="text-white/40 text-xs mt-1">{card.sub}</p>
            </div>
          </div>
        ))}
      </div>
      )}

      {user.role === 'Admin' && chartData && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white/5 border border-white/5 rounded-2xl p-6 lg:col-span-2">
            <h3 className="text-white font-semibold text-sm mb-4">Tren Kehadiran (7 Hari)</h3>
            <div className="h-64">
              <Bar 
                data={chartData.bar} 
                options={{ maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } }, x: { grid: { display: false } } } }} 
              />
            </div>
          </div>
          <div className="bg-white/5 border border-white/5 rounded-2xl p-6">
            <h3 className="text-white font-semibold text-sm mb-4">Proporsi Kehadiran Hari Ini</h3>
            <div className="h-48 flex justify-center">
              <Doughnut 
                data={chartData.doughnut} 
                options={{ maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#fff' } } }, cutout: '70%' }} 
              />
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-white/5 border border-white/5 p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
            </svg>
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm">SIAKAD v2.0 — Powered by Supabase</h3>
            <p className="text-white/40 text-sm mt-1">
              Aplikasi ini menggunakan cloud database PostgreSQL (Supabase) untuk performa maksimal. 
              Data disinkronisasi otomatis ke Google Sheets sebagai cadangan.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN EXPORT
// ============================================================================
export default function Home() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
