'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import useSWR from 'swr';
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { id } from 'date-fns/locale/id';

registerLocale('id', id);

export default function RiwayatGuruPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  
  const [tglMulai, setTglMulai] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [tglAkhir, setTglAkhir] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  const { data: swrData, isLoading: loading } = useSWR(user && tglMulai && tglAkhir ? `riwayat_guru_${user.id_user}_${tglMulai}_${tglAkhir}` : null, async () => {
    if (isAdmin) {
      // 1. Ambil data guru
      const { data: guruData } = await supabase
        .from('master_user')
        .select('*')
        .in('role', ['Wali Kelas', 'Guru Mapel'])
        .eq('status_aktif', 'Aktif')
        .order('nama');

      // 2. Ambil data verifikasi_guru di rentang tanggal
      const { data: verData } = await supabase
        .from('verifikasi_guru')
        .select('id_guru, tanggal, status, catatan')
        .gte('tanggal', tglMulai)
        .lte('tanggal', tglAkhir);

      // 3. Proses rekap
      const rekap = {};
      (guruData || []).forEach(g => {
        rekap[g.id_user] = { Hadir: 0, Sakit: 0, Izin: 0, Alfa: 0, detail: {} };
      });

      (verData || []).forEach(v => {
        if (rekap[v.id_guru] && rekap[v.id_guru][v.status] !== undefined) {
          rekap[v.id_guru][v.status] += 1;
        }
      });

      return { guruList: guruData || [], rekapData: rekap, type: 'rekap' };
    } else {
      // Guru: riwayat harian
      const { data: verData } = await supabase
        .from('verifikasi_guru')
        .select('*')
        .eq('id_guru', user.id_user)
        .gte('tanggal', tglMulai)
        .lte('tanggal', tglAkhir)
        .order('tanggal', { ascending: false });
      
      const { data: nfcData } = await supabase
        .from('view_rekap_absensi_nfc')
        .select('*')
        .eq('id_user', user.id_user)
        .gte('tanggal', tglMulai)
        .lte('tanggal', tglAkhir)
        .order('tanggal', { ascending: false });

      const verMap = {};
      (verData || []).forEach(v => { verMap[v.tanggal] = v; });

      const combined = [];
      (nfcData || []).forEach(n => {
        if (!verMap[n.tanggal]) {
          combined.push({
            tanggal: n.tanggal,
            nama_guru: n.nama_guru,
            waktu: n.jam_datang || '-',
            status: 'Hadir',
            metode: 'NFC',
            catatan: n.jam_pulang ? `Pulang: ${n.jam_pulang}` : '-',
          });
        }
      });
      (verData || []).forEach(v => combined.push(v));
      combined.sort((a, b) => b.tanggal.localeCompare(a.tanggal));
      return { history: combined, type: 'history' };
    }
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}-${m}-${y}`;
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    if (swrData?.type !== 'rekap') return;
    
    let csv = 'Nama Guru,Hadir,Sakit,Izin,Alfa\\n';
    (swrData.guruList || []).forEach(g => {
      const r = swrData.rekapData[g.id_user] || { Hadir: 0, Sakit: 0, Izin: 0, Alfa: 0 };
      csv += `"${g.nama}",${r.Hadir},${r.Sakit},${r.Izin},${r.Alfa}\\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Rekap_Guru_${tglMulai}_sd_${tglAkhir}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const statusColors = {
    'Hadir': 'bg-emerald-500/20 text-emerald-300',
    'Sakit': 'bg-amber-500/20 text-amber-300',
    'Izin': 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
    'Alfa': 'bg-red-500/20 text-red-600 dark:text-red-300',
  };

  // Summary for Guru
  const guruSummary = { Hadir: 0, Sakit: 0, Izin: 0, Alfa: 0 };
  if (swrData?.type === 'history') {
    (swrData.history || []).forEach(d => { if (guruSummary[d.status] !== undefined) guruSummary[d.status]++; });
  }

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-white tracking-tight">
            {isAdmin ? 'Rekapitulasi Absen Guru' : 'Riwayat Absen Saya'}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            {isAdmin ? 'Laporan rekap kehadiran seluruh guru' : 'Riwayat kehadiran harian Anda'}
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <button onClick={handleExportExcel}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 rounded-xl text-sm font-semibold transition-all shadow-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Export Excel
            </button>
          )}
          <button onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 rounded-xl text-sm font-semibold transition-all shadow-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0v3.396c0 .63.508 1.141 1.141 1.141h8.218c.633 0 1.141-.51 1.141-1.141V8.25Z" />
            </svg>
            Print
          </button>
        </div>
      </div>

      {/* Filter Tanggal */}
      <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-3xl p-4 sm:p-6 shadow-sm print:hidden">
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-4 w-full">
          <div className="flex items-center gap-2 flex-1 sm:flex-none">
            <div className="relative w-full sm:w-auto">
              <DatePicker
                selected={new Date(tglMulai)}
                onChange={(date) => {
                  if (date) {
                    const y = date.getFullYear();
                    const m = String(date.getMonth() + 1).padStart(2, '0');
                    const d = String(date.getDate()).padStart(2, '0');
                    setTglMulai(`${y}-${m}-${d}`);
                  }
                }}
                dateFormat="dd-MM-yyyy"
                locale="id"
                todayButton="Hari Ini"
                wrapperClassName="w-full"
                className="w-full sm:w-auto pl-4 pr-10 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-white text-sm text-left font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-sm relative z-50"
                portalId="root-portal"
              />
              <svg className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-50" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z" />
              </svg>
            </div>
            <span className="text-slate-500 dark:text-slate-400 font-medium">s/d</span>
            <div className="relative w-full sm:w-auto">
              <DatePicker
                selected={new Date(tglAkhir)}
                onChange={(date) => {
                  if (date) {
                    const y = date.getFullYear();
                    const m = String(date.getMonth() + 1).padStart(2, '0');
                    const d = String(date.getDate()).padStart(2, '0');
                    setTglAkhir(`${y}-${m}-${d}`);
                  }
                }}
                dateFormat="dd-MM-yyyy"
                locale="id"
                todayButton="Hari Ini"
                wrapperClassName="w-full"
                className="w-full sm:w-auto pl-4 pr-10 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-white text-sm text-left font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-sm relative z-50"
                portalId="root-portal"
              />
              <svg className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-50" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {!isAdmin && swrData?.type === 'history' && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 print:hidden">
          {Object.entries(guruSummary).map(([s, count]) => (
            <span key={s} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${statusColors[s]}`}>
              {s}: {count}
            </span>
          ))}
          <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-white/10 text-slate-600 dark:text-white/60">
            Total: {swrData.history.length}
          </span>
        </div>
      )}

      {/* Tabel */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse print:text-black print:bg-white">
              <thead>
                {isAdmin ? (
                  <tr className="bg-slate-50/80 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 print:bg-gray-200 print:border-black/50">
                    <th className="px-5 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 print:text-black uppercase tracking-wider">No</th>
                    <th className="px-5 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 print:text-black uppercase tracking-wider">Nama Guru</th>
                    <th className="px-5 py-4 text-xs font-bold text-emerald-600 dark:text-emerald-400 print:text-black text-center uppercase tracking-wider">Hadir</th>
                    <th className="px-5 py-4 text-xs font-bold text-amber-600 dark:text-amber-400 print:text-black text-center uppercase tracking-wider">Sakit</th>
                    <th className="px-5 py-4 text-xs font-bold text-emerald-600 dark:text-emerald-400 print:text-black text-center uppercase tracking-wider">Izin</th>
                    <th className="px-5 py-4 text-xs font-bold text-red-600 dark:text-red-400 print:text-black text-center uppercase tracking-wider">Alfa</th>
                  </tr>
                ) : (
                  <tr className="bg-slate-50/80 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 print:bg-gray-200 print:border-black/50">
                    <th className="px-5 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 print:text-black uppercase tracking-wider">Tanggal</th>
                    <th className="px-5 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 print:text-black uppercase tracking-wider">Waktu</th>
                    <th className="px-5 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 print:text-black uppercase tracking-wider">Metode</th>
                    <th className="px-5 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 print:text-black uppercase tracking-wider">Status</th>
                    <th className="px-5 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 print:text-black uppercase tracking-wider">Catatan</th>
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5 print:divide-black/20">
                {isAdmin && swrData?.type === 'rekap' ? (
                  swrData.guruList.length > 0 ? (
                    swrData.guruList.map((guru, idx) => {
                      const r = swrData.rekapData[guru.id_user];
                      return (
                        <tr key={guru.id_user} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                          <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300 print:text-black">{idx + 1}</td>
                          <td className="px-5 py-4 text-sm font-medium text-slate-900 dark:text-white print:text-black">{guru.nama}</td>
                          <td className="px-5 py-4 text-sm text-center font-bold text-emerald-600 dark:text-emerald-400 print:text-black">{r.Hadir || '-'}</td>
                          <td className="px-5 py-4 text-sm text-center font-bold text-amber-600 dark:text-amber-400 print:text-black">{r.Sakit || '-'}</td>
                          <td className="px-5 py-4 text-sm text-center font-bold text-emerald-600 dark:text-emerald-400 print:text-black">{r.Izin || '-'}</td>
                          <td className="px-5 py-4 text-sm text-center font-bold text-red-600 dark:text-red-400 print:text-black">{r.Alfa || '-'}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr><td colSpan="7" className="text-center py-12 text-slate-500 dark:text-slate-400">Belum ada data</td></tr>
                  )
                ) : (
                  swrData?.history?.length > 0 ? (
                    swrData.history.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                        <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300 print:text-black font-mono">{formatDate(row.tanggal)}</td>
                        <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300 print:text-black">{row.waktu}</td>
                        <td className="px-5 py-4 text-sm">
                          <span className={`px-2 py-1 rounded-md text-xs ${
                            row.metode === 'NFC' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                          }`}>{row.metode || 'GPS'}</span>
                        </td>
                        <td className="px-5 py-4 text-sm">
                          <span className={`px-2 py-1 rounded-md text-xs font-medium ${statusColors[row.status] || 'text-slate-600 dark:text-white/30'}`}>
                            {row.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-500 dark:text-slate-400 print:text-black">{row.catatan || '-'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan="5" className="text-center py-12 text-slate-500 dark:text-slate-400">Tidak ada riwayat absensi pada rentang tanggal tersebut</td></tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * { visibility: hidden; }
          .print\\:hidden { display: none !important; }
          .print\\:visible, .print\\:visible * { visibility: visible; }
          .print\\:visible { position: absolute; left: 0; top: 0; width: 100%; }
          table, table * { visibility: visible; }
          table { position: relative; width: 100%; border-collapse: collapse; margin-top: 2rem; }
          th, td { border: 1px solid #000; padding: 12px 8px; color: #000 !important; }
          th { background-color: #f3f4f6 !important; -webkit-print-color-adjust: exact; color: #000 !important; }
        }
      `}} />
    </div>
  );
}
