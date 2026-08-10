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
import { formatTimeShort } from '@/lib/dateUtils';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

import useSWR from 'swr';
import { useIsMobile } from '@/hooks/useIsMobile';
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { id } from 'date-fns/locale/id';
import { getTahunPelajaran } from '@/lib/dateUtils';
import AbsenModal from './AbsenModal';

registerLocale('id', id);

export default function JurnalPage() {
  const isMobile = useIsMobile();
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
  const [isAbsenModalOpen, setIsAbsenModalOpen] = useState(false);

  const [filterTglMulai, setFilterTglMulai] = useState(() => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    return new Date(firstDay.getTime() - (firstDay.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
  });
  const [filterTglAkhir, setFilterTglAkhir] = useState(() => {
    const today = new Date();
    return new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
  });
  const [filterRombel, setFilterRombel] = useState('Semua');
  const [filterMapel, setFilterMapel] = useState('Semua');

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
    setAbsensiMapel(prev => ({ ...prev, [id_user]: status }));
  };

  // Rekap Absen summary counts
  const rekapAbsen = {
    Hadir: Object.values(absensiMapel).filter(s => s === 'Hadir').length,
    Sakit: Object.values(absensiMapel).filter(s => s === 'Sakit').length,
    Izin: Object.values(absensiMapel).filter(s => s === 'Izin').length,
    Alfa: Object.values(absensiMapel).filter(s => s === 'Alfa').length,
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

  const { data: riwayatData, isLoading: loadingRiwayat, mutate: mutateRiwayat } = useSWR(user ? `jurnal_riwayat_${user.id_user}_${filterTglMulai}_${filterTglAkhir}_${filterRombel}_${filterMapel}` : null, async () => {
    let query = supabase.from('jurnal_guru').select('*, master_user(nama), data_absensi_mapel(status)').order('tanggal', { ascending: true }).order('jam_pelajaran');
    if (user.role === 'Wali Kelas') {
      query = query.eq('rombel', user.rombel);
    } else if (user.role !== 'Admin') {
      query = query.eq('id_guru', user.id_user);
    }
    if (filterTglMulai && filterTglAkhir) {
      query = query.gte('tanggal', filterTglMulai).lte('tanggal', filterTglAkhir);
    }
    if (user.role === 'Admin' && filterRombel !== 'Semua') {
      query = query.eq('rombel', filterRombel);
    }
    if (user.role === 'Guru Mapel' && filterMapel !== 'Semua') {
      query = query.eq('mata_pelajaran', filterMapel);
    }
    if (user.role !== 'Admin' && filterTglMulai === '' && filterTglAkhir === '') {
      query = query.limit(20);
    }

    const { data } = await query;
    return data || [];
  });

  const riwayat = riwayatData || [];

  const { data: rombelCounts } = useSWR('rombel_counts', async () => {
    const { data: murid } = await supabase.from('master_user').select('rombel').eq('role', 'Murid');
    const counts = {};
    murid?.forEach(m => {
      counts[m.rombel] = (counts[m.rombel] || 0) + 1;
    });
    return counts;
  });

  const [incompleteDates, setIncompleteDates] = useState([]);
  const [missingJournalDates, setMissingJournalDates] = useState([]);

  const { data: indicatorData } = useSWR(user ? `jurnal_indicator_${user.id_user}` : null, async () => {
    const today = new Date();
    // Dari awal bulan lalu
    const startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const startDateStr = startDate.toISOString().split('T')[0];
    const todayStr = today.toISOString().split('T')[0];

    let query = supabase.from('jurnal_guru').select('tanggal, jam_pelajaran').gte('tanggal', startDateStr).lte('tanggal', todayStr);
    if (user.role === 'Wali Kelas') {
      query = query.eq('rombel', user.rombel);
    } else if (user.role !== 'Admin') {
      query = query.eq('id_guru', user.id_user);
    }

    const { data: jurnalData } = await query;

    // Fetch libur
    const { data: liburData } = await supabase.from('master_libur').select('tanggal').gte('tanggal', startDateStr).lte('tanggal', todayStr);

    return {
      jurnal: jurnalData || [],
      libur: (liburData || []).map(l => l.tanggal)
    };
  });

  useEffect(() => {
    if (!indicatorData) return;

    const { jurnal, libur } = indicatorData;

    const grouped = {};
    jurnal.forEach(j => {
      if (!grouped[j.tanggal]) grouped[j.tanggal] = new Set();

      if (j.jam_pelajaran) {
        const matchRange = j.jam_pelajaran.match(/Jam ke-(\d+)\s+s\/d\s+Jam ke-(\d+)/i);
        const matchSingle = j.jam_pelajaran.match(/Jam ke-(\d+)/i);

        if (matchRange) {
          const start = parseInt(matchRange[1], 10);
          const end = parseInt(matchRange[2], 10);
          for (let i = start; i <= end; i++) {
            grouped[j.tanggal].add(i);
          }
        } else if (matchSingle) {
          grouped[j.tanggal].add(parseInt(matchSingle[1], 10));
        }
      }
    });

    const incomplete = [];
    Object.keys(grouped).forEach(date => {
      const hours = grouped[date];
      let isComplete = true;
      for (let i = 1; i <= 8; i++) {
        if (!hours.has(i)) {
          isComplete = false;
          break;
        }
      }
      if (!isComplete) incomplete.push(date);
    });

    setIncompleteDates(incomplete);

    // Missing Journal Dates (Dari awal bulan lalu hingga hari ini)
    const missing = [];
    const today = new Date();
    const todayNormalized = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const currentDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);

    while (currentDate <= todayNormalized) {
      const dateStr = new Date(currentDate.getTime() - (currentDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      const isSunday = currentDate.getDay() === 0;
      const isHoliday = libur.includes(dateStr);
      const hasJournal = grouped[dateStr] !== undefined;

      if (!isSunday && !isHoliday && !hasJournal) {
        missing.push(dateStr);
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    setMissingJournalDates(missing);
  }, [indicatorData]);

  const getDayClassName = (date) => {
    const d = new Date(date);
    const localDate = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

    if (missingJournalDates.includes(localDate)) {
      return '!bg-rose-100 dark:!bg-rose-500/20 !text-rose-700 font-bold';
    }
    if (incompleteDates.includes(localDate)) {
      return '!border-rose-500 !border-2 font-bold';
    }
    return '';
  };

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

  const handleDelete = async (id) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus jurnal ini?')) {
      const { error } = await supabase.from('jurnal_guru').delete().eq('id', id);
      if (error) {
        setMessage({ type: 'error', text: 'Gagal menghapus jurnal' });
      } else {
        setMessage({ type: 'success', text: 'Jurnal berhasil dihapus' });
        mutateRiwayat();
      }
    }
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
          <h3 style="margin: 0; font-size: 14pt; color: #15803d; font-weight: bold;">
            Rekapitulasi Jurnal Pembelajaran Guru - ${user?.role === 'Wali Kelas' ? user.rombel : (user?.role === 'Admin' && filterRombel !== 'Semua' ? filterRombel : (user?.role === 'Guru Mapel' ? (filterMapel !== 'Semua' ? filterMapel : 'Semua Mapel') : 'Semua Mapel'))}
          </h3>
          <p style="margin: 5px 0 2px 0;">${getTahunPelajaran()}</p>
          <p style="margin: 2px 0;">Tanggal: ${dateText}</p>
        </div>
        <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 100%; font-size: 9pt; text-align: center; table-layout: auto;">
          <thead>
            <tr style="background-color: #e2e8f0;">
              <th style="width: 4%;">No</th>
              <th style="width: 14%;">Waktu</th>
              ${user?.role !== 'Wali Kelas' ? '<th style="width: 8%;">Rombel</th>' : ''}
              ${user?.role !== 'Guru Mapel' ? '<th style="width: 28%;">Mata Pelajaran</th>' : ''}
              <th style="text-align: left; width: 23%;">Materi</th>
              <th style="text-align: center; width: 23%;">Kehadiran</th>
            </tr>
          </thead>
          <tbody>
      `;
      exportData.forEach((j, idx) => {
        html += `
          <tr>
            <td>${idx + 1}</td>
            <td style="font-size: 8pt;">
              <div style="font-weight: bold;">${j.tanggal}</div>
              <div style="margin-top: 3px;">${(j.jam_pelajaran || '-').replace(/\s*\(.*\)/, '')}</div>
            </td>
            ${user?.role !== 'Wali Kelas' ? `<td>${j.rombel}</td>` : ''}
            ${user?.role !== 'Guru Mapel' ? `<td>
              <div style="font-weight: bold;">${j.mata_pelajaran}</div>
              <div style="margin-top: 3px; font-size: 8pt;">Guru : ${j.master_user?.nama || '-'}</div>
            </td>` : ''}
            <td style="text-align: left;">${j.materi || '-'}</td>
            <td style="text-align: center;">
              ${(() => {
                const totalSiswa = rombelCounts?.[j.rombel] || 1;
                const absenCount = j.data_absensi_mapel?.length || 0;
                const hadirCount = Math.max(0, totalSiswa - absenCount);
                const persentase = totalSiswa > 0 ? Math.round((hadirCount / totalSiswa) * 100) : 100;
                return `${persentase}%`;
              })()}
            </td>
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
    if (!tanggal || !jamMulai || !rombel || !mapel || !materi || !materi.trim()) {
      setMessage({ type: 'error', text: 'Semua field (termasuk Materi) wajib diisi.' });
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
        finalJamPelajaran = `${jamObjMulai.nama_jam} s/d ${jamObjSelesai.nama_jam} (${jamObjMulai.waktu_mulai}-${jamObjSelesai.waktu_selesai})`;
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

      {user?.role !== 'Admin' && (
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
                <DatePicker withPortal={isMobile} onFocus={(e) => { if (isMobile) e.target.readOnly = true; }}
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
                  dayClassName={getDayClassName}
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

              {/* Card Rekap Absen */}
              <div
                onClick={() => setIsAbsenModalOpen(true)}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-4 sm:p-5 shadow-sm cursor-pointer hover:border-emerald-500/50 dark:hover:border-emerald-500/50 transition-all flex justify-between items-center group"
              ><div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">Rekap Kehadiran</h4>
                  <div className="flex gap-3 sm:gap-4 mt-2 text-xs font-medium">
                    <span className="text-emerald-600 dark:text-emerald-400">Hadir: {rekapAbsen.Hadir}</span>
                    <span className="text-amber-500">Sakit: {rekapAbsen.Sakit}</span>
                    <span className="text-blue-500">Izin: {rekapAbsen.Izin}</span>
                    <span className="text-rose-500">Alfa: {rekapAbsen.Alfa}</span>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 transition-transform duration-300">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>
              </div>

              {/* Tabel Detail Absen (Collapsible) */}
              <AbsenModal
                isOpen={isAbsenModalOpen}
                onClose={() => setIsAbsenModalOpen(false)}
                rekapAbsen={rekapAbsen}
                siswaData={siswaData}
                absensiMapel={absensiMapel}
                handleStatusChange={handleStatusChange}
              />
            </div>
          )}

          {message && (
            <div className={`px-4 py-3 rounded-2xl text-sm font-medium shadow-sm animate-in fade-in slide-in-from-top-2 mb-6 ${message.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-300' : 'bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-300'
              }`}>{message.text}</div>
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
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 z-50 pointer-events-none">DARI:</span>
                <DatePicker withPortal={isMobile} onFocus={(e) => { if (isMobile) e.target.readOnly = true; }}
                  selected={filterTglMulai ? new Date(filterTglMulai) : null}
                  onChange={(date) => {
                    if (date) {
                      const y = date.getFullYear();
                      const m = String(date.getMonth() + 1).padStart(2, '0');
                      const d = String(date.getDate()).padStart(2, '0');
                      setFilterTglMulai(`${y}-${m}-${d}`);
                    }
                  }}
                  dateFormat="dd/MM/yyyy"
                  locale="id"
                  todayButton="Hari Ini"
                  placeholderText="Mulai"
                  wrapperClassName="w-full"
                  className="w-full sm:w-40 pl-11 pr-8 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-sm relative z-40"
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
                  selected={filterTglAkhir ? new Date(filterTglAkhir) : null}
                  onChange={(date) => {
                    if (date) {
                      const y = date.getFullYear();
                      const m = String(date.getMonth() + 1).padStart(2, '0');
                      const d = String(date.getDate()).padStart(2, '0');
                      setFilterTglAkhir(`${y}-${m}-${d}`);
                    }
                  }}
                  dateFormat="dd/MM/yyyy"
                  locale="id"
                  todayButton="Hari Ini"
                  placeholderText="Selesai"
                  wrapperClassName="w-full"
                  className="w-full sm:w-40 pl-16 pr-8 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-sm relative z-40"
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
            {user?.role === 'Guru Mapel' && (
              <div className="relative w-full sm:w-auto">
                <select value={filterMapel} onChange={e => setFilterMapel(e.target.value)}
                  style={{ backgroundImage: 'none' }}
                  className="appearance-none w-full sm:w-36 pl-4 pr-8 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-sm">
                  <option value="Semua" className="bg-white dark:bg-slate-900 text-slate-400">Semua Mapel</option>
                  {(mapelOptions || []).map(m => (
                    <option key={m.id_mapel} value={m.nama_mapel} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{m.nama_mapel}</option>
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
                      <span className="text-slate-900 dark:text-white font-bold text-sm">{j.tanggal.split('-').reverse().join('-')}</span>
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-md text-[10px] font-bold tracking-wider">{(j.jam_pelajaran || '').replace(/\s*\(.*\)/, '')}</span>
                      {(user?.role === 'Admin' || user?.role === 'Wali Kelas') && j.master_user?.nama && (
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
                  {(user?.role !== 'Admin' && j.id_guru === user?.id_user) && (
                    <div className="flex gap-2">
                      <button onClick={() => handleEdit(j)} title="Edit Jurnal" className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-200 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 p-2 rounded-lg transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" /></svg>
                      </button>
                      <button onClick={() => handleDelete(j.id)} title="Hapus Jurnal" className="text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-200 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 p-2 rounded-lg transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                      </button>
                    </div>
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
                    <h3 className="text-base font-bold text-green-700">Rekapitulasi Jurnal Pembelajaran Guru - {user?.role === 'Wali Kelas' ? user.rombel : (user?.role === 'Admin' && filterRombel !== 'Semua' ? filterRombel : (user?.role === 'Guru Mapel' ? (filterMapel !== 'Semua' ? filterMapel : 'Semua Mapel') : 'Semua Mapel'))}</h3>
                    <p className="text-xs text-slate-600 mt-0.5">{getTahunPelajaran()}</p>
                    <p className="text-xs text-slate-600 mt-0.5">Tanggal: {dateText}</p>
                  </div>
                </div>

                {/* Tabel Print */}
                <div className="overflow-visible">
                  <table className="w-full text-left border-collapse print:text-black print:bg-white print:table-auto">
                    <thead>
                      <tr className="print:bg-gray-200 print:border-black">
                        <th className="text-xs font-bold print:text-black uppercase tracking-wider text-center">No</th>
                        <th className="text-xs font-bold print:text-black uppercase tracking-wider text-center">Waktu</th>
                        {user?.role !== 'Wali Kelas' && (
                          <th className="text-xs font-bold print:text-black uppercase tracking-wider text-center">Rombel</th>
                        )}
                        {user?.role !== 'Guru Mapel' && (
                          <th className="text-xs font-bold print:text-black uppercase tracking-wider text-center">Mata Pelajaran</th>
                        )}
                        <th className="text-xs font-bold print:text-black uppercase tracking-wider col-materi">Materi</th>
                        <th className="text-xs font-bold print:text-black uppercase tracking-wider col-materi text-center">Kehadiran</th>
                      </tr>
                    </thead>
                    <tbody className="print:divide-black/20">
                      {items.map((j, idx) => (
                        <tr key={j.id} className="print:hover:bg-transparent">
                          <td className="text-[9px] print:text-black print:px-1 print:py-1.5 text-center">{idx + 1}</td>
                          <td className="text-[8px] print:text-black print:px-1 print:py-1.5 text-center whitespace-nowrap">
                            <div className="font-bold">{formatDateString(j.tanggal)}</div>
                            <div className="mt-0.5">{(j.jam_pelajaran || '-').replace(/\s*\(.*\)/, '')}</div>
                          </td>
                          {user?.role !== 'Wali Kelas' && (
                            <td className="text-[9px] print:text-black print:px-1 print:py-1.5 text-center">{j.rombel}</td>
                          )}
                          {user?.role !== 'Guru Mapel' && (
                            <td className="text-[9px] print:text-black print:px-1 print:py-1.5 text-center">
                              <div className="font-bold">{j.mata_pelajaran}</div>
                              <div className="mt-0.5 text-[8px]">Guru : {j.master_user?.nama || '-'}</div>
                            </td>
                          )}
                          <td className="text-[9px] print:text-black print:px-1 print:py-1.5 col-materi">{j.materi || '-'}</td>
                          <td className="text-[9px] print:text-black print:px-1 print:py-1.5 col-materi text-center">
                            {(() => {
                              const totalSiswa = rombelCounts?.[j.rombel] || 1;
                              const absenCount = j.data_absensi_mapel?.length || 0;
                              const hadirCount = Math.max(0, totalSiswa - absenCount);
                              const persentase = totalSiswa > 0 ? Math.round((hadirCount / totalSiswa) * 100) : 100;
                              return `${persentase}%`;
                            })()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Tanda Tangan */}
                  <div className="flex justify-between items-end mt-12 px-8 text-center text-xs text-black w-full">
                    <div className="flex flex-col items-center">
                      <p className="text-transparent select-none">.</p>
                      <p>Dibuat Oleh,</p>
                      <p className="font-bold uppercase mt-1">{roleLabel},</p>
                      <div className="mt-20 inline-block border-b border-black font-bold whitespace-nowrap break-words px-2">{user?.nama || '-'}</div>
                      <p className="mt-1">-</p>
                    </div>
                    <div className="flex flex-col items-center">
                      <p>Karangrejo, {formatDateString(new Date().toISOString())}</p>
                      <p>Mengetahui Kepala Madrasah,</p>
                      <p className="font-bold uppercase mt-1">MI Miftahul Khoir 1 Karangrejo,</p>
                      <div className="mt-20 inline-block border-b border-black font-bold whitespace-nowrap break-words px-2">Nur Su&apos;ud, S.Pd.I.</div>
                      <p className="mt-1">-</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          });
        })()}
      </div>

      {user?.role !== 'Admin' && !isHoliday && (
        <div className="fixed bottom-6 right-4 sm:right-8 z-[80] flex justify-end pointer-events-none print:hidden">
          <button onClick={handleSave} disabled={saving}
            className="pointer-events-auto flex items-center gap-3 px-6 py-4 bg-emerald-600/90 backdrop-blur-sm rounded-full shadow-2xl hover:bg-emerald-500/90 transition-all active:scale-95 disabled:opacity-50 disabled:transform-none disabled:shadow-none text-white font-bold">
            {saving ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Menyimpan...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
                </svg>
                Simpan Jurnal
              </>
            )}
          </button>
        </div>
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          :root { color-scheme: light !important; }
          @page { size: 215mm 330mm portrait; margin: 10mm 10mm 10mm 15mm; background: white !important; }
          body, html { background: white !important; background-color: white !important; color: black !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
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
