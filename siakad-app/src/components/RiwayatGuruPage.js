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
  const [selectedHistory, setSelectedHistory] = useState(null);
  
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
        rekap[g.id_user] = { Hadir: 0, Sakit: 0, Izin: 0, Alfa: 0, detail: {}, history: { Sakit: [], Izin: [], Alfa: [] } };
      });

      (verData || []).forEach(v => {
        if (rekap[v.id_guru] && rekap[v.id_guru][v.status] !== undefined) {
          rekap[v.id_guru][v.status] += 1;
          rekap[v.id_guru].detail[v.tanggal] = v.status.charAt(0);
          if (['Sakit', 'Izin', 'Alfa'].includes(v.status)) {
            rekap[v.id_guru].history[v.status].push(v);
          }
        }
      }); return { guruList: guruData || [], rekapData: rekap, type: 'rekap' };
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

  const formatDateString = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  const getDynamicPadding = () => {
    let count = 0;
    if (isAdmin && swrData?.type === 'rekap') count = swrData.guruList.length;
    else if (!isAdmin && swrData?.type === 'history') count = swrData.history.length;
    
    if (count === 0) return '6px';
    if (count <= 20) return '8px 6px';
    if (count <= 25) return '6px 6px';
    if (count <= 28) return '5px 6px';
    return '4px 6px';
  };

  const handleExportWord = () => {
    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <title>Export Word</title>
        <style>
          @page { margin: 1.0cm 1.0cm 1.0cm 1.5cm; }
          body { font-family: 'Times New Roman', serif; font-size: 11pt; }
          .header { text-align: center; margin-bottom: 20px; border-bottom: 3px solid black; padding-bottom: 10px; }
          .header h3 { margin: 0; font-size: 14pt; }
          .header h2 { margin: 0; font-size: 18pt; color: #15803d; }
          .header p { margin: 5px 0 0 0; font-size: 9pt; }
          .title-doc { text-align: center; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid black; padding: 5px; text-align: center; }
          .text-left { text-align: left; }
        </style>
      </head>
      <body>
        <div class="header">
          <h3>Yayasan NU Miftakhul Khoir Damarjati</h3>
          <h2>MI Miftahul Khoir 1 Karangrejo</h2>
          <p>NPSN: 60716857 | Jl. Sumber Keling No. 11, Dsn. Krajan, Ds. Karangrejo, Kec. Purwosari, Kab. Pasuruan</p>
        </div>
        
        <div class="title-doc">
          <h3>Laporan Rekapitulasi Presensi Guru</h3>
          <p>Periode: ${formatDateString(tglMulai)} s.d. ${formatDateString(tglAkhir)}</p>
          ${!isAdmin ? `<p>Nama Guru: <b>${user?.nama || ''}</b></p>` : ''}
        </div>
        
        <table>
          <thead>
    `;
    
    if (isAdmin) {
      html += `
        <tr>
          <th>No</th>
          <th>Nama Guru</th>
          <th>Hadir</th>
          <th>Sakit</th>
          <th>Izin</th>
          <th>Alfa</th>
          <th>Total</th>
          <th>%</th>
        </tr>
      </thead><tbody>
      `;
      if (swrData?.guruList?.length > 0) {
        swrData.guruList.forEach((guru, idx) => {
          const r = swrData.rekapData[guru.id_user];
          const hadir = r.Hadir || 0;
          const sakit = r.Sakit || 0;
          const izin = r.Izin || 0;
          const alfa = r.Alfa || 0;
          const total = hadir + sakit + izin + alfa;
          const persen = total === 0 ? 0 : Math.round((hadir / total) * 100);
          
          html += `
            <tr>
              <td style="width: 5%;">${idx + 1}</td>
              <td class="text-left">${guru.nama}</td>
              <td>${hadir || '-'}</td>
              <td>${sakit || '-'}</td>
              <td>${izin || '-'}</td>
              <td>${alfa || '-'}</td>
              <td>${total || '-'}</td>
              <td>${persen > 0 ? persen + '%' : '-'}</td>
            </tr>
          `;
        });
      }
    } else {
      html += `
        <tr>
          <th>Tanggal</th>
          <th>Waktu</th>
          <th>Metode</th>
          <th>Status</th>
          <th>Catatan</th>
        </tr>
      </thead><tbody>
      `;
      if (swrData?.history?.length > 0) {
        swrData.history.forEach((row) => {
          html += `
            <tr>
              <td>${formatDate(row.tanggal)}</td>
              <td>${row.waktu}</td>
              <td>${row.metode || 'GPS'}</td>
              <td>${row.status}</td>
              <td>${row.catatan || '-'}</td>
            </tr>
          `;
        });
      }
    }

    html += `
          </tbody>
        </table>
        
        <br><br><br>
        <table style="width: 100%; text-align: center; border: none; font-size: 11pt;">
          <tr>
            <td style="width: 50%; border: none;">
              <p style="color: transparent;">.</p>
              <p>Disiapkan Oleh,</p>
              <p><b>STAF TATA USAHA</b></p>
              <br><br><br><br>
              <p><b><u>.......................................</u></b></p>
              <p style="margin-top: 0;">-</p>
            </td>
            <td style="width: 50%; border: none;">
              <p>Karangrejo, ${formatDateString(new Date().toISOString())}</p>
              <p>Mengetahui Kepala Madrasah,</p>
              <p><b>MI Miftahul Khoir 1 Karangrejo</b></p>
              <br><br><br><br>
              <p><b><u>Nur Su'ud, S.Pd.I.</u></b></p>
              <p style="margin-top: 0;">-</p>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Laporan_Guru_${isAdmin ? 'Rekap' : 'Riwayat'}_${tglMulai}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
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
            <button onClick={handleExportWord}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 rounded-xl text-sm font-semibold transition-all shadow-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
              Export Word
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

      <div className="print-container">
        {/* Header Print */}
        <div className="hidden print:block mb-4">
          <div className="flex items-center gap-4 mb-2 border-b-[3px] border-black pb-2 relative">
            <img src="/logo.png" alt="Logo" className="w-20 h-20 object-contain" />
            <div className="flex-1 text-center">
              <h3 className="text-lg font-bold text-slate-800 tracking-tight">Yayasan NU Miftakhul Khoir Damarjati</h3>
              <h2 className="text-2xl font-bold text-green-700 tracking-tight mt-0.5">MI Miftahul Khoir 1 Karangrejo</h2>
              <p className="text-[10px] text-slate-600 mt-1 tracking-wide font-medium">NPSN: 60716857 | Jl. Sumber Keling No. 11, Dsn. Krajan, Ds. Karangrejo, Kec. Purwosari, Kabupaten Pasuruan</p>
            </div>
            <div className="absolute bottom-0 left-0 w-full border-b border-black mt-0.5"></div>
          </div>
          
          <div className="text-center mt-3 mb-3">
            <h3 className="text-base font-bold text-slate-800">Laporan Rekapitulasi Presensi Guru</h3>
            <p className="text-xs text-slate-600 mt-0.5">Periode: {formatDateString(tglMulai)} s.d. {formatDateString(tglAkhir)}</p>
            {!isAdmin && <p className="text-xs text-slate-600 mt-0.5">Nama Guru: <span className="font-bold text-green-700">{user?.nama}</span></p>}
          </div>
          
          <h4 className="font-bold text-green-800 text-[11px] mb-2 flex items-center gap-2">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
            </svg>
            REKAPITULASI KEHADIRAN GURU
          </h4>
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
        <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-3xl overflow-hidden shadow-sm print:border-none print:shadow-none print:rounded-none print:bg-transparent print:overflow-visible">
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full text-left border-collapse print:text-black print:bg-white print:table-auto">
              <thead>
                {isAdmin ? (
                  <tr className="bg-slate-50/80 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 print:bg-gray-200 print:border-black/50">
                    <th className="px-5 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 print:text-black uppercase tracking-wider text-center">No</th>
                    <th className="px-5 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 print:text-black uppercase tracking-wider col-nama">Nama Guru</th>
                    <th className="px-5 py-4 text-xs font-bold text-emerald-600 dark:text-emerald-400 print:text-black text-center uppercase tracking-wider">Hadir</th>
                    <th className="px-5 py-4 text-xs font-bold text-amber-600 dark:text-amber-400 print:text-black text-center uppercase tracking-wider">Sakit</th>
                    <th className="px-5 py-4 text-xs font-bold text-emerald-600 dark:text-emerald-400 print:text-black text-center uppercase tracking-wider">Izin</th>
                    <th className="px-5 py-4 text-xs font-bold text-red-600 dark:text-red-400 print:text-black text-center uppercase tracking-wider">Alfa</th>
                    <th className="px-5 py-4 text-xs font-bold text-purple-600 dark:text-purple-400 print:text-black text-center uppercase tracking-wider">Total</th>
                    <th className="px-5 py-4 text-xs font-bold text-indigo-600 dark:text-indigo-400 print:text-black text-center uppercase tracking-wider">%</th>
                  </tr>
                ) : (
                  <tr className="bg-slate-50/80 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 print:bg-gray-200 print:border-black/50">
                    <th className="px-5 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 print:text-black uppercase tracking-wider">Tanggal</th>
                    <th className="px-5 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 print:text-black uppercase tracking-wider">Waktu</th>
                    <th className="px-5 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 print:text-black uppercase tracking-wider">Metode</th>
                    <th className="px-5 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 print:text-black uppercase tracking-wider">Status</th>
                    <th className="px-5 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 print:text-black uppercase tracking-wider col-nama">Catatan</th>
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5 print:divide-black/20">
                {isAdmin && swrData?.type === 'rekap' ? (
                  swrData.guruList.length > 0 ? (
                    swrData.guruList.map((guru, idx) => {
                      const r = swrData.rekapData[guru.id_user];
                      const hadir = r.Hadir || 0;
                      const sakit = r.Sakit || 0;
                      const izin = r.Izin || 0;
                      const alfa = r.Alfa || 0;
                      const total = hadir + sakit + izin + alfa;
                      const persen = total === 0 ? 0 : Math.round((hadir / total) * 100);
                      
                      return (
                        <tr key={guru.id_user} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                          <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300 print:text-black text-center">{idx + 1}</td>
                          <td className="px-5 py-4 text-sm font-medium text-slate-900 dark:text-white print:text-black col-nama">{guru.nama}</td>
                          <td className="px-5 py-4 text-sm text-center font-bold text-emerald-600 dark:text-emerald-400 print:text-black">{hadir || '-'}</td>
                          <td className="px-5 py-4 text-sm text-center font-bold text-amber-600 dark:text-amber-400 print:text-black">
                            {sakit > 0 ? (
                              <button onClick={() => setSelectedHistory({ type: 'Sakit', name: guru.nama, data: r.history.Sakit })} className="hover:underline hover:text-amber-800 dark:hover:text-amber-300 w-full print:pointer-events-none">{sakit}</button>
                            ) : '-'}
                          </td>
                          <td className="px-5 py-4 text-sm text-center font-bold text-blue-600 dark:text-blue-400 print:text-black">
                            {izin > 0 ? (
                              <button onClick={() => setSelectedHistory({ type: 'Izin', name: guru.nama, data: r.history.Izin })} className="hover:underline hover:text-blue-800 dark:hover:text-blue-300 w-full print:pointer-events-none">{izin}</button>
                            ) : '-'}
                          </td>
                          <td className="px-5 py-4 text-sm text-center font-bold text-red-600 dark:text-red-400 print:text-black">
                            {alfa > 0 ? (
                              <button onClick={() => setSelectedHistory({ type: 'Alfa', name: guru.nama, data: r.history.Alfa })} className="hover:underline hover:text-red-800 dark:hover:text-red-300 w-full print:pointer-events-none">{alfa}</button>
                            ) : '-'}
                          </td>
                          <td className="px-5 py-4 text-sm text-center font-bold text-purple-600 dark:text-purple-400 print:text-black">{total || '-'}</td>
                          <td className="px-5 py-4 text-sm text-center font-bold text-indigo-600 dark:text-indigo-400 print:text-black">{persen > 0 ? persen + '%' : '-'}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr><td colSpan="9" className="text-center py-12 text-slate-500 dark:text-slate-400">Belum ada data</td></tr>
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
                {/* Baris Tanda Tangan Menyatu dengan Tabel (Tanpa Border) */}
                {!loading && (
                  <tr className="print:table-row hidden print-no-border">
                    <td colSpan={isAdmin ? 8 : 5} className="pt-12 pb-2">
                      <div className="flex justify-between items-end px-12 text-center text-xs text-black w-full">
                        <div className="flex flex-col items-center">
                          <p className="text-transparent select-none">.</p>
                          <p>Disiapkan Oleh,</p>
                          <p className="font-bold uppercase mt-1">STAF TATA USAHA,</p>
                          <div className="mt-20 inline-block border-b border-black font-bold whitespace-nowrap break-words px-2">.......................................</div>
                          <p className="mt-1">-</p>
                        </div>
                        <div className="flex flex-col items-center">
                          <p>Karangrejo, {formatDateString(new Date().toISOString())}</p>
                          <p>Mengetahui Kepala Madrasah,</p>
                          <p className="font-bold uppercase mt-1">MI Miftahul Khoir 1 Karangrejo,</p>
                          <div className="mt-20 inline-block border-b border-black font-bold whitespace-nowrap break-words px-2">Nur Su'ud, S.Pd.I.</div>
                          <p className="mt-1">-</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </div>

      {/* Modal Riwayat Detail */}
      {selectedHistory && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm print:hidden">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-slate-200 dark:border-white/10">
              <div>
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">Detail {selectedHistory.type}</h3>
                <p className="text-sm text-slate-500">{selectedHistory.name}</p>
              </div>
              <button onClick={() => setSelectedHistory(null)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 rounded-full transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-5 max-h-[60vh] overflow-y-auto">
              {selectedHistory.data.length === 0 ? (
                 <p className="text-center text-slate-500 py-4">Tidak ada catatan</p>
              ) : (
                <div className="space-y-3">
                   {selectedHistory.data.map((item, i) => (
                      <div key={i} className="flex flex-col p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-white/5">
                         <span className="font-mono text-xs font-semibold text-slate-600 dark:text-slate-300">{formatDate(item.tanggal)}</span>
                         <span className="text-sm text-slate-800 dark:text-white mt-1">{item.catatan || '-'}</span>
                      </div>
                   ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body { background: white; }
          @page { size: 215.9mm 330.2mm; margin: 10mm 10mm 10mm 15mm; }
          body * { visibility: hidden; }
          .print\\:hidden { display: none !important; }
          .print-container, .print-container * { visibility: visible; }
          .print-container { position: absolute; left: 0; top: 0; width: 100%; }
          
          table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
          thead { display: table-header-group; }
          
          /* Kolom mengecil sesuai isi teks agar menghemat tempat, kecuali kolom nama */
          th, td { border: 1px solid #000; padding: ${getDynamicPadding()}; color: #000 !important; font-size: 10px; white-space: nowrap; }
          
          /* Kolom Nama Guru akan melar dan wrap text */
          .col-nama { white-space: normal !important; width: auto !important; word-wrap: break-word; }
          
          /* Hilangkan border khusus untuk baris tanda tangan */
          tr.print-no-border > td { border: none !important; }
        }
      `}} />
    </div>
  );
}
