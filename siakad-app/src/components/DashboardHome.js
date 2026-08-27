'use client';

import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { getTodayDate } from '@/lib/dateUtils';
import useSWR from 'swr';
import Link from 'next/link';
import { useGeofenceReminder } from '@/hooks/useGeofenceReminder';
import AbsenGPSWidget from '@/components/AbsenGPSWidget';
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

const QUICK_MENU_CONFIG = {
  Admin: [
    { label: 'Presensi', href: '/dashboard/presensi', icon: 'M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0 1 18 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3 1.5 1.5 3-3.75', color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10' },
    { label: 'Jurnal', href: '/dashboard/jurnal', icon: 'M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25', color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' },
    { label: 'Jadwal', href: '/dashboard/jadwal', icon: 'M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0c0 .621.504 1.125 1.125 1.125h15M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c0 .621.504 1.125 1.125 1.125m0 1.5v-1.5m0 0c0-.621.504-1.125 1.125-1.125m-1.5 0h1.5', color: 'text-violet-500 bg-violet-50 dark:bg-violet-500/10' },
    { label: 'Rekap', href: '/dashboard/rekap', icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z', color: 'text-amber-500 bg-amber-50 dark:bg-amber-500/10' },
    { label: 'Riwayat Absen', href: '/dashboard/riwayat-guru', icon: 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z', color: 'text-slate-500 bg-slate-50 dark:bg-slate-500/10' },
    { label: 'Pengguna', href: '/dashboard/users', icon: 'M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z', color: 'text-blue-500 bg-blue-50 dark:bg-blue-500/10' },
    { label: 'Mapel', href: '/dashboard/mapel', icon: 'M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25', color: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-500/10' },
    { label: 'Pengaturan', href: '/dashboard/pengaturan', icon: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z', color: 'text-slate-500 bg-slate-50 dark:bg-slate-500/10' },
    { label: 'Kalender', href: '/dashboard/kalender', icon: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5', color: 'text-rose-500 bg-rose-50 dark:bg-rose-500/10' },
    { label: 'Pusat Backup', href: '/dashboard/backup', icon: 'M20.25 7.5l-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z', color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10' },
  ],
  'Kepala Madrasah': [
    { label: 'Verifikasi', href: '/dashboard/verifikasi', icon: 'M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z', color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10' },
    { label: 'Jurnal Guru', href: '/dashboard/jurnal', icon: 'M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25', color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' },
    { label: 'Riwayat Absen', href: '/dashboard/riwayat-guru', icon: 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z', color: 'text-slate-500 bg-slate-50 dark:bg-slate-500/10' },
  ],
  'Wali Kelas': [
    { label: 'Presensi', href: '/dashboard/presensi', icon: 'M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0 1 18 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3 1.5 1.5 3-3.75', color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10' },
    { label: 'Asesmen', href: '/dashboard/asesmen', icon: 'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z', color: 'text-violet-500 bg-violet-50 dark:bg-violet-500/10' },
    { label: 'Jurnal', href: '/dashboard/jurnal', icon: 'M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25', color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' },
    { label: 'Jadwal', href: '/dashboard/jadwal', icon: 'M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0c0 .621.504 1.125 1.125 1.125h15M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c0 .621.504 1.125 1.125 1.125m0 1.5v-1.5m0 0c0-.621.504-1.125 1.125-1.125m-1.5 0h1.5', color: 'text-violet-500 bg-violet-50 dark:bg-violet-500/10' },
    { label: 'Rekap', href: '/dashboard/rekap', icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z', color: 'text-amber-500 bg-amber-50 dark:bg-amber-500/10' },
    { label: 'Riwayat Absen', href: '/dashboard/riwayat-guru', icon: 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z', color: 'text-blue-500 bg-blue-50 dark:bg-blue-500/10' },
  ],
  'Guru Mapel': [
    { label: 'Jurnal', href: '/dashboard/jurnal', icon: 'M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25', color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' },
    { label: 'Asesmen', href: '/dashboard/asesmen', icon: 'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z', color: 'text-violet-500 bg-violet-50 dark:bg-violet-500/10' },
    { label: 'Jadwal', href: '/dashboard/jadwal', icon: 'M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0c0 .621.504 1.125 1.125 1.125h15M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c0 .621.504 1.125 1.125 1.125m0 1.5v-1.5m0 0c0-.621.504-1.125 1.125-1.125m-1.5 0h1.5', color: 'text-violet-500 bg-violet-50 dark:bg-violet-500/10' },
    { label: 'Rekap', href: '/dashboard/rekap', icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z', color: 'text-amber-500 bg-amber-50 dark:bg-amber-500/10' },
    { label: 'Riwayat Absen', href: '/dashboard/riwayat-guru', icon: 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z', color: 'text-blue-500 bg-blue-50 dark:bg-blue-500/10' },
  ],
  Murid: [
    { label: 'Riwayat', href: '/dashboard/riwayat-murid', icon: 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z', color: 'text-blue-500 bg-blue-50 dark:bg-blue-500/10' },
    { label: 'Tes Kognitif', href: '/dashboard/asesmen-kognitif', icon: 'M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z', color: 'text-violet-500 bg-violet-50 dark:bg-violet-500/10' },
    { label: 'Perkembangan', href: '/dashboard/asesmen', icon: 'M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941', color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' },
    { label: 'E-Perpus', href: '/dashboard/eperpus', icon: 'M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25', color: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-500/10' },
  ],
};

export default function DashboardHome() {
  const { user } = useAuth();

  // 📍 Geofence Reminder: secara otomatis memantau posisi GPS guru
  // dan mengirim pengingat absensi jika berada di area sekolah
  useGeofenceReminder(user);

  const { data } = useSWR(user ? `dashboard-stats-${user.id_user}` : null, async () => {
    const today = getTodayDate();
    const monthStart = today.slice(0, 7) + '-01';

    // 1. Ambil pengaturan sekolah untuk mendapatkan hari pertama tahun ajaran (berlaku untuk semua)
    const { data: pengaturanData } = await supabase.from('pengaturan_sekolah').select('tgl_mulai_efektif').limit(1).maybeSingle();
    const pengaturan = pengaturanData || {};
    let calcStart = pengaturan.tgl_mulai_efektif || monthStart;
    if (calcStart > today) calcStart = monthStart; // fallback jika tgl efektif di masa depan

    // Hitung Hari Efektif
    const { data: kalenderData } = await supabase.from('master_kalender').select('tanggal, tipe_hari').gte('tanggal', calcStart).lte('tanggal', today);
    const liburSet = new Set((kalenderData || []).filter(k => k.tipe_hari === 'Libur').map(k => k.tanggal));

    let hariEfektif = 0;
    const validDates = [];
    let curr = new Date(calcStart);
    const end = new Date(today);
    while (curr <= end) {
      if (curr.getDay() !== 0) { // Bukan Minggu
        const dateStr = curr.toISOString().split('T')[0];
        if (!liburSet.has(dateStr)) {
          hariEfektif++;
          validDates.push(dateStr);
        }
      }
      curr.setDate(curr.getDate() + 1);
    }

    if (user.role === 'Murid') {
      const { data: absenMurid } = await supabase
        .from('view_rekap_kehadiran_murid_final')
        .select('status, tanggal')
        .eq('id_murid', user.id_user)
        .gte('tanggal', calcStart)
        .lte('tanggal', today);

      let s = 0, i = 0, a = 0;
      (absenMurid || []).forEach(ab => {
        if (validDates.includes(ab.tanggal)) {
          if (ab.status === 'Sakit') s++;
          else if (ab.status === 'Izin') i++;
          else if (ab.status === 'Alfa' || ab.status === 'Alpa') a++;
        }
      });

      const h = Math.max(0, hariEfektif - (s + i + a));
      const pct = hariEfektif > 0 ? Math.round((h / hariEfektif) * 100) : 0;
      return { muridStats: { hadir: h, izin: i, sakit: s, alpa: a, persentase: pct } };
    } else {
      // Logic untuk Admin, Wali Kelas, Guru Mapel, Kepala Madrasah


      let muridQuery = supabase.from('master_user').select('id_user', { count: 'exact', head: true }).eq('role', 'Murid').eq('status_aktif', 'Aktif');
      if (user.role === 'Wali Kelas' && user.rombel && user.rombel !== '-') {
        muridQuery = muridQuery.eq('rombel', user.rombel);
      }

      const [guruRes, muridRes, pendingRes, activeTeachersRes, verifikasiDataRes, tapGuruRes, tapMuridRes] = await Promise.all([
        supabase.from('master_user').select('id', { count: 'exact', head: true }).in('role', ['Wali Kelas', 'Guru Mapel', 'Kepala Madrasah']).eq('status_aktif', 'Aktif'),
        muridQuery,
        supabase.from('log_gps_guru').select('id', { count: 'exact', head: true }).eq('tanggal', today).eq('status', 'Menunggu Verifikasi'),
        user.role === 'Kepala Madrasah' ? supabase.from('master_user').select('id_user').in('role', ['Wali Kelas', 'Guru Mapel', 'Kepala Madrasah']).eq('status_aktif', 'Aktif') : Promise.resolve({ data: null }),
        user.role === 'Kepala Madrasah' ? supabase.from('verifikasi_guru').select('tanggal, id_guru').gte('tanggal', calcStart).lte('tanggal', today) : Promise.resolve({ data: null }),
        user.role === 'Kepala Madrasah' ? supabase.from('view_rekap_kehadiran_guru_final').select('id_guru', { count: 'exact', head: true }).eq('tanggal', today).in('metode', ['NFC', 'GPS', 'NFC+GPS']) : Promise.resolve({ count: 0 }),
        user.role === 'Kepala Madrasah' ? supabase.from('view_rekap_kehadiran_murid_final').select('id_murid', { count: 'exact', head: true }).eq('tanggal', today).or('waktu_datang.neq.-,waktu_pulang.neq.-') : Promise.resolve({ count: 0 }),
      ]);

      let unverifiedDaysCount = 0;
      if (user.role === 'Kepala Madrasah' && activeTeachersRes.data && verifikasiDataRes.data) {
        const activeTeacherIds = activeTeachersRes.data.map(t => t.id_user);
        const verifikasiSet = new Set(verifikasiDataRes.data.map(v => `${v.tanggal}_${v.id_guru}`));

        for (const dateStr of validDates) {
          for (const teacherId of activeTeacherIds) {
            if (!verifikasiSet.has(`${dateStr}_${teacherId}`)) {
              unverifiedDaysCount++;
              break; // Lanjut ke hari berikutnya jika sudah ditemukan 1 yang belum diverifikasi
            }
          }
        }
      }

      let resStats = {
        guru: guruRes.count ?? '-',
        murid: muridRes.count ?? '-',
        pending: pendingRes.count ?? '-',
        unverifiedDays: unverifiedDaysCount,
        jurnal: '-',
        persentaseHadirGuru: 0,
        persentaseJurnal: 0,
        persentaseHadirMurid: 0,
        totalHadirMurid: 0,
        tapGuruHariIni: tapGuruRes?.count || 0,
        tapMuridHariIni: tapMuridRes?.count || 0
      };

      if (['Wali Kelas', 'Guru Mapel'].includes(user.role)) {
        // Ambil absensi guru keseluruhan (menggunakan view Auto-Hadir)
        const { data: guruAbsen } = await supabase.from('view_rekap_kehadiran_guru_final')
          .select('status, tanggal')
          .eq('id_guru', user.id_user)
          .gte('tanggal', calcStart)
          .lte('tanggal', today);

        let tidakHadirGuruCount = 0;
        (guruAbsen || []).forEach(a => {
          if (validDates.includes(a.tanggal) && ['Sakit', 'Izin', 'Alfa'].includes(a.status)) {
            tidakHadirGuruCount++;
          }
        });
        const totalHadirGuru = Math.max(0, hariEfektif - tidakHadirGuruCount);
        resStats.persentaseHadirGuru = hariEfektif > 0 ? Math.min(100, Math.round((totalHadirGuru / hariEfektif) * 100)) : 0;

        // Hitung persentase jurnal
        if (user.role === 'Wali Kelas') {
          // Wali Kelas: tolok ukur = hariEfektif (hari sekolah aktif)
          const { data: jurnalData } = await supabase.from('jurnal_guru')
            .select('tanggal')
            .eq('id_guru', user.id_user)
            .gte('tanggal', calcStart)
            .lte('tanggal', today);
          const uniqueJurnalDates = new Set((jurnalData || []).map(j => j.tanggal));
          resStats.persentaseJurnal = hariEfektif > 0 ? Math.min(100, Math.round((uniqueJurnalDates.size / hariEfektif) * 100)) : 0;
          resStats.jurnal = jurnalData ? jurnalData.length : 0;
        } else {
          // Guru Mapel: tolok ukur dari jadwal_pelajaran resmi (fallback ke deduksi riwayat jika kosong)
          const [jurnalRes, jadwalRes] = await Promise.all([
            supabase.from('jurnal_guru').select('tanggal, rombel').eq('id_guru', user.id_user).gte('tanggal', calcStart).lte('tanggal', today),
            supabase.from('jadwal_pelajaran').select('hari, rombel').eq('id_guru', user.id_user),
          ]);
          const jurnalArr = jurnalRes.data || [];
          const jadwalArr = jadwalRes.data || [];

          // Hitung kemunculan setiap hari-dalam-seminggu dari calcStart s.d. today (minus Minggu & libur)
          const dowOccurrences = {};
          let cur2 = new Date(calcStart + 'T00:00:00');
          const endDate2 = new Date(today + 'T00:00:00');
          while (cur2 <= endDate2) {
            const dow = cur2.getDay();
            const ds = cur2.toISOString().split('T')[0];
            if (dow !== 0 && !liburSet.has(ds)) {
              dowOccurrences[dow] = (dowOccurrences[dow] || 0) + 1;
            }
            cur2.setDate(cur2.getDate() + 1);
          }

          let scheduleSet;
          if (jadwalArr.length > 0) {
            // ✅ Gunakan jadwal resmi dari jadwal_pelajaran
            scheduleSet = new Set(jadwalArr.map(j => `${j.hari}__${j.rombel}`));
          } else {
            // ⚠️ Fallback: deduksi dari riwayat jurnal jika belum ada jadwal
            scheduleSet = new Set();
            jurnalArr.forEach(j => {
              const dow = new Date(j.tanggal + 'T00:00:00').getDay();
              scheduleSet.add(`${dow}__${j.rombel}`);
            });
          }

          // Total expected = kemunculan hari untuk setiap (hari, rombel) dalam jadwal
          let totalExpected = 0;
          scheduleSet.forEach(key => {
            const dow = parseInt(key.split('__')[0], 10);
            totalExpected += dowOccurrences[dow] || 0;
          });

          // Total aktual = pasangan unik (tanggal, rombel) yang sudah diisi jurnal
          const uniqueTanggalRombel = new Set(jurnalArr.map(j => `${j.tanggal}__${j.rombel}`));
          const totalActual = uniqueTanggalRombel.size;

          resStats.persentaseJurnal = totalExpected > 0 ? Math.min(100, Math.round((totalActual / totalExpected) * 100)) : 0;
          resStats.jurnal = jurnalArr.length;
          // Tandai apakah menggunakan jadwal resmi atau fallback
          resStats.jadwalResmi = jadwalArr.length > 0;
        }


        // Ambil absensi murid keseluruhan
        if (user.role === 'Wali Kelas') {
          const { data: muridRombel } = await supabase.from('master_user').select('id_user').eq('role', 'Murid').eq('rombel', user.rombel).eq('status_aktif', 'Aktif');
          const nisnList = muridRombel ? muridRombel.map(m => m.id_user) : [];
          if (nisnList.length > 0) {
            const { data: absenMurid } = await supabase.from('view_rekap_kehadiran_murid_final')
              .select('status, tanggal')
              .in('id_murid', nisnList)
              .gte('tanggal', calcStart)
              .lte('tanggal', today);

            let tidakHadirMuridCount = 0;
            (absenMurid || []).forEach(a => {
              if (validDates.includes(a.tanggal) && ['Sakit', 'Izin', 'Alfa', 'Alpa'].includes(a.status)) {
                tidakHadirMuridCount++;
              }
            });
            const totalPossible = hariEfektif * nisnList.length;
            const hadirMurid = Math.max(0, totalPossible - tidakHadirMuridCount);
            resStats.persentaseHadirMurid = totalPossible > 0 ? Math.min(100, Math.round((hadirMurid / totalPossible) * 100)) : 0;
          }
        } else if (user.role === 'Guru Mapel') {
          const { data: absenMurid } = await supabase.from('view_rekap_kehadiran_murid_final')
            .select('status, tanggal')
            .gte('tanggal', calcStart)
            .lte('tanggal', today);

          let tidakHadirTotalCount = 0;
          (absenMurid || []).forEach(a => {
            if (validDates.includes(a.tanggal) && ['Sakit', 'Izin', 'Alfa', 'Alpa'].includes(a.status)) {
              tidakHadirTotalCount++;
            }
          });

          const { count: totalMuridAktif } = await supabase.from('master_user')
            .select('id', { count: 'exact', head: true })
            .eq('role', 'Murid')
            .eq('status_aktif', 'Aktif');

          const totalPossible = hariEfektif * (totalMuridAktif || 0);
          const totalMasuk = Math.max(0, totalPossible - tidakHadirTotalCount);
          resStats.persentaseHadirMurid = totalPossible > 0 ? Math.min(100, Math.round((totalMasuk / totalPossible) * 100)) : 0;
          resStats.totalHadirMurid = totalMasuk;
        }
      }

      let resChartData = null;
      if (user.role === 'Admin' || user.role === 'Kepala Madrasah') {
        const { count: totalMuridAktif } = await supabase.from('master_user').select('id_user', { count: 'exact', head: true }).eq('role', 'Murid').eq('status_aktif', 'Aktif');
        const { data: todayMurid } = await supabase.from('view_rekap_kehadiran_murid_final').select('status').eq('tanggal', today);

        let ts = 0, ti = 0, ta = 0;
        (todayMurid || []).forEach(ab => {
          if (ab.status === 'Sakit') ts++;
          else if (ab.status === 'Izin') ti++;
          else if (ab.status === 'Alfa' || ab.status === 'Alpa') ta++;
        });
        const th = Math.max(0, (totalMuridAktif || 0) - (ts + ti + ta));

        const dates = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          dates.push(d.toISOString().split('T')[0]);
        }

        const { data: weekAbsen } = await supabase.from('view_rekap_kehadiran_murid_final').select('tanggal, status').in('tanggal', dates);
        const barData = dates.map(d => {
          let notHadir = 0;
          (weekAbsen || []).forEach(a => {
            if (a.tanggal === d && ['Sakit', 'Izin', 'Alfa', 'Alpa'].includes(a.status)) {
              notHadir++;
            }
          });
          return Math.max(0, (totalMuridAktif || 0) - notHadir);
        });

        resChartData = {
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
        };
      }
      return { stats: resStats, chartData: resChartData };
    }
  });

  const stats = data?.stats || { guru: '-', murid: '-', pending: '-', jurnal: '-' };
  const muridStats = data?.muridStats || { hadir: 0, izin: 0, sakit: 0, alpa: 0, persentase: 0 };
  const chartData = data?.chartData || null;

  if (!user) return null;

  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const cardsConfig = {
    Admin: [
      { label: 'Hari Ini', value: new Date().getDate(), sub: new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }), gradient: 'from-emerald-500 to-teal-600' },
      { label: 'Total Guru', value: stats.guru, sub: 'Aktif', gradient: 'from-emerald-500 to-teal-600' },
      { label: 'Total Murid', value: stats.murid, sub: 'Aktif', gradient: 'from-amber-500 to-orange-500' },
    ],
    'Kepala Madrasah': [
      { label: 'Hari Ini', value: new Date().getDate(), sub: new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }), gradient: 'from-emerald-500 to-teal-600' },
      { label: 'Murid Tap Mandiri', value: stats.murid !== '-' && stats.murid > 0 ? `${Math.round((stats.tapMuridHariIni / stats.murid) * 100)}%` : '0%', sub: `${stats.tapMuridHariIni} dari ${stats.murid} Siswa`, gradient: 'from-amber-500 to-orange-500' },
      { label: 'Guru Tap Mandiri', value: stats.guru !== '-' && stats.guru > 0 ? `${Math.round((stats.tapGuruHariIni / stats.guru) * 100)}%` : '0%', sub: `${stats.tapGuruHariIni} dari ${stats.guru} Guru`, gradient: 'from-blue-500 to-indigo-600' },
    ],
    'Wali Kelas': [
      { label: 'Kehadiran Anda', value: `${stats.persentaseHadirGuru || 0}%`, sub: 'Keseluruhan', gradient: 'from-emerald-500 to-teal-600' },
      { label: 'Kehadiran Murid', value: `${stats.persentaseHadirMurid || 0}%`, sub: `Rombel ${user.rombel}`, gradient: 'from-blue-500 to-indigo-600' },
      { label: 'Jurnal Guru', value: `${stats.persentaseJurnal || 0}%`, sub: 'Keseluruhan', gradient: 'from-amber-500 to-orange-500' },
    ],
    'Guru Mapel': [
      { label: 'Kehadiran Anda', value: `${stats.persentaseHadirGuru || 0}%`, sub: 'Keseluruhan', gradient: 'from-emerald-500 to-teal-600' },
      { label: 'Kehadiran Murid', value: `${stats.persentaseHadirMurid || 0}%`, sub: 'Seluruh Sekolah', gradient: 'from-blue-500 to-indigo-600' },
      { label: 'Jurnal Guru', value: `${stats.persentaseJurnal || 0}%`, sub: stats.jadwalResmi ? 'Jadwal Resmi' : 'Est. dari Riwayat', gradient: 'from-amber-500 to-orange-500' },
    ],
    Murid: [
      { label: 'Hari Ini', value: new Date().getDate(), sub: new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }), gradient: 'from-emerald-500 to-teal-600' },
      { label: 'Wali Kelas', value: user.wali_kelas || '-', sub: user.rombel, gradient: 'from-emerald-500 to-teal-600' },
    ],
  };

  const cards = cardsConfig[user.role] || [];

  const statStyles = {
    emerald: 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 shadow-sm',
    amber: 'bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 text-amber-600 dark:text-amber-400 shadow-sm',
    rose: 'bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 shadow-sm',
    slate: 'bg-slate-50 dark:bg-slate-500/10 border border-slate-100 dark:border-slate-500/20 text-slate-600 dark:text-slate-400 shadow-sm'
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl rounded-[2rem] p-6 lg:p-8 border border-white/60 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-slate-500 dark:text-slate-400 font-medium text-sm flex items-center gap-2 mb-1">
              <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>
              {today}
            </p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-800 dark:text-white tracking-tight">
              Assalamu&apos;alaikum, <br className="md:hidden" /><span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500 dark:from-emerald-400 dark:to-teal-300">{user.nama}</span> 👋
            </h2>

            {user.role === 'Murid' && (
              <p className="mt-4 max-w-2xl text-emerald-700/80 dark:text-emerald-300/70 italic text-xs sm:text-sm font-medium border-l-[3px] border-emerald-500/40 pl-4 py-1 leading-relaxed">
                &quot;Menuntut ilmu adalah taqwa. Menyampaikannya adalah ibadah. Mengulang-ulangnya adalah zikir. Mencari-carinya adalah jihad.&quot; <br /><span className="text-[10px] sm:text-xs font-bold mt-1.5 block opacity-80">— Imam Al-Ghazali</span>
              </p>
            )}
          </div>
          <div className="hidden md:flex w-16 h-16 bg-gradient-to-br from-emerald-100 to-teal-50 dark:from-emerald-900/40 dark:to-teal-900/20 rounded-2xl items-center justify-center border border-emerald-200/50 dark:border-emerald-500/20 shadow-inner overflow-hidden relative">
            {user?.foto ? (
              <img src={user.foto} alt={user.nama} className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {user.nama.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
        </div>
      </div>

      <AbsenGPSWidget />

      {/* Quick Menu Section */}
      <div className="md:hidden">
        <h3 className="text-slate-800 dark:text-white font-bold mb-3 flex items-center gap-2 px-1">
          <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" />
          </svg>
          Akses Cepat
        </h3>
        <div className="grid grid-cols-4 gap-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl rounded-[1.5rem] p-4 border border-white/60 dark:border-white/10 shadow-sm">
          {QUICK_MENU_CONFIG[user.role]?.map(menu => (
            <Link key={menu.href} href={menu.href} className="flex flex-col items-center gap-2 group">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border border-slate-100 dark:border-white/5 transition-transform group-active:scale-95 shadow-sm ${menu.color}`}>
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d={menu.icon} />
                </svg>
              </div>
              <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 text-center leading-tight">
                {menu.label}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {user.role === 'Murid' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          <div className="md:col-span-1 bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-white/60 dark:border-white/10 rounded-[2rem] p-6 text-center shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent pointer-events-none group-hover:from-emerald-500/10 transition-colors duration-500" />
            <div className="relative z-10 flex flex-col items-center justify-center h-full">
              <div className="w-32 h-32 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-[2rem] rotate-3 group-hover:rotate-6 transition-transform duration-500 flex items-center justify-center text-5xl font-black text-white mb-6 shadow-[0_10px_30px_rgba(16,185,129,0.3)]">
                <div className="-rotate-3 group-hover:-rotate-6 transition-transform duration-500">{muridStats.persentase}%</div>
              </div>
              <h3 className="text-slate-800 dark:text-white font-bold text-xl">Kehadiran</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1.5 font-medium">Total {muridStats.hadir + muridStats.izin + muridStats.sakit + muridStats.alpa} hari efektif</p>
            </div>
          </div>

          <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {[
              { label: 'Hadir', value: muridStats.hadir, color: 'emerald' },
              { label: 'Izin', value: muridStats.izin, color: 'amber' },
              { label: 'Sakit', value: muridStats.sakit, color: 'rose' },
              { label: 'Alpa', value: muridStats.alpa, color: 'slate' }
            ].map(stat => (
              <div key={stat.label} className={`${statStyles[stat.color]} rounded-[1.5rem] p-5 text-center flex flex-col justify-center items-center relative overflow-hidden group`}>
                <div className="absolute inset-0 bg-white/20 dark:bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <p className="text-4xl font-black tracking-tight relative z-10">{stat.value}</p>
                <p className="opacity-70 text-[10px] font-bold uppercase tracking-widest mt-2 relative z-10">{stat.label}</p>
              </div>
            ))}

            <div className="col-span-2 sm:col-span-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-white/60 dark:border-white/10 rounded-[1.5rem] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <h4 className="text-slate-800 dark:text-white text-sm font-bold mb-5 flex items-center gap-2 uppercase tracking-wide">
                <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" /></svg>
                Informasi Akademik
              </h4>
              <div className="grid grid-cols-2 gap-y-5 gap-x-4 text-sm bg-slate-50/50 dark:bg-slate-800/30 p-4 rounded-2xl border border-slate-100 dark:border-white/5">
                <div>
                  <p className="text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-widest font-bold mb-1">NISN</p>
                  <p className="text-slate-900 dark:text-white font-semibold truncate">{user.id_user}</p>
                </div>
                <div>
                  <p className="text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-widest font-bold mb-1">Kelas</p>
                  <p className="text-slate-900 dark:text-white font-semibold truncate">{user.rombel}</p>
                </div>
                <div className="col-span-2 pt-4 border-t border-slate-200/60 dark:border-white/10">
                  <p className="text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-widest font-bold mb-1">Wali Kelas</p>
                  <p className="text-slate-900 dark:text-white font-semibold truncate">{user.wali_kelas || '-'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
          {cards.map((card, idx) => {
            // Memberikan ukuran hero untuk card pertama di mobile
            const isHero = idx === 0;
            return (
              <div key={idx} className={`relative overflow-hidden rounded-[2rem] p-5 sm:p-6 bg-gradient-to-br ${card.gradient} shadow-[0_8px_30px_rgb(0,0,0,0.08)] text-white group ${isHero ? 'col-span-2 lg:col-span-1' : 'col-span-1'}`}>
                <div className="absolute -top-16 -right-16 w-48 h-48 bg-white/20 rounded-full blur-3xl pointer-events-none group-hover:scale-110 transition-transform duration-700" />
                <div className="absolute top-0 right-0 w-28 h-28 bg-white/10 rounded-bl-[100px] pointer-events-none group-hover:bg-white/20 transition-colors duration-500" />

                <div className="relative z-10 flex flex-col h-full justify-between min-h-[120px] sm:min-h-[140px]">
                  <p className="text-white/80 text-[10px] sm:text-xs font-bold uppercase tracking-widest">{card.label}</p>
                  <div className="mt-4 flex flex-col justify-end">
                    <p className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-none">{card.value}</p>
                    <p className="text-white/70 text-xs sm:text-sm mt-1.5 font-semibold">{card.sub}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {user.role === 'Admin' && chartData && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white/50 dark:bg-white/5 border border-slate-300 dark:border-white/5 rounded-2xl p-6 lg:col-span-2">
            <h3 className="text-slate-900 dark:text-white font-semibold text-sm mb-4">Tren Kehadiran (7 Hari)</h3>
            <div className="h-64">
              <Bar
                data={chartData.bar}
                options={{ maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } }, x: { grid: { display: false } } } }}
              />
            </div>
          </div>
          <div className="bg-white/50 dark:bg-white/5 border border-slate-300 dark:border-white/5 rounded-2xl p-6">
            <h3 className="text-slate-900 dark:text-white font-semibold text-sm mb-4">Proporsi Kehadiran Hari Ini</h3>
            <div className="h-48 flex justify-center">
              <Doughnut
                data={chartData.doughnut}
                options={{ maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#fff' } } }, cutout: '70%' }}
              />
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-white/50 dark:bg-white/5 border border-slate-300 dark:border-white/5 p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-500/10 rounded-xl flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
            </svg>
          </div>
          <div>
            <h3 className="text-slate-900 dark:text-white font-semibold text-sm">Inovatif+ v2.0 -- Powered by Minova</h3>
            <p className="text-slate-600 dark:text-white/40 text-sm mt-1">
              Platform layanan cerdas terintegrasi khusus untuk warga Madrasah Inovatif.
              Data tersinkronisasi dan aman di cloud.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
