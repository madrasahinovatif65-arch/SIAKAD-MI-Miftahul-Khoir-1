'use client';

// Utility to fetch logo as base64
const getBase64FromUrl = async (url) => {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

import useSWR from 'swr';
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { id } from 'date-fns/locale/id';

registerLocale('id', id);
export default function JurnalPage() {
  const { user } = useAuth();
  const [tanggal, setTanggal] = useState(() => new Date().toISOString().split('T')[0]);
  const [jamMulai, setJamMulai] = useState('');
  const [jamSelesai, setJamSelesai] = useState('');
  const [rombel, setRombel] = useState(user?.rombel !== '-' ? user?.rombel : '');
  const [mapel, setMapel] = useState('');
  const [materi, setMateri] = useState('');
  const [catatan, setCatatan] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [isHoliday, setIsHoliday] = useState(false);
  const [holidayName, setHolidayName] = useState('');
  const [editId, setEditId] = useState(null);
  const [absensiMapel, setAbsensiMapel] = useState({});

  const [filterTglMulai, setFilterTglMulai] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [filterTglAkhir, setFilterTglAkhir] = useState(() => new Date().toISOString().split('T')[0]);
  const [filterRombel, setFilterRombel] = useState('Semua');

  const { data: siswaData, isLoading: loadingSiswa } = useSWR(rombel && tanggal ? `siswa_absen_${rombel}_${tanggal}` : null, async () => {
    // Ambil murid
    const { data: murid } = await supabase.from('master_user').select('id_user, nama').eq('role', 'Murid').eq('rombel', rombel).order('nama');
    
    // Ambil absen harian pagi ini
    const { data: absenHarian } = await supabase.from('data_absensi').select('nisn, status').eq('tanggal', tanggal).eq('rombel', rombel);
    
    const absenMap = {};
    (absenHarian || []).forEach(a => absenMap[a.nisn] = a.status);

    return { murid: murid || [], absenMap };
  });

  const { data: editAbsensiMapel } = useSWR(editId ? `edit_absensi_mapel_${editId}` : null, async () => {
    const { data } = await supabase.from('data_absensi_mapel').select('nisn, status').eq('id_jurnal', editId);
    return data || [];
  });

  useEffect(() => {
    if (siswaData) {
      const draft = {};
      siswaData.murid.forEach(m => {
        draft[m.id_user] = 'Hadir'; // default
      });

      if (editId && editAbsensiMapel) {
         editAbsensiMapel.forEach(a => draft[a.nisn] = a.status);
         setAbsensiMapel(draft);
      } else if (!editId) {
         // Auto fill
         siswaData.murid.forEach(m => {
           draft[m.id_user] = siswaData.absenMap[m.id_user] || 'Hadir';
         });
         setAbsensiMapel(draft);
      }
    }
  }, [siswaData, editId, editAbsensiMapel]);

  const handleStatusChange = (id_user, status) => {
    setAbsensiMapel(prev => ({...prev, [id_user]: status}));
  };

  const { data: masterData } = useSWR('master_jurnal', async () => {
    const [jamRes, mapelRes, rombelRes] = await Promise.all([
      supabase.from('master_jam_pelajaran').select('*').order('id_jam'),
      supabase.from('master_mapel').select('*').order('nama_mapel'),
      supabase.from('master_user').select('rombel').eq('role', 'Murid'),
    ]);
    const unique = [...new Set((rombelRes.data || []).map(d => d.rombel).filter(Boolean))].sort();
    return { jam: jamRes.data || [], mapel: mapelRes.data || [], rombel: unique };
  });

  const jamOptions = masterData?.jam || [];
  
  const mapelOptions = user?.role === 'Guru Mapel' && user?.mapel && user.mapel !== '-'
    ? (masterData?.mapel || []).filter(m => user.mapel.includes(m.nama_mapel))
    : (masterData?.mapel || []);
    
  const rombelOptions = user?.role === 'Wali Kelas' && user?.rombel && user.rombel !== '-'
    ? [user.rombel]
    : (masterData?.rombel || []);

  useEffect(() => {
    if (!mapel && mapelOptions.length === 1) {
      setMapel(mapelOptions[0].nama_mapel);
    }
  }, [mapel, mapelOptions]);

  useEffect(() => {
    if (!jamMulai && jamOptions.length > 0) {
      setJamMulai(jamOptions[0].id_jam);
      setJamSelesai(jamOptions[0].id_jam);
    }
  }, [jamOptions, jamMulai]);

  const { data: riwayatData, isLoading: loadingRiwayat, mutate: mutateRiwayat } = useSWR(user ? `jurnal_riwayat_${user.id_user}_${filterTglMulai}_${filterTglAkhir}_${filterRombel}` : null, async () => {
    let query = supabase.from('jurnal_guru').select('*, master_user(nama)').order('tanggal', { ascending: true }).order('jam_pelajaran');
    if (user.role !== 'Admin') {
      query = query.eq('id_guru', user.id_user);
    }
    if (filterTglMulai && filterTglAkhir) {
      query = query.gte('tanggal', filterTglMulai).lte('tanggal', filterTglAkhir);
    }
    if (user.role === 'Admin' && filterRombel !== 'Semua') {
      query = query.eq('rombel', filterRombel);
    } else if (user.role !== 'Admin' && filterTglMulai === '' && filterTglAkhir === '') {
       query = query.limit(20);
    }
    
    const { data } = await query;
    return data || [];
  });

  const riwayat = riwayatData || [];

  const checkHoliday = useCallback(async (tgl) => {
    setIsHoliday(false);
    setHolidayName('');
    const d = new Date(tgl);
    if (d.getDay() === 0) {
      setIsHoliday(true);
      setHolidayName('Hari Minggu');
      return;
    }
    const { data: libur } = await supabase.from('master_libur').select('*').eq('tanggal', tgl).single();
    if (libur) {
      setIsHoliday(true);
      setHolidayName(libur.keterangan);
    }
  }, []);


  useEffect(() => { checkHoliday(tanggal); }, [tanggal, checkHoliday]);

  const handleEdit = (j) => {
    setEditId(j.id);
    setTanggal(j.tanggal);
    setRombel(j.rombel);
    setMapel(j.mata_pelajaran);
    setMateri(j.materi && j.materi !== '-' ? j.materi : '');
    setCatatan(j.catatan && j.catatan !== '-' ? j.catatan : '');
    
    if (j.jam_pelajaran) {
      if (j.jam_pelajaran.includes('s/d')) {
        const match = j.jam_pelajaran.match(/^(.*?)\s+s\/d\s+(.*?)\s+\(/);
        if (match) {
          const jamId1 = jamOptions.find(opt => opt.nama_jam === match[1])?.id_jam;
          const jamId2 = jamOptions.find(opt => opt.nama_jam === match[2])?.id_jam;
          if (jamId1) setJamMulai(jamId1);
          if (jamId2) setJamSelesai(jamId2);
        }
      } else {
        const match = j.jam_pelajaran.match(/^(.*?)\s+\(/);
        if (match) {
          const jamId = jamOptions.find(opt => opt.nama_jam === match[1])?.id_jam;
          if (jamId) {
            setJamMulai(jamId);
            setJamSelesai(jamId);
          }
        } else {
          // fallback
          const jamId = jamOptions.find(opt => j.jam_pelajaran.includes(opt.nama_jam))?.id_jam;
          if (jamId) {
            setJamMulai(jamId);
            setJamSelesai(jamId);
          }
        }
      }
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  const handleExportWord = async () => {
    const guruName = user?.nama || user?.id_user || '-';
    const logoBase64 = await getBase64FromUrl('/logo.png');
    const rombelNameExport = user?.rombel !== '-' && user?.rombel ? user.rombel.replace(/^Kelas /i, '') : '';
    const roleLabel = user?.role === 'Admin' ? 'Kepala Madrasah' : user?.role === 'Wali Kelas' ? `Wali Kelas ${rombelNameExport}`.trim() : user?.role === 'Guru Mapel' ? 'Guru Mata Pelajaran' : 'Staf TU';
    const groupedRiwayat = riwayat.reduce((acc, curr) => {
      const d = new Date(curr.tanggal);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d);
      monday.setDate(diff);
      const weekKey = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
      if (!acc[weekKey]) acc[weekKey] = [];
      acc[weekKey].push(curr);
      return acc;
    }, {});
    const printWeeks = Object.keys(groupedRiwayat).sort();

    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
         <meta charset="utf-8">
         <title>Jurnal Mengajar</title>
         <style>
           @page { size: 215mm 330mm; margin: 1cm 1cm 1cm 1.5cm; }
           .header-logo { width: 50px; height: auto; margin-right: 10px; vertical-align: middle; }
         </style>
       </head>
      <body style="font-family: Arial, sans-serif;">
    `;

    printWeeks.forEach((weekKey, weekIdx) => {
      if (weekIdx > 0) {
        html += `<br clear=all style="mso-special-character:line-break;page-break-before:always">`;
      }
      const exportData = groupedRiwayat[weekKey];
      const firstDate = exportData[0].tanggal;
      const lastDate = exportData[exportData.length - 1].tanggal;
      const dateText = firstDate === lastDate ? formatDateString(firstDate) : `${formatDateString(firstDate)} s.d. ${formatDateString(lastDate)}`;

      html += `
        <table style="width: 100%; border-bottom: 3px solid black; margin-bottom: 20px; border-collapse: collapse;">
          <tr>
            <td style="width: 15%; text-align: left; vertical-align: middle;">
              <img src="${logoBase64}" class="header-logo" alt="Logo" />
            </td>
            <td style="width: 85%; text-align: center; vertical-align: middle;">
              <h3 style="margin: 0; font-size: 16pt;">Yayasan NU Miftakhul Khoir Damarjati</h3>
              <h2 style="margin: 0; font-size: 20pt; color: #15803d;">MI Miftahul Khoir 1 Karangrejo</h2>
              <p style="margin: 5px 0 0 0; font-size: 9pt;">NPSN: 60716857 | Jl. Sumber Keling No. 11, Dsn. Krajan, Ds. Karangrejo, Kec. Purwosari, Kabupaten Pasuruan</p>
            </td>
          </tr>
        </table>
        <div style="text-align: center; margin-bottom: 20px;">
          <h3 style="margin: 0; font-size: 14pt;">Laporan Jurnal Mengajar</h3>
          <p style="margin: 5px 0;">Tanggal: ${dateText}</p>
          ${user.role === 'Admin' && filterRombel !== 'Semua' ? `<p style="margin: 0;">Kelas/Rombel: <b>${filterRombel}</b></p>` : ''}
          ${user.role !== 'Admin' ? `<p style="margin: 0;">Guru: <b>${guruName}</b></p>` : ''}
        </div>
        <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 100%; font-size: 9pt; text-align: center; table-layout: auto;">
          <thead>
            <tr style="background-color: #e2e8f0;">
              <th style="width: 4%;">No</th>
              <th style="width: 10%;">Tanggal</th>
              <th style="width: 8%;">Jam</th>
              ${user.role === 'Admin' ? '<th style="width: 12%;">Guru</th>' : ''}
              <th style="width: 8%;">Rombel</th>
              <th style="width: 12%;">Mapel</th>
              <th style="text-align: left; width: 23%;">Materi</th>
              <th style="text-align: left; width: 23%;">Catatan</th>
            </tr>
          </thead>
          <tbody>
      `;
      exportData.forEach((j, idx) => {
        html += `
          <tr>
            <td>${idx + 1}</td>
            <td style="font-size: 8pt;">${j.tanggal}</td>
            <td style="font-size: 8pt;">${(j.jam_pelajaran || '-').replace(/\s*\(.*\)/, '')}</td>
            ${user.role === 'Admin' ? `<td>${j.master_user?.nama || '-'}</td>` : ''}
            <td>${j.rombel}</td>
            <td>${j.mata_pelajaran}</td>
            <td style="text-align: left;">${j.materi || '-'}</td>
            <td style="text-align: left;">${j.catatan || '-'}</td>
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
              <p style="margin: 5px 0;">Dibuat Oleh,</p>
              <p><b>${roleLabel}</b></p>
              <br><br><br><br>
              <p><b><u>${guruName}</u></b></p>
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
    });

    html += `
      </body>
      </html>
    `;
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Jurnal_Mengajar_${filterTglMulai}_sd_${filterTglAkhir}.doc`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSave = async () => {
    if (!tanggal || !jamMulai || !rombel || !mapel) {
      setMessage({ type: 'error', text: 'Semua field wajib diisi.' });
      return;
    }
    setSaving(true);
    setMessage(null);

    const jamObjMulai = jamOptions.find(j => j.id_jam === jamMulai);
    const jamObjSelesai = jamOptions.find(j => j.id_jam === jamSelesai);
    let finalJamPelajaran = '';
    if (jamObjMulai && jamObjSelesai) {
      if (jamObjMulai.id_jam === jamObjSelesai.id_jam) {
        finalJamPelajaran = `${jamObjMulai.nama_jam} (${jamObjMulai.waktu_mulai}-${jamObjMulai.waktu_selesai})`;
      } else {
        finalJamPelajaran = `${jamObjMulai.nama_jam} s/d ${jamObjSelesai.nama_jam} (${jamObjMulai.waktu_mulai}-${jamObjMulai.waktu_selesai})`;
      }
    }
    
    const payload = {
      tanggal,
      jam_pelajaran: finalJamPelajaran,
      id_guru: user.id_user,
      rombel,
      mata_pelajaran: mapel,
      materi: materi || '-',
      catatan: catatan || '-',
    };

    let error;
    let jurnalId = editId;

    if (editId) {
      const { error: updateError } = await supabase.from('jurnal_guru').update(payload).eq('id', editId);
      error = updateError;
    } else {
      const { data: insertedJurnal, error: insertError } = await supabase.from('jurnal_guru').insert(payload).select('id').single();
      error = insertError;
      jurnalId = insertedJurnal?.id;
    }

    if (!error && jurnalId) {
      if (editId) {
        await supabase.from('data_absensi_mapel').delete().eq('id_jurnal', editId);
      }
      
      const mapelPayload = [];
      Object.entries(absensiMapel).forEach(([nisn, status]) => {
         if (status !== 'Hadir') {
           mapelPayload.push({
             id_jurnal: jurnalId,
             nisn,
             status,
             catatan: '-'
           });
         }
      });
      if (mapelPayload.length > 0) {
         await supabase.from('data_absensi_mapel').insert(mapelPayload);
      }
    }

    setSaving(false);
    if (error) {
      setMessage({ type: 'error', text: 'Gagal menyimpan: ' + error.message });
    } else {
      setMessage({ type: 'success', text: editId ? 'Jurnal & Absensi Mapel berhasil diperbarui!' : 'Jurnal & Absensi Mapel berhasil disimpan!' });
      setMateri('');
      setCatatan('');
      setEditId(null);
      mutateRiwayat();
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-white tracking-tight">Jurnal Mengajar</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Catat aktivitas belajar mengajar harian</p>
        </div>
        <button onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 rounded-xl text-sm font-semibold transition-all shadow-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0v3.396c0 .63.508 1.141 1.141 1.141h8.218c.633 0 1.141-.51 1.141-1.141V8.25Z" />
          </svg>
          Print Laporan
        </button>
      </div>

      {user.role !== 'Admin' && (
        <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-3xl p-6 sm:p-8 space-y-6 print:hidden relative shadow-sm">
          {isHoliday && (
            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-2xl px-4 py-3.5 text-amber-600 dark:text-amber-300 text-sm flex items-center gap-3 font-medium shadow-sm">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>Peringatan: Tanggal ini adalah hari libur (<strong>{holidayName}</strong>).</span>
            </div>
          )}
          {editId && (
            <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-2xl px-4 py-3.5 text-emerald-700 dark:text-emerald-300 text-sm font-medium shadow-sm">
              <span className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" /></svg>
                Sedang mengedit jurnal
              </span>
              <button onClick={() => { setEditId(null); setMateri(''); }} className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-200 underline text-xs font-bold transition-colors">Batal Edit</button>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Tanggal</label>
              <div className="relative">
                <DatePicker
                  selected={new Date(tanggal)}
                  onChange={(date) => {
                    if (date) {
                      const y = date.getFullYear();
                      const m = String(date.getMonth() + 1).padStart(2, '0');
                      const d = String(date.getDate()).padStart(2, '0');
                      setTanggal(`${y}-${m}-${d}`);
                    }
                  }}
                  dateFormat="dd-MM-yyyy"
                  locale="id"
                  todayButton="Hari Ini"
                  wrapperClassName="w-full"
                  className="w-full pl-4 pr-10 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-white text-sm text-left font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-sm relative z-50"
                  portalId="root-portal"
                />
                <svg className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-50" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z" />
                </svg>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs text-emerald-600 dark:text-emerald-400 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                  Jam Mulai
                </label>
                <div className="relative">
                  <select value={jamMulai} onChange={e => setJamMulai(e.target.value)}
                    style={{ backgroundImage: 'none' }}
                    className="appearance-none w-full pl-3 pr-8 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-sm">
                    <option value="" className="bg-white dark:bg-slate-900 text-slate-400">Mulai...</option>
                    {jamOptions.map(w => (
                      <option key={w.id_jam} value={w.id_jam} className="bg-white dark:bg-slate-900">{w.nama_jam} ({w.waktu_mulai} - {w.waktu_selesai})</option>
                    ))}
                  </select>
                  <svg className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-emerald-600 dark:text-emerald-400 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                  Jam Selesai
                </label>
                <div className="relative">
                  <select value={jamSelesai} onChange={e => setJamSelesai(e.target.value)}
                    style={{ backgroundImage: 'none' }}
                    className="appearance-none w-full pl-3 pr-8 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-sm">
                    <option value="" className="bg-white dark:bg-slate-900 text-slate-400">Selesai...</option>
                    {jamOptions.map(w => (
                      <option key={w.id_jam} value={w.id_jam} className="bg-white dark:bg-slate-900">{w.nama_jam} ({w.waktu_mulai} - {w.waktu_selesai})</option>
                    ))}
                  </select>
                  <svg className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Rombel</label>
              <div className="relative">
                <select value={rombel} onChange={e => setRombel(e.target.value)}
                  style={{ backgroundImage: 'none' }}
                  className="appearance-none w-full pl-4 pr-10 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-sm">
                  <option value="" className="bg-white dark:bg-slate-900 text-slate-400">Pilih Rombel</option>
                  {rombelOptions.map(r => (
                    <option key={r} value={r} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{r}</option>
                  ))}
                </select>
                <svg className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Mata Pelajaran</label>
              <div className="relative">
                <select value={mapel} onChange={e => setMapel(e.target.value)}
                  style={{ backgroundImage: 'none' }}
                  className="appearance-none w-full pl-4 pr-10 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-sm">
                  <option value="" className="bg-white dark:bg-slate-900 text-slate-400">Pilih Mapel</option>
                  {mapelOptions.map(m => (
                    <option key={m.id_mapel} value={m.nama_mapel} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{m.nama_mapel}</option>
                  ))}
                </select>
                <svg className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Materi Yang Diajarkan</label>
            <textarea value={materi} onChange={e => setMateri(e.target.value)} rows={3} placeholder="Tuliskan materi yang diajarkan dengan detail..."
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-sm resize-none" />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Catatan Khusus (Opsional)</label>
            <textarea value={catatan} onChange={e => setCatatan(e.target.value)} rows={2} placeholder="Tuliskan insiden, dinamika kelas, atau catatan khusus lainnya..."
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-sm resize-none" />
          </div>

          {/* Tabel Absen Mapel */}
          {rombel && siswaData && !isHoliday && (
            <div className="space-y-3 mt-6">
              <h3 className="text-sm text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Absensi Kelas (Mapel)</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Pilih absensi jika ada murid yang bolos pelajaran Anda (otomatis diisi sesuai absen harian pagi).</p>
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left block md:table">
                    <thead className="hidden md:table-header-group">
                      <tr className="bg-slate-100 dark:bg-white/5 border-b border-slate-200 dark:border-white/10">
                        <th className="px-5 py-4 font-bold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">No</th>
                        <th className="px-5 py-4 font-bold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Nama</th>
                        <th className="px-5 py-4 font-bold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="block md:table-row-group divide-y divide-transparent md:divide-slate-100 md:dark:divide-white/5">
                      {loadingSiswa ? (
                        <tr><td colSpan={3} className="px-5 py-4 text-center text-sm text-slate-500">Memuat data murid...</td></tr>
                      ) : siswaData.murid.length === 0 ? (
                        <tr><td colSpan={3} className="px-5 py-4 text-center text-sm text-slate-500">Belum ada data murid di rombel ini</td></tr>
                      ) : (
                        siswaData.murid.map((m, idx) => {
                           const currentStatus = absensiMapel[m.id_user] || 'Hadir';
                           return (
                             <tr key={m.id_user} className="block md:table-row bg-white md:bg-transparent dark:bg-slate-800/40 md:dark:bg-transparent mb-4 md:mb-0 rounded-2xl md:rounded-none border border-slate-100 dark:border-white/5 md:border-none shadow-sm md:shadow-none hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                               <td className="hidden md:table-cell px-5 py-3 text-slate-500 dark:text-slate-400">{idx + 1}</td>
                               <td className="block md:table-cell px-4 py-3 md:px-5 md:py-3 border-b border-slate-50 dark:border-white/5 md:border-none">
                                 <div>
                                   <div className="text-slate-800 dark:text-white font-medium">
                                     <span className="md:hidden mr-1.5 text-slate-400">{idx + 1}.</span>
                                     {m.nama}
                                   </div>
                                   <div className="text-slate-400 dark:text-slate-500 font-mono text-xs mt-0.5">{m.id_user}</div>
                                 </div>
                               </td>
                               <td className="block md:table-cell px-4 py-3 md:px-5 md:py-3 md:border-none">
                                 <div className="flex flex-col gap-2">
                                   <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider md:hidden">Status Presensi</span>
                                   <div className="flex gap-2 justify-between md:justify-center">
                                      {['Hadir', 'Sakit', 'Izin', 'Alfa'].map(s => (
                                        <button key={s} onClick={() => handleStatusChange(m.id_user, s)}
                                           className={`flex-1 md:flex-none md:w-auto md:px-3 h-8 md:h-8 rounded-lg text-xs font-bold border transition-all flex items-center justify-center ${currentStatus === s ? (s === 'Hadir' ? 'bg-emerald-500 border-emerald-500 text-white shadow-md' : s === 'Sakit' ? 'bg-amber-500 border-amber-500 text-white shadow-md' : s === 'Izin' ? 'bg-blue-500 border-blue-500 text-white shadow-md' : 'bg-rose-500 border-rose-500 text-white shadow-md') : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 text-slate-400 dark:text-slate-500 hover:border-emerald-300 dark:hover:border-emerald-500/50 hover:text-emerald-500 shadow-sm'}`}>
                                           <span className="md:hidden">{s}</span>
                                           <span className="hidden md:inline">{s}</span>
                                        </button>
                                      ))}
                                   </div>
                                 </div>
                               </td>
                             </tr>
                           );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {message && (
            <div className={`px-4 py-3 rounded-2xl text-sm font-medium shadow-sm animate-in fade-in slide-in-from-top-2 mb-6 ${
              message.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-300' : 'bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-300'
            }`}>{message.text}</div>
          )}

          {!isHoliday && (
            <div className="fixed md:sticky bottom-6 md:bottom-4 left-4 right-4 md:left-auto md:right-auto z-50 md:z-20 flex justify-end pointer-events-none mt-6 print:hidden">
              <button onClick={handleSave} disabled={saving}
                className="pointer-events-auto w-full sm:w-auto px-8 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl shadow-xl shadow-emerald-600/30 hover:shadow-emerald-500/40 transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:transform-none disabled:shadow-none flex items-center justify-center gap-2">
                {saving ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" /></svg>
                    {editId ? 'Perbarui Jurnal' : 'Simpan Jurnal'}
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Riwayat */}
      <div className="print:hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white tracking-tight">Riwayat Jurnal</h3>
          
          <div className="flex flex-wrap gap-2">
            <button onClick={handleExportWord}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 rounded-xl text-xs font-semibold transition-all shadow-sm">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
              Export Word
            </button>
            <button onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 rounded-xl text-xs font-semibold transition-all shadow-sm">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0v3.396c0 .63.508 1.141 1.141 1.141h8.218c.633 0 1.141-.51 1.141-1.141V8.25Z" />
              </svg>
              Print Cetak
            </button>
          </div>
          
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-auto">
                <DatePicker
                  selected={filterTglMulai ? new Date(filterTglMulai) : null}
                  onChange={(date) => {
                    if (date) {
                      const y = date.getFullYear();
                      const m = String(date.getMonth() + 1).padStart(2, '0');
                      const d = String(date.getDate()).padStart(2, '0');
                      setFilterTglMulai(`${y}-${m}-${d}`);
                    }
                  }}
                  dateFormat="dd-MM-yyyy"
                  locale="id"
                  todayButton="Hari Ini"
                  placeholderText="Mulai"
                  wrapperClassName="w-full"
                  className="w-full sm:w-32 pl-4 pr-8 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-sm relative z-40"
                  portalId="root-portal"
                />
                <svg className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-40" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z" />
                </svg>
              </div>
              <span className="text-slate-500 dark:text-slate-400 font-medium text-xs">s/d</span>
              <div className="relative w-full sm:w-auto">
                <DatePicker
                  selected={filterTglAkhir ? new Date(filterTglAkhir) : null}
                  onChange={(date) => {
                    if (date) {
                      const y = date.getFullYear();
                      const m = String(date.getMonth() + 1).padStart(2, '0');
                      const d = String(date.getDate()).padStart(2, '0');
                      setFilterTglAkhir(`${y}-${m}-${d}`);
                    }
                  }}
                  dateFormat="dd-MM-yyyy"
                  locale="id"
                  todayButton="Hari Ini"
                  placeholderText="Selesai"
                  wrapperClassName="w-full"
                  className="w-full sm:w-32 pl-4 pr-8 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-sm relative z-40"
                  portalId="root-portal"
                />
                <svg className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-40" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z" />
                </svg>
              </div>
            </div>
            
            {user?.role === 'Admin' && (
              <div className="relative w-full sm:w-auto">
                <select value={filterRombel} onChange={e => setFilterRombel(e.target.value)}
                  style={{ backgroundImage: 'none' }}
                  className="appearance-none w-full sm:w-36 pl-4 pr-8 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-sm">
                  <option value="Semua" className="bg-white dark:bg-slate-900 text-slate-400">Semua Rombel</option>
                  {(masterData?.rombel || []).map(r => (
                    <option key={r} value={r} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{r}</option>
                  ))}
                </select>
                <svg className="w-3 h-3 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </div>
            )}
          </div>
        </div>
        {loadingRiwayat ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
          </div>
        ) : riwayat.length === 0 ? (
          <div className="text-center py-12 bg-white/50 dark:bg-slate-900/40 backdrop-blur-sm border border-slate-200 dark:border-white/10 rounded-3xl text-slate-500 dark:text-slate-400 text-sm font-medium shadow-sm">
            Belum ada jurnal bulan ini.
          </div>
        ) : (
          <div className="space-y-4">
            {riwayat.map(j => (
              <div key={j.id} className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-5 space-y-3 shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500" />
                <div className="flex items-start justify-between pl-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-900 dark:text-white font-bold text-sm">{j.tanggal}</span>
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-md text-[10px] font-bold tracking-wider">{(j.jam_pelajaran || '').replace(/\s*\(.*\)/, '')}</span>
                      {user.role === 'Admin' && j.master_user?.nama && (
                        <span className="px-2 py-0.5 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-md text-[10px] font-bold tracking-wider">
                          {j.master_user.nama}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2 text-xs font-semibold">
                      <span className="px-2 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 rounded-lg">{j.rombel}</span>
                      <span className="px-2 py-1 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 rounded-lg">{j.mata_pelajaran}</span>
                    </div>
                  </div>
                  {user.role !== 'Admin' && (
                    <button onClick={() => handleEdit(j)} className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-200 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 p-2 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" /></svg>
                    </button>
                  )}
                </div>
                {j.materi && j.materi !== '-' && (
                  <div className="pl-2 pt-1 border-t border-slate-100 dark:border-white/5 space-y-1">
                    <p className="text-slate-600 dark:text-slate-300 text-sm"><span className="font-semibold text-xs text-slate-400 uppercase tracking-wider block mb-0.5">Materi:</span> {j.materi}</p>
                    {j.catatan && j.catatan !== '-' && (
                       <p className="text-slate-500 dark:text-slate-400 text-sm mt-1.5 pt-1.5 border-t border-dashed border-slate-100 dark:border-white/5"><span className="font-semibold text-xs text-slate-400 uppercase tracking-wider block mb-0.5">Catatan:</span> {j.catatan}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Container Khusus Print Jurnal */}
      {/* Container Khusus Print Jurnal */}
      <div className="hidden print:block w-full print:bg-white print:text-black">
        {(() => {
          const groupedRiwayat = riwayat.reduce((acc, curr) => {
            const d = new Date(curr.tanggal);
            const day = d.getDay();
            const diff = d.getDate() - day + (day === 0 ? -6 : 1);
            const monday = new Date(d);
            monday.setDate(diff);
            const weekKey = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
            if (!acc[weekKey]) acc[weekKey] = [];
            acc[weekKey].push(curr);
            return acc;
          }, {});
          const printWeeks = Object.keys(groupedRiwayat).sort();

          if (printWeeks.length === 0) {
            return <div className="p-8 text-center text-slate-500 font-medium">Tidak ada data jurnal di rentang tanggal ini.</div>;
          }

          return printWeeks.map((weekKey, weekIdx) => {
            const items = groupedRiwayat[weekKey];
            const firstDate = items[0].tanggal;
            const lastDate = items[items.length - 1].tanggal;
            const dateText = firstDate === lastDate ? formatDateString(firstDate) : `${formatDateString(firstDate)} s.d. ${formatDateString(lastDate)}`;
            const rombelNamePrint = user?.rombel !== '-' && user?.rombel ? user.rombel.replace(/^Kelas /i, '') : '';
            const roleLabel = user?.role === 'Admin' ? 'Kepala Madrasah' : user?.role === 'Wali Kelas' ? `Wali Kelas ${rombelNamePrint}`.trim() : user?.role === 'Guru Mapel' ? 'Guru Mata Pelajaran' : 'Staf TU';
            return (
              <div key={weekKey} className={`w-full ${weekIdx < printWeeks.length - 1 ? 'page-break-after' : ''}`}>
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
                    <h3 className="text-base font-bold text-slate-800">Laporan Jurnal Mengajar</h3>
                    <p className="text-xs text-slate-600 mt-0.5">Tanggal: {dateText}</p>
                    {user?.role === 'Admin' && filterRombel !== 'Semua' && (
                      <p className="text-xs text-slate-600 mt-0.5">Kelas/Rombel: <span className="font-bold text-green-700">{filterRombel}</span></p>
                    )}
                    {user?.role !== 'Admin' && (
                      <p className="text-xs text-slate-600 mt-0.5">Guru: <span className="font-bold text-green-700">{user?.nama || '-'}</span></p>
                    )}
                  </div>
                </div>

                {/* Tabel Print */}
                <div className="overflow-visible">
                  <table className="w-full text-left border-collapse print:text-black print:bg-white print:table-auto">
                    <thead>
                      <tr className="print:bg-gray-200 print:border-black">
                        <th className="text-xs font-bold print:text-black uppercase tracking-wider text-center">No</th>
                        <th className="text-xs font-bold print:text-black uppercase tracking-wider text-center">Tanggal</th>
                        <th className="text-xs font-bold print:text-black uppercase tracking-wider text-center">Jam</th>
                        {user?.role === 'Admin' && (
                          <th className="text-xs font-bold print:text-black uppercase tracking-wider text-center">Guru</th>
                        )}
                        <th className="text-xs font-bold print:text-black uppercase tracking-wider text-center">Rombel</th>
                        <th className="text-xs font-bold print:text-black uppercase tracking-wider text-center">Mapel</th>
                        <th className="text-xs font-bold print:text-black uppercase tracking-wider col-materi">Materi</th>
                        <th className="text-xs font-bold print:text-black uppercase tracking-wider col-materi">Catatan</th>
                      </tr>
                    </thead>
                    <tbody className="print:divide-black/20">
                      {items.map((j, idx) => (
                        <tr key={j.id} className="print:hover:bg-transparent">
                          <td className="text-[9px] print:text-black print:px-1 print:py-1.5 text-center">{idx + 1}</td>
                          <td className="text-[8px] print:text-black print:px-1 print:py-1.5 text-center whitespace-nowrap">{formatDateString(j.tanggal)}</td>
                          <td className="text-[8px] print:text-black print:px-1 print:py-1.5 text-center">{(j.jam_pelajaran || '-').replace(/\s*\(.*\)/, '')}</td>
                          {user?.role === 'Admin' && (
                            <td className="text-[9px] print:text-black print:px-1 print:py-1.5 text-center">{j.master_user?.nama || '-'}</td>
                          )}
                          <td className="text-[9px] print:text-black print:px-1 print:py-1.5 text-center">{j.rombel}</td>
                          <td className="text-[9px] print:text-black print:px-1 print:py-1.5 text-center">{j.mata_pelajaran}</td>
                          <td className="text-[9px] print:text-black print:px-1 print:py-1.5 col-materi">{j.materi || '-'}</td>
                          <td className="text-[9px] print:text-black print:px-1 print:py-1.5 col-materi">{j.catatan || '-'}</td>
                        </tr>
                      ))}
                      {/* Tanda Tangan */}
                      <tr className="print:table-row print-no-border">
                        <td colSpan={user?.role === 'Admin' ? 7 : 6} className="pt-12 pb-2">
                          <div className="flex w-full text-center text-xs text-black">
                            <div className="w-1/2 flex flex-col items-center">
                              <p className="text-transparent select-none">.</p>
                              <p>Dibuat Oleh,</p>
                              <p className="font-bold uppercase mt-1">{roleLabel},</p>
                              <div className="mt-20 inline-block border-b border-black font-bold whitespace-nowrap break-words px-2">{user?.nama || '-'}</div>
                              <p className="mt-1">-</p>
                            </div>
                            <div className="w-1/2 flex flex-col items-center">
                              <p>Karangrejo, {formatDateString(new Date().toISOString())}</p>
                              <p>Mengetahui Kepala Madrasah,</p>
                              <p className="font-bold uppercase mt-1">MI Miftahul Khoir 1 Karangrejo,</p>
                              <div className="mt-20 inline-block border-b border-black font-bold whitespace-nowrap break-words px-2">Nur Su&apos;ud, S.Pd.I.</div>
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
          });
        })()}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { size: 215mm 330mm portrait; margin: 10mm 10mm 10mm 15mm; }
          body, html { background: white !important; background-color: white !important; -webkit-print-color-adjust: exact; }
          .page-break-after { page-break-after: always; }
          table { border-collapse: collapse; width: 100%; margin-top: 10px; page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
          th, td { border: 1px solid #000; padding: 4px 5px; color: #000 !important; font-size: 9px; }
          .col-materi { white-space: normal !important; width: auto !important; word-wrap: break-word; }
          th { background: #e2e8f0 !important; -webkit-print-color-adjust: exact; }
          .print-no-border, .print-no-border td { border: none !important; }
        }
      `}} />
    </div>
  );
}
