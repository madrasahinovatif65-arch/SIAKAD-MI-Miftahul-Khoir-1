'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import useSWR from 'swr';
import { useIsMobile } from '@/hooks/useIsMobile';
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { id } from 'date-fns/locale/id';

registerLocale('id', id);

export default function RiwayatMuridPage() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [tglMulai, setTglMulai] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [tglAkhir, setTglAkhir] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [filterStatus, setFilterStatus] = useState('Semua');
  const { data: swrData, isLoading: loading } = useSWR(user && tglMulai && tglAkhir ? `riwayat_murid_${user.id_user}_${tglMulai}_${tglAkhir}` : null, async () => {

    // Ambil dari data_absensi
    const { data: absensi } = await supabase
      .from('data_absensi')
      .select('*')
      .eq('nisn', user.id_user)
      .gte('tanggal', tglMulai)
      .lte('tanggal', tglAkhir)
      .order('tanggal', { ascending: false });

    // Ambil dari data_nfc_murid
    const { data: nfc } = await supabase
      .from('view_rekap_absensi_nfc')
      .select('*')
      .eq('id_user', user.id_user)
      .gte('tanggal', tglMulai)
      .lte('tanggal', tglAkhir)
      .order('tanggal', { ascending: false });

    // Merge: absensi overrides NFC
    const absenMap = {};
    (absensi || []).forEach(a => { absenMap[a.tanggal] = a; });

    const combined = [];
    (nfc || []).forEach(n => {
      if (!absenMap[n.tanggal]) {
        combined.push({
          tanggal: n.tanggal,
          status: 'Hadir',
          catatan: `NFC: ${n.jam_datang || '-'}${n.jam_pulang ? ' - ' + n.jam_pulang : ''}`,
          metode: 'NFC',
        });
      }
    });
    (absensi || []).forEach(a => combined.push({ ...a, metode: a.metode || 'Manual' }));
    combined.sort((a, b) => b.tanggal.localeCompare(a.tanggal));
    return combined;
  });

  const data = swrData || [];

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}-${m}-${y}`;
  };

  const statusColors = {
    'Hadir': 'bg-emerald-500/20 text-emerald-300',
    'Sakit': 'bg-amber-500/20 text-amber-300',
    'Izin': 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
    'Alfa': 'bg-red-500/20 text-red-600 dark:text-red-300',
    'Dispen': 'bg-purple-500/20 text-purple-300',
  };

  const summary = { Hadir: 0, Sakit: 0, Izin: 0, Alfa: 0, Dispen: 0 };
  data.forEach(d => { if (summary[d.status] !== undefined) summary[d.status]++; });
  const total = data.length;
  const persentase = total > 0 ? Math.round((summary.Hadir / total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Riwayat Absen Saya</h2>
          <p className="text-slate-600 dark:text-white/40 text-sm mt-1">{user.nama} · {user.rombel}</p>
        </div>
      </div>

      {/* Filter Tanggal */}
      <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-3xl p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-4 w-full">
          <div className="flex items-center gap-2 flex-1 sm:flex-none">
            <div className="relative w-full sm:w-auto">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 z-50 pointer-events-none">DARI:</span>
              <DatePicker withPortal={isMobile} onFocus={(e) => { if (isMobile) e.target.readOnly = true; }}
                selected={new Date(tglMulai)}
                onChange={(date) => {
                  if (date) {
                    const y = date.getFullYear();
                    const m = String(date.getMonth() + 1).padStart(2, '0');
                    const d = String(date.getDate()).padStart(2, '0');
                    setTglMulai(`${y}-${m}-${d}`);
                  }
                }}
                dateFormat="dd/MM/yyyy"
                locale="id"
                todayButton="Hari Ini"
                wrapperClassName="w-full"
                className="w-full sm:w-40 pl-11 pr-8 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-sm relative z-40"
                portalId="root-portal"
              />
              <svg className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-40" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z" />
              </svg>
            </div>
            <span className="text-slate-300 dark:text-slate-600 font-medium text-sm">-</span>
            <div className="relative w-full sm:w-auto">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 z-50 pointer-events-none">HINGGA:</span>
              <DatePicker withPortal={isMobile} onFocus={(e) => { if (isMobile) e.target.readOnly = true; }}
                selected={new Date(tglAkhir)}
                onChange={(date) => {
                  if (date) {
                    const y = date.getFullYear();
                    const m = String(date.getMonth() + 1).padStart(2, '0');
                    const d = String(date.getDate()).padStart(2, '0');
                    setTglAkhir(`${y}-${m}-${d}`);
                  }
                }}
                dateFormat="dd/MM/yyyy"
                locale="id"
                todayButton="Hari Ini"
                wrapperClassName="w-full"
                className="w-full sm:w-40 pl-16 pr-8 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-sm relative z-40"
                portalId="root-portal"
              />
              <svg className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-40" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-emerald-600/20 to-emerald-800/20 border border-slate-300 dark:border-white/5 rounded-2xl p-5">
          <p className="text-slate-600 dark:text-white/50 text-xs">Kehadiran</p>
          <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{persentase}%</p>
          <p className="text-slate-600 dark:text-white/30 text-xs mt-1">{summary.Hadir}/{total} hari</p>
        </div>
        <div className="bg-gradient-to-br from-amber-600/20 to-amber-800/20 border border-slate-300 dark:border-white/5 rounded-2xl p-5">
          <p className="text-slate-600 dark:text-white/50 text-xs">Sakit</p>
          <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{summary.Sakit}</p>
        </div>
        <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 border border-slate-300 dark:border-white/5 rounded-2xl p-5">
          <p className="text-slate-600 dark:text-white/50 text-xs">Izin</p>
          <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{summary.Izin}</p>
        </div>
        <div className="bg-gradient-to-br from-red-600/20 to-red-800/20 border border-slate-300 dark:border-white/5 rounded-2xl p-5">
          <p className="text-slate-600 dark:text-white/50 text-xs">Alfa</p>
          <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{summary.Alfa}</p>
        </div>
      </div>

      {/* Filter Status */}
      {data.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 hide-scrollbar">
          {['Semua', 'Hadir', 'Sakit', 'Izin', 'Alfa', 'Dispen'].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                filterStatus === s 
                  ? (s === 'Semua' ? 'bg-emerald-600 text-slate-900 dark:text-white' : statusColors[s].replace('bg-opacity-20', 'bg-opacity-100').replace('text-', 'text-slate-900 dark:text-white bg-').split(' ')[0] + ' text-slate-900 dark:text-white')
                  : 'bg-white/50 dark:bg-white/5 border border-slate-300 dark:border-white/10 text-slate-600 dark:text-white/60 hover:bg-white dark:bg-white/10'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : data.length === 0 ? (
        <div className="text-center py-12 text-slate-600 dark:text-white/30 text-sm">Tidak ada data untuk rentang tanggal ini</div>
      ) : (
        <div className="space-y-2">
          {data
            .filter(d => filterStatus === 'Semua' || d.status === filterStatus)
            .map((row, idx) => (
            <div key={idx} className="bg-white/50 dark:bg-white/5 border border-slate-300 dark:border-white/5 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                <span className="text-slate-600 dark:text-white/60 font-mono text-xs w-24 shrink-0">{formatDate(row.tanggal)}</span>
                <span className={`px-2 py-1 rounded-md text-xs font-medium ${statusColors[row.status] || 'text-slate-600 dark:text-white/30'}`}>
                  {row.status}
                </span>
              </div>
              <div className="flex items-center gap-3 self-end sm:self-auto">
                {row.metode === 'NFC' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                    NFC
                  </span>
                ) : (
                  <span className="text-slate-400 dark:text-white/20 text-xs">Manual</span>
                )}
                <span className="text-slate-600 dark:text-white/40 text-xs max-w-[150px] sm:max-w-40 truncate" title={row.catatan || '-'}>{row.catatan || '-'}</span>
              </div>
            </div>
          ))}
          {data.filter(d => filterStatus === 'Semua' || d.status === filterStatus).length === 0 && (
            <div className="text-center py-8 text-slate-600 dark:text-white/30 text-sm">Tidak ada absensi dengan status {filterStatus}</div>
          )}
        </div>
      )}
    </div>
  );
}
