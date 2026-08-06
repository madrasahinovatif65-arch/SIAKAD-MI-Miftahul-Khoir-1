'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export default function RekapPage() {
  const { user } = useAuth();
  const [tglMulai, setTglMulai] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [tglAkhir, setTglAkhir] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [rombel, setRombel] = useState(user?.role === 'Admin' ? 'Semua' : user?.rombel || '');
  const [rombelOptions, setRombelOptions] = useState([]);
  
  const [muridData, setMuridData] = useState([]);
  const [rekapData, setRekapData] = useState({});
  const [loading, setLoading] = useState(false);

  // Ambil daftar rombel untuk Admin
  useEffect(() => {
    async function fetchRombel() {
      const { data } = await supabase.from('master_murid').select('rombel');
      if (data) {
        const unique = [...new Set(data.map(d => d.rombel).filter(Boolean))].sort();
        setRombelOptions(unique);
      }
    }
    if (user?.role === 'Admin') fetchRombel();
  }, [user]);

  const loadData = useCallback(async () => {
    if (!tglMulai || !tglAkhir || (!rombel && user?.role !== 'Admin')) return;
    setLoading(true);

    // 1. Ambil data murid
    let queryMurid = supabase.from('master_murid').select('*').eq('status', 'Aktif');
    if (rombel !== 'Semua') {
      queryMurid = queryMurid.eq('rombel', rombel);
    }
    const { data: murid } = await queryMurid.order('rombel').order('nama_murid');

    // 2. Ambil data absensi di rentang tanggal
    let queryAbsen = supabase.from('data_absensi').select('nisn, tanggal, status, rombel').gte('tanggal', tglMulai).lte('tanggal', tglAkhir);
    if (rombel !== 'Semua') {
      queryAbsen = queryAbsen.eq('rombel', rombel);
    }
    const { data: absensi } = await queryAbsen;

    // 3. Proses rekap
    const rekap = {};
    (murid || []).forEach(m => {
      rekap[m.nisn] = { Hadir: 0, Sakit: 0, Izin: 0, Alfa: 0, Dispen: 0, detail: {} };
    });

    (absensi || []).forEach(a => {
      if (rekap[a.nisn] && rekap[a.nisn][a.status] !== undefined) {
        rekap[a.nisn][a.status] += 1;
        rekap[a.nisn].detail[a.tanggal] = a.status.charAt(0); // H, S, I, A
      }
    });

    setMuridData(murid || []);
    setRekapData(rekap);
    setLoading(false);
  }, [tglMulai, tglAkhir, rombel, user]);

  // eslint-disable-next-line
  useEffect(() => { loadData(); }, [loadData]);

  const handleExportExcel = () => {
    let csv = 'NISN,Nama Murid,Rombel,Hadir,Sakit,Izin,Alfa,Dispen\n';
    muridData.forEach(m => {
      const r = rekapData[m.nisn] || { Hadir: 0, Sakit: 0, Izin: 0, Alfa: 0, Dispen: 0 };
      csv += `"${m.nisn}","${m.nama_murid}","${m.rombel}",${r.Hadir},${r.Sakit},${r.Izin},${r.Alfa},${r.Dispen}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Rekap_Absensi_${rombel}_${tglMulai}_sd_${tglAkhir}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-white tracking-tight">Rekapitulasi Absensi</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Laporan statistik kehadiran bulanan</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <button onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 rounded-xl text-sm font-semibold transition-all shadow-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Export Excel
          </button>
          <button onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 rounded-xl text-sm font-semibold transition-all shadow-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0v3.396c0 .63.508 1.141 1.141 1.141h8.218c.633 0 1.141-.51 1.141-1.141V8.25Z" />
            </svg>
            Print
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-3xl p-4 sm:p-6 shadow-sm print:hidden">
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-4 w-full">
          <div className="flex items-center gap-2 flex-1 sm:flex-none">
            <input
              type="date"
              value={tglMulai}
              onChange={e => setTglMulai(e.target.value)}
              className="w-full sm:w-auto px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-sm"
            />
            <span className="text-slate-500 dark:text-slate-400 font-medium">s/d</span>
            <input
              type="date"
              value={tglAkhir}
              onChange={e => setTglAkhir(e.target.value)}
              className="w-full sm:w-auto px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-sm"
            />
          </div>
          {user?.role === 'Admin' && (
            <select value={rombel} onChange={e => setRombel(e.target.value)}
              className="w-full sm:w-auto px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-sm">
              <option value="Semua" className="bg-white dark:bg-slate-900">Semua Rombel</option>
              {rombelOptions.map(r => (
                <option key={r} value={r} className="bg-white dark:bg-slate-900">{r}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Tabel */}
      <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse print:text-black print:bg-white">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 print:bg-gray-200 print:border-black/50">
                <th className="px-5 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 print:text-black uppercase tracking-wider">No</th>
                <th className="px-5 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 print:text-black uppercase tracking-wider">NISN</th>
                <th className="px-5 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 print:text-black uppercase tracking-wider">Nama Murid</th>
                {rombel === 'Semua' && (
                  <th className="px-5 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 print:text-black uppercase tracking-wider">Rombel</th>
                )}
                <th className="px-5 py-4 text-xs font-bold text-emerald-600 dark:text-emerald-400 print:text-black text-center uppercase tracking-wider">Hadir</th>
                <th className="px-5 py-4 text-xs font-bold text-amber-600 dark:text-amber-400 print:text-black text-center uppercase tracking-wider">Sakit</th>
                <th className="px-5 py-4 text-xs font-bold text-blue-600 dark:text-blue-400 print:text-black text-center uppercase tracking-wider">Izin</th>
                <th className="px-5 py-4 text-xs font-bold text-rose-600 dark:text-rose-400 print:text-black text-center uppercase tracking-wider">Alfa</th>
                <th className="px-5 py-4 text-xs font-bold text-purple-600 dark:text-purple-400 print:text-black text-center uppercase tracking-wider">Dispen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5 print:divide-black/20">
              {loading ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-500 dark:text-slate-400 font-medium">Memuat data...</td>
                </tr>
              ) : muridData.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-500 dark:text-slate-400 font-medium">Tidak ada data murid di rentang tanggal & rombel ini.</td>
                </tr>
              ) : (
                muridData.map((m, idx) => {
                  const r = rekapData[m.nisn] || { Hadir: 0, Sakit: 0, Izin: 0, Alfa: 0, Dispen: 0 };
                  return (
                    <tr key={m.nisn} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors group print:hover:bg-transparent">
                      <td className="px-5 py-3 text-sm text-slate-500 dark:text-slate-400 print:text-black">{idx + 1}</td>
                      <td className="px-5 py-3 text-sm text-slate-400 dark:text-slate-500 font-mono print:text-black">{m.nisn}</td>
                      <td className="px-5 py-3 text-sm text-slate-800 dark:text-white print:text-black font-semibold">{m.nama_murid}</td>
                      {rombel === 'Semua' && (
                        <td className="px-5 py-3 text-sm text-slate-500 dark:text-slate-400 print:text-black">
                          <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-md text-xs font-bold">{m.rombel}</span>
                        </td>
                      )}
                      <td className="px-5 py-3 text-sm text-emerald-600 dark:text-emerald-400 print:text-black text-center font-bold bg-emerald-50/30 dark:bg-emerald-500/5">{r.Hadir || '-'}</td>
                      <td className="px-5 py-3 text-sm text-amber-600 dark:text-amber-400 print:text-black text-center font-bold bg-amber-50/30 dark:bg-amber-500/5">{r.Sakit || '-'}</td>
                      <td className="px-5 py-3 text-sm text-blue-600 dark:text-blue-400 print:text-black text-center font-bold bg-blue-50/30 dark:bg-blue-500/5">{r.Izin || '-'}</td>
                      <td className="px-5 py-3 text-sm text-rose-600 dark:text-rose-400 print:text-black text-center font-bold bg-rose-50/30 dark:bg-rose-500/5">{r.Alfa || '-'}</td>
                      <td className="px-5 py-3 text-sm text-purple-600 dark:text-purple-400 print:text-black text-center font-bold bg-purple-50/30 dark:bg-purple-500/5">{r.Dispen || '-'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * { visibility: hidden; }
          .print\\:text-black { color: #000 !important; }
          .print\\:bg-white { background-color: #fff !important; }
          .print\\:bg-gray-200 { background-color: #e5e7eb !important; }
          table, table * { visibility: visible; }
          table { position: absolute; left: 0; top: 0; width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #000; padding: 8px; }
          th { background: #eee !important; -webkit-print-color-adjust: exact; }
          .print\\:hidden { display: none !important; }
        }
      `}} />
    </div>
  );
}
