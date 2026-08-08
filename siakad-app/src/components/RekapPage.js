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

    // 4. Ambil data Wali Kelas
    let waliKelasData = null;
    if (rombel !== 'Semua') {
      const { data: guru } = await supabase.from('master_user').select('nama').eq('role', 'Guru').eq('rombel', rombel).maybeSingle();
      if (guru) {
        waliKelasData = guru.nama;
      }
    }

    return { muridData: murid || [], rekapData: rekap, waliKelas: waliKelasData };
  });

  const muridData = swrData?.muridData || [];
  const rekapData = swrData?.rekapData || {};
  const waliKelasName = swrData?.waliKelas || '.............................................';

  const formatDateString = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  const handleExportWord = () => {
    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"><title>Rekapitulasi Presensi</title></head>
      <body style="font-family: Arial, sans-serif;">
        
        <table style="width: 100%; border-bottom: 3px solid black; margin-bottom: 20px; border-collapse: collapse;">
          <tr>
            <td style="width: 15%; text-align: left; vertical-align: middle;">
              <!-- Placeholder untuk logo -->
            </td>
            <td style="width: 85%; text-align: center; vertical-align: middle;">
              <h3 style="margin: 0; font-size: 16pt;">Yayasan NU Miftakhul Khoir Damarjati</h3>
              <h2 style="margin: 0; font-size: 20pt; color: #15803d;">MI Miftahul Khoir 1 Karangrejo</h2>
              <p style="margin: 5px 0 0 0; font-size: 9pt;">NPSN: 60716857 | Jl. Sumber Keling No. 11, Dsn. Krajan, Ds. Karangrejo, Kec. Purwosari, Kabupaten Pasuruan</p>
            </td>
          </tr>
        </table>
        
        <div style="text-align: center; margin-bottom: 20px;">
          <h3 style="margin: 0; font-size: 14pt;">Laporan Rekapitulasi Presensi Bulanan</h3>
          <p style="margin: 5px 0;">Periode: ${formatDateString(tglMulai)} s.d. ${formatDateString(tglAkhir)}</p>
          <p style="margin: 0;">Kelas/Rombel: <b>${rombel}</b></p>
        </div>

        <h4 style="color: #166534; font-size: 11pt; margin-bottom: 10px;">1. REKAPITULASI KEHADIRAN SISWA</h4>

        <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 100%; font-size: 10pt; text-align: center;">
          <thead>
            <tr style="background-color: #e2e8f0;">
              <th style="width: 5%;">No</th>
              <th style="text-align: left;">Nama Murid</th>
              ${rombel === 'Semua' ? '<th>Rombel</th>' : ''}
              <th>Hadir</th>
              <th>Sakit</th>
              <th>Izin</th>
              <th>Alfa</th>
              <th>Total</th>
              <th>Persentase</th>
            </tr>
          </thead>
          <tbody>
    `;

    muridData.forEach((m, idx) => {
      const r = rekapData[m.id_user] || { Hadir: 0, Sakit: 0, Izin: 0, Alfa: 0 };
      const hadir = r.Hadir || 0;
      const sakit = r.Sakit || 0;
      const izin = r.Izin || 0;
      const alfa = r.Alfa || 0;
      const total = hadir + sakit + izin + alfa;
      const persentase = total > 0 ? ((hadir / total) * 100).toFixed(1) + '%' : '-';

      html += `
        <tr>
          <td>${idx + 1}</td>
          <td style="text-align: left;">${m.nama}</td>
          ${rombel === 'Semua' ? `<td>${m.rombel}</td>` : ''}
          <td>${hadir || '-'}</td>
          <td>${sakit || '-'}</td>
          <td>${izin || '-'}</td>
          <td>${alfa || '-'}</td>
          <td>${total || '-'}</td>
          <td>${persentase}</td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
        <br><br><br>
        <table style="width: 100%; text-align: center; border: none; font-size: 11pt;">
          <tr>
            <td style="width: 50%; border: none;">
              <p>Disiapkan Oleh,</p>
              <p><b>WALI KELAS ${rombel === 'Semua' ? '...' : rombel}</b></p>
              <br><br><br>
              <p><b><u>${waliKelasName}</u></b></p>
              <p style="margin-top: 0;">-</p>
            </td>
            <td style="width: 50%; border: none;">
              <p>Mengetahui Kepala Madrasah,</p>
              <p><b>MI Miftahul Khoir 1 Karangrejo</b></p>
              <br><br><br>
              <p><b><u>Nur Su'ud, S.Pd.I.</u></b></p>
              <p style="margin-top: 0;">-</p>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob(['\\ufeff', html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Rekap_Absensi_${rombel}_${tglMulai}_sd_${tglAkhir}.doc`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
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
            <button onClick={handleExportWord}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 rounded-xl text-sm font-semibold transition-all shadow-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
              Export Word
            </button>
            <button onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 rounded-xl text-sm font-semibold transition-all shadow-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0v3.396c0 .63.508 1.141 1.141 1.141h8.218c.633 0 1.141-.51 1.141-1.141V8.25Z" />
              </svg>
              Print Cetak
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
        <div className="hidden print:block mb-6 pt-2">
          <div className="flex items-center gap-6 mb-4 border-b-[3px] border-black pb-4 relative">
            <img src="/logo.png" alt="Logo" className="w-24 h-24 object-contain" />
            <div className="flex-1 text-center">
              <h3 className="text-xl font-bold text-slate-800 tracking-tight">Yayasan NU Miftakhul Khoir Damarjati</h3>
              <h2 className="text-3xl font-bold text-green-700 tracking-tight mt-1">MI Miftahul Khoir 1 Karangrejo</h2>
              <p className="text-xs text-slate-600 mt-2 tracking-wide font-medium">NPSN: 60716857 | Jl. Sumber Keling No. 11, Dsn. Krajan, Ds. Karangrejo, Kec. Purwosari, Kabupaten Pasuruan</p>
            </div>
            <div className="absolute bottom-0 left-0 w-full border-b border-black mt-1"></div>
          </div>
          
          <div className="text-center mt-6 mb-6">
            <h3 className="text-lg font-bold text-slate-800">Laporan Rekapitulasi Presensi Bulanan</h3>
            <p className="text-sm text-slate-600 mt-1">Periode: {formatDateString(tglMulai)} s.d. {formatDateString(tglAkhir)}</p>
            <p className="text-sm text-slate-600 mt-0.5">Kelas/Rombel: <span className="font-bold text-green-700">{rombel}</span></p>
          </div>
          
          <h4 className="font-bold text-green-800 text-sm mb-3 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
            </svg>
            1. REKAPITULASI KEHADIRAN SISWA
          </h4>
        </div>

        {/* Tabel */}
        <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-3xl overflow-hidden shadow-sm print:border-none print:shadow-none print:rounded-none print:bg-transparent print:overflow-visible">
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full text-left border-collapse print:text-black print:bg-white print:table-fixed">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 print:bg-gray-200 print:border-black">
                  <th className="px-5 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 print:text-black uppercase tracking-wider text-center print:w-[5%]">No</th>
                  <th className="px-5 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 print:text-black uppercase tracking-wider col-nama">Nama Murid</th>
                  {rombel === 'Semua' && (
                    <th className="px-5 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 print:text-black uppercase tracking-wider print:w-[10%]">Rombel</th>
                  )}
                  <th className="px-5 py-4 text-xs font-bold text-emerald-600 dark:text-emerald-400 print:text-black text-center uppercase tracking-wider print:w-[5%]">Hadir</th>
                  <th className="px-5 py-4 text-xs font-bold text-amber-600 dark:text-amber-400 print:text-black text-center uppercase tracking-wider print:w-[5%]">Sakit</th>
                  <th className="px-5 py-4 text-xs font-bold text-blue-600 dark:text-blue-400 print:text-black text-center uppercase tracking-wider print:w-[5%]">Izin</th>
                  <th className="px-5 py-4 text-xs font-bold text-rose-600 dark:text-rose-400 print:text-black text-center uppercase tracking-wider print:w-[5%]">Alfa</th>
                  <th className="px-5 py-4 text-xs font-bold text-purple-600 dark:text-purple-400 print:text-black text-center uppercase tracking-wider print:w-[6%]">Total</th>
                  <th className="px-5 py-4 text-xs font-bold text-indigo-600 dark:text-indigo-400 print:text-black text-center uppercase tracking-wider print:w-[8%]">%</th>
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
                  <>
                    {muridData.map((m, idx) => {
                      const r = rekapData[m.id_user] || { Hadir: 0, Sakit: 0, Izin: 0, Alfa: 0 };
                      const hadir = r.Hadir || 0;
                      const sakit = r.Sakit || 0;
                      const izin = r.Izin || 0;
                      const alfa = r.Alfa || 0;
                      const total = hadir + sakit + izin + alfa;
                      const persentase = total > 0 ? ((hadir / total) * 100).toFixed(1) + '%' : '-';

                      return (
                        <tr key={m.id_user} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors group print:hover:bg-transparent">
                          <td className="px-5 py-3 text-sm text-slate-500 dark:text-slate-400 print:text-black print:px-2 print:py-2 text-center">{idx + 1}</td>
                          <td className="px-5 py-3 text-sm text-slate-800 dark:text-white print:text-black font-semibold print:px-2 print:py-2 col-nama">{m.nama}</td>
                          {rombel === 'Semua' && (
                            <td className="px-5 py-3 text-sm text-slate-500 dark:text-slate-400 print:text-black print:px-2 print:py-2">
                              <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-md text-xs font-bold print:bg-transparent print:p-0">{m.rombel}</span>
                            </td>
                          )}
                          <td className="px-5 py-3 text-sm text-emerald-600 dark:text-emerald-400 print:text-black text-center font-bold bg-emerald-50/30 dark:bg-emerald-500/5 print:bg-transparent print:px-2 print:py-2">{hadir || '-'}</td>
                          <td className="px-5 py-3 text-sm text-amber-600 dark:text-amber-400 print:text-black text-center font-bold bg-amber-50/30 dark:bg-amber-500/5 print:bg-transparent print:px-2 print:py-2">{sakit || '-'}</td>
                          <td className="px-5 py-3 text-sm text-blue-600 dark:text-blue-400 print:text-black text-center font-bold bg-blue-50/30 dark:bg-blue-500/5 print:bg-transparent print:px-2 print:py-2">{izin || '-'}</td>
                          <td className="px-5 py-3 text-sm text-rose-600 dark:text-rose-400 print:text-black text-center font-bold bg-rose-50/30 dark:bg-rose-500/5 print:bg-transparent print:px-2 print:py-2">{alfa || '-'}</td>
                          <td className="px-5 py-3 text-sm text-purple-600 dark:text-purple-400 print:text-black text-center font-bold bg-purple-50/30 dark:bg-purple-500/5 print:bg-transparent print:px-2 print:py-2">{total || '-'}</td>
                          <td className="px-5 py-3 text-sm text-indigo-600 dark:text-indigo-400 print:text-black text-center font-bold bg-indigo-50/30 dark:bg-indigo-500/5 print:bg-transparent print:px-2 print:py-2">{persentase}</td>
                        </tr>
                      );
                    })}
                    {/* Baris Tanda Tangan Menyatu dengan Tabel (Tanpa Border) */}
                    <tr className="print:table-row hidden print-no-border">
                      <td colSpan={rombel === 'Semua' ? 9 : 8} className="pt-12 pb-8">
                        <div className="flex justify-between items-end px-12 text-center text-sm text-black w-full">
                          <div className="flex flex-col items-center">
                            <p>Disiapkan Oleh,</p>
                            <p className="font-bold uppercase mt-1">WALI KELAS {rombel === 'Semua' ? '...' : rombel},</p>
                            <div className="mt-20 border-b border-black w-48 font-bold whitespace-normal break-words">{waliKelasName}</div>
                            <p className="mt-1">-</p>
                          </div>
                          <div className="flex flex-col items-center">
                            <p>Mengetahui Kepala Madrasah,</p>
                            <p className="font-bold uppercase mt-1">MI Miftahul Khoir 1 Karangrejo,</p>
                            <div className="mt-20 border-b border-black w-56 font-bold">Nur Su'ud, S.Pd.I.</div>
                            <p className="mt-1">-</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { size: 215mm 330mm portrait; margin: 10mm; }
          body { background: white; -webkit-print-color-adjust: exact; }
          body * { visibility: hidden; }
          .print-container, .print-container * { visibility: visible; }
          .print-container { position: relative; left: 0; top: 0; width: 100%; }
          table { border-collapse: collapse; width: 100%; margin-top: 10px; page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
          
          /* Kolom mengecil sesuai isi teks agar menghemat tempat, kecuali kolom nama */
          th, td { border: 1px solid #000; padding: 6px 10px; color: #000 !important; font-size: 11px; white-space: nowrap; }
          
          /* Kolom Nama Murid akan melar dan wrap text */
          .col-nama { white-space: normal !important; width: auto !important; word-wrap: break-word; }
          
          th { background: #e2e8f0 !important; -webkit-print-color-adjust: exact; }
          
          /* Hilangkan border pada baris khusus TTD */
          .print-no-border, .print-no-border td { border: none !important; }

          .print\\:hidden { display: none !important; }
        }
      `}} />
    </div>
  );
}
