'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import useSWR from 'swr';
import { useIsMobile } from '@/hooks/useIsMobile';
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import 'react-datepicker/dist/react-datepicker.css';
import { id } from 'date-fns/locale/id';
import { getTahunPelajaran, getTodayDate } from '@/lib/dateUtils';
import * as XLSX from 'xlsx';

registerLocale('id', id);

export default function RekapPage() {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const [tglMulai, setTglMulai] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [tglAkhir, setTglAkhir] = useState(() => {
    return getTodayDate();
  });
  const [rombel, setRombel] = useState(user?.role === 'Admin' || user?.role === 'Guru Mapel' ? 'Semua' : user?.rombel || '');
  const [rombelOptions, setRombelOptions] = useState([]);
  const [selectedHistory, setSelectedHistory] = useState(null);
  // Injeksi 3: Mode Toggle
  const [mode, setMode] = useState(user?.role === 'Guru Mapel' ? 'mapel' : 'harian'); // 'harian' | 'mapel'
  const [filterMapel, setFilterMapel] = useState('Semua');
  
  // Ambil daftar rombel untuk Admin dan Guru Mapel
  useEffect(() => {
    async function fetchRombel() {
      const { data } = await supabase.from('master_user').select('rombel').eq('role', 'Murid');
      if (data) {
        const unique = [...new Set(data.map(d => d.rombel).filter(Boolean))].sort();
        setRombelOptions(unique);
      }
    }
    if (user?.role === 'Admin' || user?.role === 'Guru Mapel') fetchRombel();
  }, [user]);

  useEffect(() => {
    if (user?.role === 'Guru Mapel') {
      setMode('mapel');
    }
  }, [user]);

  const { data: swrData, isLoading: loading } = useSWR(tglMulai && tglAkhir && rombel ? `rekap_${rombel}_${tglMulai}_${tglAkhir}` : null, async () => {
    // 1. Ambil data murid
    let queryMurid = supabase.from('master_user').select('*').eq('role', 'Murid').eq('status_aktif', 'Aktif');
    if (rombel !== 'Semua') {
      queryMurid = queryMurid.eq('rombel', rombel);
    }
    const { data: murid } = await queryMurid.order('rombel').order('nama');

    // 2. Ambil data libur untuk menghitung hari efektif
    const { data: masterKalender } = await supabase.from('master_kalender').select('tanggal, tipe_hari').gte('tanggal', tglMulai).lte('tanggal', tglAkhir);
    const liburSet = new Set((masterKalender || []).filter(k => k.tipe_hari === 'Libur').map(k => k.tanggal));
    
    let totalHariEfektif = 0;
    const dateMulai = new Date(tglMulai);
    const dateAkhir = new Date(tglAkhir);
    let currentDate = new Date(dateMulai);
    const validDates = [];
    while (currentDate <= dateAkhir) {
        const y = currentDate.getFullYear();
        const m = String(currentDate.getMonth() + 1).padStart(2, '0');
        const d = String(currentDate.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;
        if (currentDate.getDay() !== 0 && !liburSet.has(dateStr)) {
            totalHariEfektif++;
            validDates.push(dateStr);
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }

    // 3. Ambil data absensi dari view
    const { data: absensi } = await supabase.from('view_rekap_kehadiran_murid_final').select('*').gte('tanggal', tglMulai).lte('tanggal', tglAkhir);

    // 4. Proses rekap (Auto-Hadir)
    const rekap = {};
    (murid || []).forEach(m => {
      const detail = {};
      validDates.forEach(d => detail[d] = 'H'); // Asumsi default Hadir
      rekap[m.id_user] = { Hadir: totalHariEfektif, Sakit: 0, Izin: 0, Alfa: 0, detail, history: { Sakit: [], Izin: [], Alfa: [] } };
    });

    (absensi || []).forEach(a => {
      if (rekap[a.id_murid] && validDates.includes(a.tanggal)) {
        if (['Sakit', 'Izin', 'Alfa'].includes(a.status)) {
          rekap[a.id_murid][a.status] += 1;
          rekap[a.id_murid].Hadir -= 1;
          rekap[a.id_murid].detail[a.tanggal] = a.status.charAt(0); // S, I, A
          rekap[a.id_murid].history[a.status].push({ ...a, nisn: a.id_murid });
        }
      }
    });

    // 4. Ambil data Wali Kelas
    let waliKelasData = null;
    let waliKelasMap = {};
    if (rombel !== 'Semua') {
      const { data: guru } = await supabase.from('master_user').select('nama').in('role', ['Wali Kelas', 'Guru']).eq('rombel', rombel).maybeSingle();
      if (guru) {
        waliKelasData = guru.nama;
      }
    } else {
      const { data: gurus } = await supabase.from('master_user').select('nama, rombel').in('role', ['Wali Kelas', 'Guru']);
      if (gurus) {
        gurus.forEach(g => {
          if (g.rombel) waliKelasMap[g.rombel] = g.nama;
        });
      }
    }

    return { muridData: murid || [], rekapData: rekap, waliKelas: waliKelasData, waliKelasMap };
  });

  // Injeksi 3: Fetch daftar mapel + rekap mapel
  const { data: masterMapel } = useSWR('master_mapel_list', async () => {
    const { data } = await supabase.from('master_mapel').select('nama_mapel').order('nama_mapel');
    return (data || []).map(m => m.nama_mapel);
  });
  const mapelOptions = masterMapel || [];

  // Jika mode mapel: ambil jurnal + absensi mapel
  const rekapMapelKey = mode === 'mapel' && tglMulai && tglAkhir && rombel && filterMapel !== 'Semua'
    ? `rekap_mapel_${rombel}_${filterMapel}_${tglMulai}_${tglAkhir}` : null;
  const { data: rekapMapelData, isLoading: loadingMapel } = useSWR(rekapMapelKey, async () => {
    // 1. Ambil murid
    let qMurid = supabase.from('master_user').select('id_user, nama, rombel').eq('role', 'Murid').eq('status_aktif', 'Aktif');
    if (rombel !== 'Semua') qMurid = qMurid.eq('rombel', rombel);
    const { data: murid } = await qMurid.order('nama');
    // 2. Ambil jurnal untuk mapel + kelas
    let qJurnal = supabase.from('jurnal_guru').select('id, tanggal, jam_pelajaran, rombel, mata_pelajaran')
      .eq('mata_pelajaran', filterMapel).gte('tanggal', tglMulai).lte('tanggal', tglAkhir).order('tanggal');
    if (rombel !== 'Semua') qJurnal = qJurnal.eq('rombel', rombel);
    const { data: jurnal } = await qJurnal;
    if (!jurnal || jurnal.length === 0) return { murid: murid || [], jurnal: [], absenMap: {} };
    // 3. Ambil data_absensi_mapel untuk jurnal-jurnal tersebut
    const jurnalIds = jurnal.map(j => j.id);
    const { data: absen } = await supabase.from('data_absensi_mapel')
      .select('id_jurnal, nisn, status').in('id_jurnal', jurnalIds);
    const absenMap = {};
    (absen || []).forEach(a => {
      if (!absenMap[a.id_jurnal]) absenMap[a.id_jurnal] = {};
      absenMap[a.id_jurnal][a.nisn] = a.status;
    });
    return { murid: murid || [], jurnal, absenMap };
  });
  const muridData = swrData?.muridData || [];
  const rekapData = swrData?.rekapData || {};
  const waliKelasName = swrData?.waliKelas || '.............................................';
  const waliKelasMap = swrData?.waliKelasMap || {};

  const formatDateString = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  const getDynamicPadding = () => {
    const count = muridData.length;
    if (count === 0) return '6px';
    if (count <= 20) return '8px 6px';
    if (count <= 25) return '6px 6px';
    if (count <= 28) return '5px 6px';
    return '4px 6px';
  };

  const rombelsToPrint = rombel === 'Semua' ? rombelOptions : [rombel];

  const handleExportWord = () => {
    if (mode === 'mapel' && (!rekapMapelData || rekapMapelData.jurnal.length === 0)) {
      alert('Data rekap mapel tidak tersedia atau belum dipilih.');
      return;
    }

    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <title>Rekapitulasi Presensi</title>
        <style>@page { margin: 1.0cm 1.0cm 1.0cm 1.5cm; }</style>
      </head>
      <body style="font-family: Arial, sans-serif;">
    `;

    if (mode === 'harian') {
      rombelsToPrint.forEach((rName, rIdx) => {
        const rMuridData = rombel === 'Semua' ? muridData.filter(m => m.rombel === rName) : muridData;
        const rWaliName = rombel === 'Semua' ? (waliKelasMap[rName] || '.............................................') : waliKelasName;
        
        html += `
          <table style="width: 100%; border-bottom: 3px solid black; margin-bottom: 20px; border-collapse: collapse;">
            <tr>
              <td style="width: 15%; text-align: left; vertical-align: middle;"></td>
              <td style="width: 85%; text-align: center; vertical-align: middle;">
                <h3 style="margin: 0; font-size: 16pt;">Yayasan NU Miftakhul Khoir Damarjati</h3>
                <h2 style="margin: 0; font-size: 20pt; color: #15803d;">MI Miftahul Khoir 1 Karangrejo</h2>
                <p style="margin: 5px 0 0 0; font-size: 9pt;">NPSN: 60716857 | Jl. Sumber Keling No. 11, Dsn. Krajan, Ds. Karangrejo, Kec. Purwosari, Kabupaten Pasuruan</p>
              </td>
            </tr>
          </table>
          
          <div style="text-align: center; margin-bottom: 20px;">
            <h3 style="margin: 0; font-size: 14pt;">Laporan Rekapitulasi Presensi Bulanan</h3>
            <p style="margin: 5px 0 2px 0;">${getTahunPelajaran()}</p>
            <p style="margin: 2px 0;">Periode: ${formatDateString(tglMulai)} s.d. ${formatDateString(tglAkhir)}</p>
            <p style="margin: 0;">Kelas/Rombel: <b>${rName}</b></p>
          </div>

          <h4 style="color: #166534; font-size: 11pt; margin-bottom: 10px;">REKAPITULASI KEHADIRAN SISWA</h4>

          <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 100%; font-size: 10pt; text-align: center;">
            <thead>
              <tr style="background-color: #e2e8f0;">
                <th style="width: 5%;">No</th>
                <th style="text-align: left;">Nama Murid</th>
                <th>NISN</th>
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

        rMuridData.forEach((m, idx) => {
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
              <td>${m.id_user || '-'}</td>
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
                  <p style="color: transparent;">.</p>
                  <p>Disiapkan Oleh,</p>
                  <p><b>WALI KELAS ${rName}</b></p>
                  <br><br><br><br>
                  <p><b><u>${rWaliName}</u></b></p>
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
        `;

        if (rIdx < rombelsToPrint.length - 1) {
          html += `<br clear=all style='mso-special-character:line-break;page-break-before:always'>`;
        }
      });
    } else {
      // Mode Mapel
      const { murid: mapelMurid, jurnal: mapelJurnal, absenMap } = rekapMapelData;
      const rName = rombel === 'Semua' ? 'Semua Rombel' : rombel;

      html += `
        <table style="width: 100%; border-bottom: 3px solid black; margin-bottom: 20px; border-collapse: collapse;">
          <tr>
            <td style="width: 15%; text-align: left; vertical-align: middle;"></td>
            <td style="width: 85%; text-align: center; vertical-align: middle;">
              <h3 style="margin: 0; font-size: 16pt;">Yayasan NU Miftakhul Khoir Damarjati</h3>
              <h2 style="margin: 0; font-size: 20pt; color: #15803d;">MI Miftahul Khoir 1 Karangrejo</h2>
              <p style="margin: 5px 0 0 0; font-size: 9pt;">NPSN: 60716857 | Jl. Sumber Keling No. 11, Dsn. Krajan, Ds. Karangrejo, Kec. Purwosari, Kabupaten Pasuruan</p>
            </td>
          </tr>
        </table>
        
        <div style="text-align: center; margin-bottom: 20px;">
          <h3 style="margin: 0; font-size: 14pt;">Laporan Rekapitulasi Presensi Mata Pelajaran</h3>
          <p style="margin: 5px 0 2px 0;">${getTahunPelajaran()}</p>
          <p style="margin: 2px 0;">Mata Pelajaran: <b>${filterMapel}</b></p>
          <p style="margin: 2px 0;">Periode: ${formatDateString(tglMulai)} s.d. ${formatDateString(tglAkhir)}</p>
          <p style="margin: 0;">Kelas/Rombel: <b>${rName}</b></p>
        </div>

        <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 100%; font-size: 9pt; text-align: center;">
          <thead>
            <tr style="background-color: #e2e8f0;">
              <th style="text-align: left;">Nama Murid</th>
              ${mapelJurnal.map((j, i) => `<th>P${i + 1}<br><span style="font-size: 7pt; font-weight: normal;">${j.tanggal.slice(8)}/${j.tanggal.slice(5, 7)}</span></th>`).join('')}
              <th>H</th><th>S</th><th>I</th><th>A</th><th>%</th>
            </tr>
          </thead>
          <tbody>
      `;

      mapelMurid.forEach((m) => {
        let H = 0, S = 0, I = 0, A = 0;
        let rowHtml = `<tr><td style="text-align: left;">${m.nama}</td>`;
        mapelJurnal.forEach(j => {
          const st = absenMap[j.id]?.[m.id_user] || 'Hadir';
          if (st === 'Hadir') H++; else if (st === 'Sakit') S++; else if (st === 'Izin') I++; else A++;
          const char = st === 'Hadir' ? 'H' : st.charAt(0);
          rowHtml += `<td>${char}</td>`;
        });
        const pct = mapelJurnal.length > 0 ? Math.round((H / mapelJurnal.length) * 100) : 100;
        rowHtml += `<td>${H || '-'}</td><td>${S || '-'}</td><td>${I || '-'}</td><td>${A || '-'}</td><td>${pct}%</td></tr>`;
        html += rowHtml;
      });

      html += `
            </tbody>
          </table>
          <br><br><br>
          <table style="width: 100%; text-align: center; border: none; font-size: 11pt;">
            <tr>
              <td style="width: 50%; border: none;">
                <p style="color: transparent;">.</p>
                <p>Disiapkan Oleh,</p>
                <p><b>GURU MATA PELAJARAN</b></p>
                <br><br><br><br>
                <p><b><u>${user?.nama || '.............................................'}</u></b></p>
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
      `;
    }

    html += `
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

  const handleExportExcel = () => {
    let exportedData = [];
    let fileName = '';

    if (mode === 'harian') {
      fileName = `Rekap_Absensi_Harian_${rombel}_${tglMulai}_sd_${tglAkhir}.xlsx`;
      
      rombelsToPrint.forEach(rName => {
        const rMuridData = rombel === 'Semua' ? muridData.filter(m => m.rombel === rName) : muridData;
        
        rMuridData.forEach((m, idx) => {
          const r = rekapData[m.id_user] || { Hadir: 0, Sakit: 0, Izin: 0, Alfa: 0 };
          const hadir = r.Hadir || 0;
          const sakit = r.Sakit || 0;
          const izin = r.Izin || 0;
          const alfa = r.Alfa || 0;
          const total = hadir + sakit + izin + alfa;
          const persentase = total > 0 ? ((hadir / total) * 100).toFixed(1) + '%' : '-';
          
          exportedData.push({
            'No': idx + 1,
            'Nama Murid': m.nama,
            'NISN': m.id_user || '-',
            'Rombel': rName,
            'Hadir': hadir,
            'Sakit': sakit,
            'Izin': izin,
            'Alfa': alfa,
            'Total Hari': total,
            'Persentase Hadir': persentase
          });
        });
      });
    } else {
      // Mode Mapel
      if (!rekapMapelData || rekapMapelData.jurnal.length === 0) {
        alert('Data rekap mapel tidak tersedia atau belum dipilih.');
        return;
      }
      
      fileName = `Rekap_Absensi_Mapel_${filterMapel}_${rombel}_${tglMulai}_sd_${tglAkhir}.xlsx`;
      const { murid: mapelMurid, jurnal: mapelJurnal, absenMap } = rekapMapelData;
      
      mapelMurid.forEach((m, idx) => {
        let H = 0, S = 0, I = 0, A = 0;
        mapelJurnal.forEach(j => {
          const st = absenMap[j.id]?.[m.id_user] || 'Hadir';
          if (st === 'Hadir') H++; else if (st === 'Sakit') S++; else if (st === 'Izin') I++; else A++;
        });
        const pct = mapelJurnal.length > 0 ? Math.round((H / mapelJurnal.length) * 100) : 100;
        
        exportedData.push({
          'No': idx + 1,
          'Nama Murid': m.nama,
          'NISN': m.id_user || '-',
          'Rombel': m.rombel || '-',
          'Hadir': H,
          'Sakit': S,
          'Izin': I,
          'Alfa': A,
          'Total Pertemuan': mapelJurnal.length,
          'Persentase Hadir': pct + '%'
        });
      });
    }

    if (exportedData.length === 0) {
      alert('Tidak ada data untuk diekspor.');
      return;
    }

    const ws = XLSX.utils.json_to_sheet(exportedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rekap_Absensi");
    XLSX.writeFile(wb, fileName);
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
            {user?.role === 'Admin' && (
              <button onClick={handleExportExcel}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold transition-all shadow-sm">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
                Export Excel
              </button>
            )}
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
            {(user?.role === 'Admin' || user?.role === 'Guru Mapel') && (
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
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-2 border-t border-slate-100 dark:border-white/10 mt-2 w-full">
              {user?.role !== 'Guru Mapel' && (
                <div className="flex rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 shadow-sm shrink-0">
                  <button onClick={() => setMode('harian')} className={`px-4 py-2 text-xs font-bold transition-colors ${mode === 'harian' ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'}`}>
                    Rekap Harian
                  </button>
                  <button onClick={() => setMode('mapel')} className={`px-4 py-2 text-xs font-bold transition-colors ${mode === 'mapel' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'}`}>
                    Rekap Mapel
                  </button>
                </div>
              )}
              {mode === 'mapel' && (
                <div className="relative w-full sm:w-auto">
                  <select value={filterMapel} onChange={e => setFilterMapel(e.target.value)}
                    style={{ backgroundImage: 'none' }}
                    className="appearance-none w-full sm:w-auto pl-4 pr-10 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all shadow-sm">
                    <option value="Semua">-- Pilih Mata Pelajaran --</option>
                    {(user?.role === 'Guru Mapel' && user?.mapel && user.mapel !== '-' ? mapelOptions.filter(m => user.mapel.includes(m)) : mapelOptions).map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <svg className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {mode === 'harian' ? (
      <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-3xl overflow-hidden shadow-sm print:hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-white/5 border-b border-slate-200 dark:border-white/10">
                <th className="px-5 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center">No</th>
                <th className="px-5 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider col-nama">Nama Murid</th>
                {rombel === 'Semua' && (
                  <th className="px-5 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Rombel</th>
                )}
                <th className="px-5 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 text-center uppercase tracking-wider">NISN</th>
                <th className="px-5 py-4 text-xs font-bold text-emerald-600 dark:text-emerald-400 text-center uppercase tracking-wider">Hadir</th>
                <th className="px-5 py-4 text-xs font-bold text-amber-600 dark:text-amber-400 text-center uppercase tracking-wider">Sakit</th>
                <th className="px-5 py-4 text-xs font-bold text-blue-600 dark:text-blue-400 text-center uppercase tracking-wider">Izin</th>
                <th className="px-5 py-4 text-xs font-bold text-rose-600 dark:text-rose-400 text-center uppercase tracking-wider">Alfa</th>
                <th className="px-5 py-4 text-xs font-bold text-purple-600 dark:text-purple-400 text-center uppercase tracking-wider">Total</th>
                <th className="px-5 py-4 text-xs font-bold text-indigo-600 dark:text-indigo-400 text-center uppercase tracking-wider">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-500 dark:text-slate-400 font-medium">Memuat data...</td>
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
                      <tr key={m.id_user} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors group">
                        <td className="px-5 py-3 text-sm text-slate-500 dark:text-slate-400 text-center">{idx + 1}</td>
                        <td className="px-5 py-3 text-sm text-slate-800 dark:text-white font-semibold col-nama">{m.nama}</td>
                        {rombel === 'Semua' && (
                          <td className="px-5 py-3 text-sm text-slate-500 dark:text-slate-400">
                            <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-md text-xs font-bold">{m.rombel}</span>
                          </td>
                        )}
                        <td className="px-5 py-3 text-sm text-slate-500 dark:text-slate-400 font-mono text-center">{m.id_user || '-'}</td>
                        <td className="px-5 py-3 text-sm text-emerald-600 dark:text-emerald-400 text-center font-bold bg-emerald-50/30 dark:bg-emerald-500/5">{hadir || '-'}</td>
                        <td className="px-5 py-3 text-sm text-center font-bold bg-amber-50/30 dark:bg-amber-500/5">
                          {sakit > 0 ? (
                            <button onClick={() => setSelectedHistory({ type: 'Sakit', name: m.nama, data: r.history.Sakit })} className="text-amber-600 dark:text-amber-400 hover:underline hover:text-amber-800 dark:hover:text-amber-300 w-full">{sakit}</button>
                          ) : <span className="text-amber-600 dark:text-amber-400">-</span>}
                        </td>
                        <td className="px-5 py-3 text-sm text-center font-bold bg-blue-50/30 dark:bg-blue-500/5">
                          {izin > 0 ? (
                            <button onClick={() => setSelectedHistory({ type: 'Izin', name: m.nama, data: r.history.Izin })} className="text-blue-600 dark:text-blue-400 hover:underline hover:text-blue-800 dark:hover:text-blue-300 w-full">{izin}</button>
                          ) : <span className="text-blue-600 dark:text-blue-400">-</span>}
                        </td>
                        <td className="px-5 py-3 text-sm text-center font-bold bg-rose-50/30 dark:bg-rose-500/5">
                          {alfa > 0 ? (
                            <button onClick={() => setSelectedHistory({ type: 'Alfa', name: m.nama, data: r.history.Alfa })} className="text-rose-600 dark:text-rose-400 hover:underline hover:text-rose-800 dark:hover:text-rose-300 w-full">{alfa}</button>
                          ) : <span className="text-rose-600 dark:text-rose-400">-</span>}
                        </td>
                        <td className="px-5 py-3 text-sm text-purple-600 dark:text-purple-400 text-center font-bold bg-purple-50/30 dark:bg-purple-500/5">{total || '-'}</td>
                        <td className="px-5 py-3 text-sm text-indigo-600 dark:text-indigo-400 text-center font-bold bg-indigo-50/30 dark:bg-indigo-500/5">{persentase}</td>
                      </tr>
                    );
                  })}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
      ) : (
      /* ===== INJEKSI 3: Tabel Mode Rekap Mapel ===== */
      <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-3xl overflow-hidden shadow-sm print:hidden">
        {filterMapel === 'Semua' ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <svg className="w-10 h-10 text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 10.741-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" /></svg>
            <p className="text-slate-400 dark:text-slate-500 font-medium text-sm">Pilih Mata Pelajaran untuk melihat rekap kehadiran per pertemuan</p>
          </div>
        ) : loadingMapel ? (
          <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" /></div>
        ) : !rekapMapelData || rekapMapelData.jurnal.length === 0 ? (
          <div className="p-8 text-center text-slate-400 dark:text-slate-500 font-medium text-sm">Tidak ada jurnal mengajar untuk mata pelajaran <strong>{filterMapel}</strong> dalam rentang tanggal ini.</div>
        ) : (() => {
          const { murid: mapelMurid, jurnal: mapelJurnal, absenMap } = rekapMapelData;
          const statusCell = (status) => {
            const s = { Hadir: 'text-emerald-600 dark:text-emerald-400', Sakit: 'text-amber-600 dark:text-amber-400', Izin: 'text-blue-600 dark:text-blue-400', Alfa: 'text-rose-600 dark:text-rose-400', Dispen: 'text-purple-600 dark:text-purple-400' };
            return <span className={`font-bold text-xs ${s[status] || 'text-slate-500'}`}>{status === 'Hadir' ? 'H' : status?.charAt(0) || 'H'}</span>;
          };
          return (
            <div className="overflow-x-auto">
              <div className="px-5 py-3 border-b border-slate-100 dark:border-white/10">
                <p className="text-sm font-bold text-slate-700 dark:text-white">{filterMapel}</p>
                <p className="text-xs text-slate-400">{mapelJurnal.length} pertemuan · {mapelMurid.length} siswa</p>
              </div>
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-white/5 border-b border-slate-200 dark:border-white/10">
                    <th className="px-4 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider sticky left-0 bg-slate-50 dark:bg-slate-900 z-10 min-w-[160px]">Nama</th>
                    {mapelJurnal.map((j, i) => (
                      <th key={j.id} className="px-3 py-3 text-center text-xs font-bold text-slate-500 dark:text-slate-400" title={`${j.tanggal} ${j.jam_pelajaran}`}>
                        <div>P{i + 1}</div>
                        <div className="text-[9px] font-normal text-slate-400">{j.tanggal.slice(8)}/{j.tanggal.slice(5, 7)}</div>
                      </th>
                    ))}
                    <th className="px-3 py-3 text-center text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase">H</th>
                    <th className="px-3 py-3 text-center text-xs font-bold text-amber-600 dark:text-amber-400 uppercase">S</th>
                    <th className="px-3 py-3 text-center text-xs font-bold text-blue-600 dark:text-blue-400 uppercase">I</th>
                    <th className="px-3 py-3 text-center text-xs font-bold text-rose-600 dark:text-rose-400 uppercase">A</th>
                    <th className="px-3 py-3 text-center text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {mapelMurid.map((m) => {
                    let H = 0, S = 0, I = 0, A = 0;
                    mapelJurnal.forEach(j => {
                      const st = absenMap[j.id]?.[m.id_user] || 'Hadir';
                      if (st === 'Hadir') H++; else if (st === 'Sakit') S++; else if (st === 'Izin') I++; else A++;
                    });
                    const pct = mapelJurnal.length > 0 ? Math.round((H / mapelJurnal.length) * 100) : 100;
                    return (
                      <tr key={m.id_user} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 text-sm font-semibold text-slate-800 dark:text-white sticky left-0 bg-white dark:bg-slate-900 z-10">{m.nama}</td>
                        {mapelJurnal.map(j => (
                          <td key={j.id} className="px-3 py-3 text-center">
                            {statusCell(absenMap[j.id]?.[m.id_user] || 'Hadir')}
                          </td>
                        ))}
                        <td className="px-3 py-3 text-center text-xs font-bold text-emerald-600 dark:text-emerald-400">{H || '-'}</td>
                        <td className="px-3 py-3 text-center text-xs font-bold text-amber-600 dark:text-amber-400">{S || '-'}</td>
                        <td className="px-3 py-3 text-center text-xs font-bold text-blue-600 dark:text-blue-400">{I || '-'}</td>
                        <td className="px-3 py-3 text-center text-xs font-bold text-rose-600 dark:text-rose-400">{A || '-'}</td>
                        <td className="px-3 py-3 text-center text-xs font-bold text-indigo-600 dark:text-indigo-400">{pct}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })()}
      </div>
      )}

      <div className="print-container hidden print:block">
        {mode === 'harian' ? (
          rombelsToPrint.map((rName, rIdx) => {
            const rMuridData = rombel === 'Semua' ? muridData.filter(m => m.rombel === rName) : muridData;
            const rWaliName = rombel === 'Semua' ? (waliKelasMap[rName] || '.............................................') : waliKelasName;
  
            return (
              <div key={rName} className={rIdx < rombelsToPrint.length - 1 ? 'page-break-after' : ''}>
                {/* Header Print */}
                <div className="mb-4">
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
                    <h3 className="text-base font-bold text-slate-800">Laporan Rekapitulasi Presensi Bulanan</h3>
                    <p className="text-xs text-slate-600 mt-0.5">{getTahunPelajaran()}</p>
                    <p className="text-xs text-slate-600 mt-0.5">Periode: {formatDateString(tglMulai)} s.d. {formatDateString(tglAkhir)}</p>
                    <p className="text-xs text-slate-600 mt-0.5">Kelas/Rombel: <span className="font-bold text-green-700">{rName}</span></p>
                  </div>
                  
                  <h4 className="font-bold text-green-800 text-[11px] mb-2 flex items-center gap-2">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
                    </svg>
                    REKAPITULASI KEHADIRAN SISWA
                  </h4>
                </div>
  
                {/* Tabel Khusus Print (Tanpa kolom rombel) */}
                <div className="overflow-visible">
                  <table className="w-full text-left border-collapse print:text-black print:bg-white print:table-auto">
                    <thead>
                      <tr className="print:bg-gray-200 print:border-black">
                        <th className="text-xs font-bold print:text-black uppercase tracking-wider text-center">No</th>
                        <th className="text-xs font-bold print:text-black uppercase tracking-wider col-nama">Nama Murid</th>
                        <th className="text-xs font-bold print:text-black text-center uppercase tracking-wider">NISN</th>
                        <th className="text-xs font-bold print:text-black text-center uppercase tracking-wider">Hadir</th>
                        <th className="text-xs font-bold print:text-black text-center uppercase tracking-wider">Sakit</th>
                        <th className="text-xs font-bold print:text-black text-center uppercase tracking-wider">Izin</th>
                        <th className="text-xs font-bold print:text-black text-center uppercase tracking-wider">Alfa</th>
                        <th className="text-xs font-bold print:text-black text-center uppercase tracking-wider">Total</th>
                        <th className="text-xs font-bold print:text-black text-center uppercase tracking-wider">%</th>
                      </tr>
                    </thead>
                    <tbody className="print:divide-black/20">
                      {rMuridData.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-slate-500 font-medium">Tidak ada data murid di rentang tanggal & rombel ini.</td>
                        </tr>
                      ) : (
                        <>
                          {rMuridData.map((m, idx) => {
                            const r = rekapData[m.id_user] || { Hadir: 0, Sakit: 0, Izin: 0, Alfa: 0 };
                            const hadir = r.Hadir || 0;
                            const sakit = r.Sakit || 0;
                            const izin = r.Izin || 0;
                            const alfa = r.Alfa || 0;
                            const total = hadir + sakit + izin + alfa;
                            const persentase = total > 0 ? ((hadir / total) * 100).toFixed(1) + '%' : '-';
  
                            return (
                              <tr key={m.id_user} className="print:hover:bg-transparent">
                                <td className="text-sm print:text-black print:px-2 print:py-2 text-center">{idx + 1}</td>
                                <td className="text-sm print:text-black font-semibold print:px-2 print:py-2 col-nama">{m.nama}</td>
                                <td className="text-sm print:text-black print:px-2 print:py-2 text-center font-mono">{m.id_user || '-'}</td>
                                <td className="text-sm print:text-black text-center font-bold print:bg-transparent print:px-2 print:py-2">{hadir || '-'}</td>
                                <td className="text-sm print:text-black text-center font-bold print:bg-transparent print:px-2 print:py-2">{sakit || '-'}</td>
                                <td className="text-sm print:text-black text-center font-bold print:bg-transparent print:px-2 print:py-2">{izin || '-'}</td>
                                <td className="text-sm print:text-black text-center font-bold print:bg-transparent print:px-2 print:py-2">{alfa || '-'}</td>
                                <td className="text-sm print:text-black text-center font-bold print:bg-transparent print:px-2 print:py-2">{total || '-'}</td>
                                <td className="text-sm print:text-black text-center font-bold print:bg-transparent print:px-2 print:py-2">{persentase}</td>
                              </tr>
                            );
                          })}
                          {/* Baris Tanda Tangan Menyatu dengan Tabel (Tanpa Border) */}
                          <tr className="print:table-row print-no-border">
                            <td colSpan={8} className="pt-12 pb-2">
                              <div className="flex justify-between items-end px-12 text-center text-xs text-black w-full">
                                <div className="flex flex-col items-center">
                                  <p className="text-transparent select-none">.</p>
                                  <p>Disiapkan Oleh,</p>
                                  <p className="font-bold uppercase mt-1">WALI KELAS {rName},</p>
                                  <div className="mt-20 inline-block border-b border-black font-bold whitespace-nowrap break-words px-2">{rWaliName}</div>
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
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })
        ) : (
          /* ===== Print Mode Mapel ===== */
          (() => {
            if (!rekapMapelData || rekapMapelData.jurnal.length === 0) return null;
            const { murid: mapelMurid, jurnal: mapelJurnal, absenMap } = rekapMapelData;
            const rName = rombel === 'Semua' ? 'Semua Rombel' : rombel;
            return (
              <div>
                <div className="mb-4">
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
                    <h3 className="text-base font-bold text-slate-800">Laporan Rekapitulasi Presensi Mata Pelajaran</h3>
                    <p className="text-xs text-slate-600 mt-0.5">{getTahunPelajaran()}</p>
                    <p className="text-xs text-slate-600 mt-0.5">Mata Pelajaran: <span className="font-bold text-green-700">{filterMapel}</span></p>
                    <p className="text-xs text-slate-600 mt-0.5">Periode: {formatDateString(tglMulai)} s.d. {formatDateString(tglAkhir)}</p>
                    <p className="text-xs text-slate-600 mt-0.5">Kelas/Rombel: <span className="font-bold text-green-700">{rName}</span></p>
                  </div>
                </div>

                <div className="overflow-visible">
                  <table className="w-full text-left border-collapse print:text-black print:bg-white print:table-auto">
                    <thead>
                      <tr className="print:bg-gray-200 print:border-black">
                        <th className="text-xs font-bold print:text-black uppercase tracking-wider text-left">Nama Murid</th>
                        {mapelJurnal.map((j, i) => (
                          <th key={j.id} className="text-[10px] font-bold print:text-black text-center uppercase tracking-wider">
                            P{i + 1}<br/><span className="text-[8px] font-normal">{j.tanggal.slice(8)}/{j.tanggal.slice(5, 7)}</span>
                          </th>
                        ))}
                        <th className="text-[10px] font-bold print:text-black text-center uppercase tracking-wider">H</th>
                        <th className="text-[10px] font-bold print:text-black text-center uppercase tracking-wider">S</th>
                        <th className="text-[10px] font-bold print:text-black text-center uppercase tracking-wider">I</th>
                        <th className="text-[10px] font-bold print:text-black text-center uppercase tracking-wider">A</th>
                        <th className="text-[10px] font-bold print:text-black text-center uppercase tracking-wider">%</th>
                      </tr>
                    </thead>
                    <tbody className="print:divide-black/20">
                      {mapelMurid.map((m) => {
                        let H = 0, S = 0, I = 0, A = 0;
                        mapelJurnal.forEach(j => {
                          const st = absenMap[j.id]?.[m.id_user] || 'Hadir';
                          if (st === 'Hadir') H++; else if (st === 'Sakit') S++; else if (st === 'Izin') I++; else A++;
                        });
                        const pct = mapelJurnal.length > 0 ? Math.round((H / mapelJurnal.length) * 100) : 100;
                        return (
                          <tr key={m.id_user} className="print:hover:bg-transparent">
                            <td className="text-[11px] print:text-black font-semibold print:px-2 print:py-1">{m.nama}</td>
                            {mapelJurnal.map(j => {
                              const st = absenMap[j.id]?.[m.id_user] || 'Hadir';
                              const char = st === 'Hadir' ? 'H' : st.charAt(0);
                              return <td key={j.id} className="text-[11px] print:text-black text-center print:px-1 print:py-1">{char}</td>;
                            })}
                            <td className="text-[11px] print:text-black text-center font-bold print:px-1 print:py-1">{H || '-'}</td>
                            <td className="text-[11px] print:text-black text-center font-bold print:px-1 print:py-1">{S || '-'}</td>
                            <td className="text-[11px] print:text-black text-center font-bold print:px-1 print:py-1">{I || '-'}</td>
                            <td className="text-[11px] print:text-black text-center font-bold print:px-1 print:py-1">{A || '-'}</td>
                            <td className="text-[11px] print:text-black text-center font-bold print:px-1 print:py-1">{pct}%</td>
                          </tr>
                        );
                      })}
                      <tr className="print:table-row print-no-border">
                        <td colSpan={mapelJurnal.length + 6} className="pt-12 pb-2">
                          <div className="flex justify-between items-end px-12 text-center text-xs text-black w-full">
                            <div className="flex flex-col items-center">
                              <p className="text-transparent select-none">.</p>
                              <p>Disiapkan Oleh,</p>
                              <p className="font-bold uppercase mt-1">GURU MATA PELAJARAN,</p>
                              <div className="mt-20 inline-block border-b border-black font-bold whitespace-nowrap break-words px-2">{user?.nama || '.............................................'}</div>
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
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()
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
                         <span className="font-mono text-xs font-semibold text-slate-600 dark:text-slate-300">{formatDateString(item.tanggal)}</span>
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
          @page { size: 215mm 330mm portrait; margin: 10mm 10mm 10mm 15mm; }
          body { background: white; -webkit-print-color-adjust: exact; }
          body * { visibility: hidden; }
          .print-container, .print-container * { visibility: visible; }
          .print-container { position: relative; left: 0; top: 0; width: 100%; }
          .page-break-after { page-break-after: always; }
          table { border-collapse: collapse; width: 100%; margin-top: 10px; page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
          
          /* Kolom mengecil sesuai isi teks agar menghemat tempat, kecuali kolom nama */
          th, td { border: 1px solid #000; padding: ${getDynamicPadding()}; color: #000 !important; font-size: 10px; white-space: nowrap; }
          
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
