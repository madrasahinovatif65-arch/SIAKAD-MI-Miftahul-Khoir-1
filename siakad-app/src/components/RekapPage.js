'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import useSWR from 'swr';
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { id } from 'date-fns/locale/id';

registerLocale('id', id);

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
  
  // Ambil daftar rombel untuk Admin
  useEffect(() => {
    async function fetchRombel() {
      const { data } = await supabase.from('master_user').select('rombel').eq('role', 'Murid');
      if (data) {
        const unique = [...new Set(data.map(d => d.rombel).filter(Boolean))].sort();
        setRombelOptions(unique);
      }
    }
    if (user?.role === 'Admin') fetchRombel();
  }, [user]);

  const { data: swrData, isLoading: loading } = useSWR(tglMulai && tglAkhir && rombel ? `rekap_${rombel}_${tglMulai}_${tglAkhir}` : null, async () => {
    // 1. Ambil data murid
    let queryMurid = supabase.from('master_user').select('*').eq('role', 'Murid').eq('status_aktif', 'Aktif');
    if (rombel !== 'Semua') {
      queryMurid = queryMurid.eq('rombel', rombel);
    }
    const { data: murid } = await queryMurid.order('rombel').order('nama');

    // 2. Ambil data absensi di rentang tanggal
    let queryAbsen = supabase.from('data_absensi').select('nisn, tanggal, status, rombel').gte('tanggal', tglMulai).lte('tanggal', tglAkhir);
    if (rombel !== 'Semua') {
      queryAbsen = queryAbsen.eq('rombel', rombel);
    }
    const { data: absensi } = await queryAbsen;

    // 3. Proses rekap
    const rekap = {};
    (murid || []).forEach(m => {
      rekap[m.id_user] = { Hadir: 0, Sakit: 0, Izin: 0, Alfa: 0, detail: {} };
    });

    (absensi || []).forEach(a => {
      if (rekap[a.nisn] && rekap[a.nisn][a.status] !== undefined) {
        rekap[a.nisn][a.status] += 1;
        rekap[a.nisn].detail[a.tanggal] = a.status.charAt(0); // H, S, I, A
      }
    });

    return { muridData: murid || [], rekapData: rekap };
  });

  const muridData = swrData?.muridData || [];
  const rekapData = swrData?.rekapData || {};

  const handleExportExcel = () => {
    let csv = 'NISN,Nama Murid,Rombel,Hadir,Sakit,Izin,Alfa\\n';
    muridData.forEach(m => {
      const r = rekapData[m.id_user] || { Hadir: 0, Sakit: 0, Izin: 0, Alfa: 0 };
      csv += `"${m.id_user}","${m.nama}","${m.rombel}",${r.Hadir},${r.Sakit},${r.Izin},${r.Alfa}\\n`;
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

  const formatDateString = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 relative">
      <div className="print:hidden space-y-6 sm:space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
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
        <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-3xl p-4 sm:p-6 shadow-sm">
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
            {user?.role === 'Admin' && (
              <div className="relative w-full sm:w-auto">
                <select value={rombel} onChange={e => setRombel(e.target.value)}
                  style={{ backgroundImage: 'none' }}
                  className="appearance-none w-full sm:w-auto pl-4 pr-10 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-sm">
                  <option value="Semua" className="bg-white dark:bg-slate-900">Semua Rombel</option>
                  {rombelOptions.map(r => (
                    <option key={r} value={r} className="bg-white dark:bg-slate-900">{r}</option>
                  ))}
                </select>
                <svg className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="print-container">
        {/* Header Print */}
        <div className="hidden print:block mb-8">
          <div className="flex items-center gap-6 mb-4 border-b-[3px] border-black pb-4 relative">
            <img src="/logo.png" alt="Logo" className="w-24 h-24 object-contain" />
            <div className="flex-1 text-center">
              <h3 className="text-xl font-bold text-slate-800 tracking-tight">Yayasan NU Miftakhul Khoir Damarjati</h3>
              <h2 className="text-3xl font-bold text-green-700 tracking-tight mt-1">MI Miftahul Khoir 1 Karangrejo</h2>
              <p className="text-xs text-slate-600 mt-2 tracking-wide font-medium">NPSN: 60716857 | Jl. Sumber Keling No. 11, Dsn. Krajan, Ds. Karangrejo, Kec. Purwosari, Kabupaten Pasuruan</p>
            </div>
            <div className="absolute bottom-0 left-0 w-full border-b border-black mt-1"></div>
          </div>
          
          <div className="text-center mt-6 mb-8">
            <h3 className="text-lg font-bold text-slate-800">Laporan Rekapitulasi Presensi Bulanan</h3>
            <p className="text-sm text-slate-600 mt-1">Periode: {formatDateString(tglMulai)} s.d. {formatDateString(tglAkhir)}</p>
            <p className="text-sm text-slate-600 mt-0.5">Kelas/Rombel: <span className="font-bold text-green-700">{rombel}</span></p>
          </div>
          
          <h4 className="font-bold text-green-800 text-sm mb-3 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
            </svg>
            1. REKAPITULASI KEHADIRAN SISWA
          </h4>
        </div>

        {/* Tabel */}
        <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-3xl overflow-hidden shadow-sm print:border-none print:shadow-none print:rounded-none print:bg-transparent">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse print:text-black print:bg-white">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 print:bg-gray-200 print:border-black">
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
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5 print:divide-black/20">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-500 dark:text-slate-400 font-medium print:hidden">Memuat data...</td>
                  </tr>
                ) : muridData.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-500 dark:text-slate-400 font-medium">Tidak ada data murid di rentang tanggal & rombel ini.</td>
                  </tr>
                ) : (
                  muridData.map((m, idx) => {
                    const r = rekapData[m.id_user] || { Hadir: 0, Sakit: 0, Izin: 0, Alfa: 0 };
                    return (
                      <tr key={m.id_user} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors group print:hover:bg-transparent">
                        <td className="px-5 py-3 text-sm text-slate-500 dark:text-slate-400 print:text-black">{idx + 1}</td>
                        <td className="px-5 py-3 text-sm text-slate-400 dark:text-slate-500 font-mono print:text-black">{m.id_user}</td>
                        <td className="px-5 py-3 text-sm text-slate-800 dark:text-white print:text-black font-semibold">{m.nama}</td>
                        {rombel === 'Semua' && (
                          <td className="px-5 py-3 text-sm text-slate-500 dark:text-slate-400 print:text-black">
                            <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-md text-xs font-bold print:bg-transparent print:p-0">{m.rombel}</span>
                          </td>
                        )}
                        <td className="px-5 py-3 text-sm text-emerald-600 dark:text-emerald-400 print:text-black text-center font-bold bg-emerald-50/30 dark:bg-emerald-500/5 print:bg-transparent">{r.Hadir || '-'}</td>
                        <td className="px-5 py-3 text-sm text-amber-600 dark:text-amber-400 print:text-black text-center font-bold bg-amber-50/30 dark:bg-amber-500/5 print:bg-transparent">{r.Sakit || '-'}</td>
                        <td className="px-5 py-3 text-sm text-blue-600 dark:text-blue-400 print:text-black text-center font-bold bg-blue-50/30 dark:bg-blue-500/5 print:bg-transparent">{r.Izin || '-'}</td>
                        <td className="px-5 py-3 text-sm text-rose-600 dark:text-rose-400 print:text-black text-center font-bold bg-rose-50/30 dark:bg-rose-500/5 print:bg-transparent">{r.Alfa || '-'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Print */}
        <div className="hidden print:flex justify-between items-end mt-16 pt-8 px-12 text-center text-sm text-black">
          <div className="flex flex-col items-center">
            <p>Disiapkan Oleh,</p>
            <p className="font-bold uppercase mt-1">WALI KELAS {rombel === 'Semua' ? '...' : rombel},</p>
            <div className="mt-20 border-b border-black w-48 font-bold">Muhammad Ridwan, S.Pd.</div>
            <p className="mt-1">-</p>
          </div>
          <div className="flex flex-col items-center">
            <p>Mengetahui Kepala Madrasah,</p>
            <p className="font-bold uppercase mt-1">MI Miftahul Khoir 1 Karangrejo,</p>
            <div className="mt-20 border-b border-black w-56 font-bold">Nur Su`ud, S.Pd.I.</div>
            <p className="mt-1">-</p>
          </div>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { size: 215mm 330mm portrait; margin: 10mm; }
          body { background: white; -webkit-print-color-adjust: exact; }
          body * { visibility: hidden; }
          .print-container, .print-container * { visibility: visible; }
          .print-container { position: relative; left: 0; top: 0; width: 100%; margin-top: -10px; }
          table { border-collapse: collapse; width: 100%; margin-top: 10px; page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
          th, td { border: 1px solid #000; padding: 6px 8px; color: #000 !important; font-size: 11px; }
          th { background: #e2e8f0 !important; -webkit-print-color-adjust: exact; }
          .print\\:hidden { display: none !important; }
        }
      `}} />
    </div>
  );
}
