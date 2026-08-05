'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
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

export default function DashboardHome() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ guru: '-', murid: '-', pending: '-', jurnal: '-' });
  const [muridStats, setMuridStats] = useState({ hadir: 0, izin: 0, sakit: 0, alpa: 0, persentase: 0 });
  const [chartData, setChartData] = useState(null);

  useEffect(() => {
    async function fetchStats() {
      if (!user) return;
      
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

  if (!user) return null;

  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const cardsConfig = {
    Admin: [
      { label: 'Total Guru', value: stats.guru, sub: 'Aktif', gradient: 'from-emerald-500 to-teal-600' },
      { label: 'Total Murid', value: stats.murid, sub: 'Aktif', gradient: 'from-amber-500 to-orange-500' },
      { label: 'Perlu Verifikasi', value: stats.pending, sub: 'Hari ini', gradient: 'from-rose-500 to-red-600' },
    ],
    'Wali Kelas': [
      { label: 'Jurnal Bulan Ini', value: stats.jurnal, sub: 'Entri', gradient: 'from-emerald-500 to-teal-600' },
      { label: 'Total Murid', value: stats.murid, sub: 'Aktif', gradient: 'from-amber-500 to-orange-500' },
    ],
    'Guru Mapel': [
      { label: 'Jurnal Bulan Ini', value: stats.jurnal, sub: 'Entri', gradient: 'from-emerald-500 to-teal-600' },
    ],
    Murid: [
      { label: 'Wali Kelas', value: user.wali_kelas || '-', sub: user.rombel, gradient: 'from-emerald-500 to-teal-600' },
    ],
  };

  const cards = [
    { label: 'Hari Ini', value: new Date().getDate(), sub: new Date().toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }), gradient: 'from-blue-500 to-indigo-600' },
    ...(cardsConfig[user.role] || []),
  ];

  const statStyles = {
    emerald: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-600 dark:text-amber-400',
    rose: 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400',
    slate: 'bg-slate-50 dark:bg-slate-500/10 border-slate-200 dark:border-slate-500/20 text-slate-600 dark:text-slate-400'
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl rounded-3xl p-6 lg:p-8 border border-white/50 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-800 dark:text-white tracking-tight">
            Assalamu&apos;alaikum, <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500 dark:from-emerald-400 dark:to-teal-300">{user.nama}</span> 👋
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z" /></svg>
            {today}
          </p>
          {user.role === 'Murid' && (
            <p className="mt-4 max-w-2xl text-emerald-700/80 dark:text-emerald-300/70 italic text-sm font-medium border-l-2 border-emerald-500/30 pl-4">
              "Menuntut ilmu adalah taqwa. Menyampaikannya adalah ibadah. Mengulang-ulangnya adalah zikir. Mencari-carinya adalah jihad." <br/><span className="text-xs font-normal mt-1 block">— Imam Al-Ghazali</span>
            </p>
          )}
        </div>
      </div>
      
      {user.role === 'Murid' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-900/50 border border-slate-200 dark:border-white/10 rounded-3xl p-6 text-center shadow-sm relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-500/10 via-transparent to-transparent pointer-events-none" />
            <div className="relative z-10 flex flex-col items-center justify-center h-full">
              <div className="w-28 h-28 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-full flex items-center justify-center text-4xl font-bold text-white mb-4 shadow-[0_0_30px_rgba(16,185,129,0.3)] ring-4 ring-emerald-50 dark:ring-emerald-900/30">
                {muridStats.persentase}%
              </div>
              <h3 className="text-slate-800 dark:text-white font-bold text-lg">Kehadiran</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Total {muridStats.hadir + muridStats.izin + muridStats.sakit + muridStats.alpa} hari efektif</p>
            </div>
          </div>
          
          <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Hadir', value: muridStats.hadir, color: 'emerald' },
              { label: 'Izin', value: muridStats.izin, color: 'amber' },
              { label: 'Sakit', value: muridStats.sakit, color: 'rose' },
              { label: 'Alpa', value: muridStats.alpa, color: 'slate' }
            ].map(stat => (
              <div key={stat.label} className={`${statStyles[stat.color]} border rounded-2xl p-5 text-center flex flex-col justify-center items-center shadow-sm`}>
                <p className="text-3xl font-bold">{stat.value}</p>
                <p className="opacity-70 text-xs font-semibold uppercase tracking-widest mt-2">{stat.label}</p>
              </div>
            ))}
            
            <div className="col-span-2 sm:col-span-4 bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-6 mt-2 shadow-sm">
              <h4 className="text-slate-800 dark:text-white text-sm font-bold mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" /></svg>
                Informasi Akademik
              </h4>
              <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
                <div>
                  <p className="text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-medium mb-1">NISN</p>
                  <p className="text-slate-900 dark:text-white font-semibold">{user.id_user}</p>
                </div>
                <div>
                  <p className="text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-medium mb-1">Kelas</p>
                  <p className="text-slate-900 dark:text-white font-semibold">{user.rombel}</p>
                </div>
                <div className="col-span-2 pt-2 border-t border-slate-100 dark:border-white/5">
                  <p className="text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-medium mb-1">Wali Kelas</p>
                  <p className="text-slate-900 dark:text-white font-semibold">{user.wali_kelas || '-'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6">
          {cards.map((card, idx) => (
            <div key={idx} className={`relative overflow-hidden rounded-3xl p-6 bg-gradient-to-br ${card.gradient} shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:shadow-[0_12px_40px_rgb(0,0,0,0.12)] hover:-translate-y-1 transform transition-all duration-300 text-white`}>
              <div className="absolute -top-12 -right-12 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-bl-[100px] pointer-events-none" />
              <div className="relative z-10 flex flex-col h-full justify-between">
                <p className="text-white/80 text-xs font-bold uppercase tracking-widest">{card.label}</p>
                <div className="mt-4">
                  <p className="text-4xl lg:text-5xl font-extrabold tracking-tight">{card.value}</p>
                  <p className="text-white/70 text-sm mt-1 font-medium">{card.sub}</p>
                </div>
              </div>
            </div>
          ))}
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
            <h3 className="text-slate-900 dark:text-white font-semibold text-sm">SIAKAD v2.0 — Powered by Supabase</h3>
            <p className="text-slate-600 dark:text-white/40 text-sm mt-1">
              Aplikasi ini menggunakan cloud database PostgreSQL (Supabase) untuk performa maksimal. 
              Data disinkronisasi otomatis ke Google Sheets sebagai cadangan.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
