'use client';

import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { getTodayDate } from '@/lib/dateUtils';
import useSWR from 'swr';
import Link from 'next/link';
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
    { label: 'Verifikasi', href: '/dashboard/verifikasi', icon: 'M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z', color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10' },
    { label: 'Jurnal', href: '/dashboard/jurnal', icon: 'M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25', color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' },
    { label: 'Riwayat', href: '/dashboard/riwayat-guru', icon: 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z', color: 'text-blue-500 bg-blue-50 dark:bg-blue-500/10' },
    { label: 'Libur', href: '/dashboard/libur', icon: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5', color: 'text-rose-500 bg-rose-50 dark:bg-rose-500/10' },
    { label: 'Rekap', href: '/dashboard/rekap', icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z', color: 'text-amber-500 bg-amber-50 dark:bg-amber-500/10' },
    { label: 'E-Perpus', href: '/dashboard/eperpus', icon: 'M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25', color: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-500/10' },
  ],
  'Wali Kelas': [
    { label: 'Presensi', href: '/dashboard/presensi', icon: 'M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0 1 18 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3 1.5 1.5 3-3.75', color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10' },
    { label: 'Jurnal', href: '/dashboard/jurnal', icon: 'M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25', color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' },
    { label: 'Rekap', href: '/dashboard/rekap', icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z', color: 'text-amber-500 bg-amber-50 dark:bg-amber-500/10' },
    { label: 'Riwayat', href: '/dashboard/riwayat-guru', icon: 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z', color: 'text-blue-500 bg-blue-50 dark:bg-blue-500/10' },
    { label: 'E-Perpus', href: '/dashboard/eperpus', icon: 'M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25', color: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-500/10' },
  ],
  'Guru Mapel': [
    { label: 'Jurnal', href: '/dashboard/jurnal', icon: 'M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25', color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' },
    { label: 'Rekap', href: '/dashboard/rekap', icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z', color: 'text-amber-500 bg-amber-50 dark:bg-amber-500/10' },
    { label: 'Riwayat', href: '/dashboard/riwayat-guru', icon: 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z', color: 'text-blue-500 bg-blue-50 dark:bg-blue-500/10' },
    { label: 'E-Perpus', href: '/dashboard/eperpus', icon: 'M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25', color: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-500/10' },
  ],
  Murid: [
    { label: 'Riwayat', href: '/dashboard/riwayat-murid', icon: 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z', color: 'text-blue-500 bg-blue-50 dark:bg-blue-500/10' },
    { label: 'E-Perpus', href: '/dashboard/eperpus', icon: 'M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25', color: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-500/10' },
  ],
};

export default function DashboardHome() {
  const { user } = useAuth();
  const { data } = useSWR(user ? `dashboard-stats-${user.id_user}` : null, async () => {
    const today = getTodayDate();
    const monthStart = today.slice(0, 7) + '-01';

    if (user.role === 'Murid') {
      const { data: absenMurid } = await supabase
        .from('data_absensi')
        .select('status')
        .eq('nisn', user.id_user);

      let h = 0, i = 0, s = 0, a = 0;
      if (absenMurid) {
        absenMurid.forEach(ab => {
          if (ab.status === 'Hadir') h++;
          else if (ab.status === 'Izin') i++;
          else if (ab.status === 'Sakit') s++;
          else if (ab.status === 'Alpa') a++;
        });
      }
      const total = h + i + s + a;
      const pct = total > 0 ? Math.round((h / total) * 100) : 0;
      return { muridStats: { hadir: h, izin: i, sakit: s, alpa: a, persentase: pct } };
    } else {
      // Logic untuk Admin, Wali Kelas, Guru Mapel
      // Ambil pengaturan sekolah untuk mendapatkan hari pertama tahun ajaran
      const { data: pengaturanData } = await supabase.from('pengaturan_sekolah').select('tgl_mulai_efektif').limit(1).maybeSingle();
      const pengaturan = pengaturanData || {};

      // Keseluruhan Hari Efektif: Dari tgl_mulai_efektif sampai hari ini
      let calcStart = pengaturan.tgl_mulai_efektif || monthStart;
      if (calcStart > today) calcStart = monthStart; // fallback jika tgl efektif di masa depan

      const { data: liburData } = await supabase.from('master_libur').select('tanggal').gte('tanggal', calcStart).lte('tanggal', today);
      const liburSet = new Set((liburData || []).map(l => l.tanggal));

      let hariEfektif = 0;
      let curr = new Date(calcStart);
      const end = new Date(today);
      while (curr <= end) {
        if (curr.getDay() !== 0) { // Bukan Minggu
          const dateStr = curr.toISOString().split('T')[0];
          if (!liburSet.has(dateStr)) {
            hariEfektif++;
          }
        }
        curr.setDate(curr.getDate() + 1);
      }

      let muridQuery = supabase.from('master_user').select('id_user', { count: 'exact', head: true }).eq('role', 'Murid').eq('status_aktif', 'Aktif');
      if (user.role === 'Wali Kelas' && user.rombel && user.rombel !== '-') {
        muridQuery = muridQuery.eq('rombel', user.rombel);
      }

      const [guruRes, muridRes, pendingRes] = await Promise.all([
        supabase.from('master_user').select('id', { count: 'exact', head: true }).in('role', ['Wali Kelas', 'Guru Mapel']).eq('status_aktif', 'Aktif'),
        muridQuery,
        supabase.from('log_gps_guru').select('id', { count: 'exact', head: true }).eq('tanggal', today).eq('status', 'Menunggu Verifikasi'),
      ]);

      let resStats = {
        guru: guruRes.count ?? '-',
        murid: muridRes.count ?? '-',
        pending: pendingRes.count ?? '-',
        jurnal: '-',
        persentaseHadirGuru: 0,
        persentaseJurnal: 0,
        persentaseHadirMurid: 0,
        totalHadirMurid: 0
      };

      if (['Wali Kelas', 'Guru Mapel'].includes(user.role)) {
        // Ambil absensi guru keseluruhan
        const { data: guruAbsen } = await supabase.from('verifikasi_guru')
          .select('status, tanggal')
          .eq('id_guru', user.id_user)
          .gte('tanggal', calcStart)
          .lte('tanggal', today);
        const hadirGuruDates = new Set((guruAbsen || [])
          .filter(a => ['Hadir', 'Terlambat', 'hadir', 'terlambat'].includes(a.status))
          .map(a => a.tanggal));
        resStats.persentaseHadirGuru = hariEfektif > 0 ? Math.min(100, Math.round((hadirGuruDates.size / hariEfektif) * 100)) : 0;

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
            const { data: absenMurid } = await supabase.from('data_absensi')
              .select('status')
              .in('nisn', nisnList)
              .gte('tanggal', calcStart)
              .lte('tanggal', today);
            const hadirMurid = (absenMurid || []).filter(a => ['Hadir', 'Terlambat', 'hadir', 'terlambat'].includes(a.status)).length;
            const totalPossible = hariEfektif * nisnList.length;
            resStats.persentaseHadirMurid = totalPossible > 0 ? Math.min(100, Math.round((hadirMurid / totalPossible) * 100)) : 0;
          }
        } else if (user.role === 'Guru Mapel') {
          const { count: totalMasuk } = await supabase.from('data_absensi')
            .select('id', { count: 'exact', head: true })
            .in('status', ['Hadir', 'Terlambat', 'hadir', 'terlambat'])
            .gte('tanggal', calcStart)
            .lte('tanggal', today);
            
          const { count: totalMuridAktif } = await supabase.from('master_user')
            .select('id', { count: 'exact', head: true })
            .eq('role', 'Murid')
            .eq('status_aktif', 'Aktif');
            
          const totalPossible = hariEfektif * (totalMuridAktif || 0);
          resStats.persentaseHadirMurid = totalPossible > 0 ? Math.min(100, Math.round(((totalMasuk || 0) / totalPossible) * 100)) : 0;
          resStats.totalHadirMurid = totalMasuk || 0;
        }
      }

      let resChartData = null;
      if (user.role === 'Admin') {
        const { data: todayAbsen } = await supabase.from('data_absensi').select('status').eq('tanggal', today);
        let th = 0, ti = 0, ts = 0, ta = 0;
        (todayAbsen || []).forEach(ab => {
          if (ab.status === 'Hadir') th++;
          else if (ab.status === 'Izin') ti++;
          else if (ab.status === 'Sakit') ts++;
          else if (ab.status === 'Alpa') ta++;
        });

        const dates = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          dates.push(d.toISOString().split('T')[0]);
        }

        const { data: weekAbsen } = await supabase.from('data_absensi').select('tanggal, status').in('tanggal', dates);
        const barData = dates.map(d => {
          return (weekAbsen || []).filter(a => a.tanggal === d && a.status === 'Hadir').length;
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
      { label: 'Perlu Verifikasi', value: stats.pending, sub: 'Hari ini', gradient: 'from-rose-500 to-red-600' },
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
