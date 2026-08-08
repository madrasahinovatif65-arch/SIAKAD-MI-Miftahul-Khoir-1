'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import useSWR from 'swr';
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { id } from 'date-fns/locale/id';

registerLocale('id', id);

export default function VerifikasiPage() {
  const [tanggal, setTanggal] = useState(() => new Date().toISOString().split('T')[0]);
  const [absensi, setAbsensi] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('Semua');

  // Range Verification states
  const [showRangeModal, setShowRangeModal] = useState(false);
  const [dateRange, setDateRange] = useState([null, null]);
  const [startDate, endDate] = dateRange;
  const [isProcessingRange, setIsProcessingRange] = useState(false);
  const [rangeMessage, setRangeMessage] = useState(null);

  const statusOptions = ['Hadir', 'Sakit', 'Izin', 'Alfa'];
  const statusColors = {
    'Hadir': 'bg-emerald-500/20 text-emerald-300',
    'Sakit': 'bg-amber-500/20 text-amber-300',
    'Izin': 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
    'Alfa': 'bg-red-500/20 text-red-600 dark:text-red-300',
    'Menunggu Verifikasi': 'bg-yellow-500/20 text-yellow-300',
    'Di Luar Radius': 'bg-orange-500/20 text-orange-300',
  };

  const activeStatusColors = {
    'Semua': 'bg-slate-800 text-white dark:bg-white dark:text-slate-900 shadow-md',
    'Hadir': 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20',
    'Sakit': 'bg-amber-500 text-white shadow-md shadow-amber-500/20',
    'Izin': 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20',
    'Alfa': 'bg-rose-500 text-white shadow-md shadow-rose-500/20',
    'Menunggu Verifikasi': 'bg-yellow-500 text-white shadow-md',
    'Di Luar Radius': 'bg-orange-500 text-white shadow-md'
  };

  const { data: liburDates } = useSWR('master_libur_all', async () => {
    const { data } = await supabase.from('master_libur').select('tanggal');
    return (data || []).map(d => d.tanggal);
  });

  const getDayClassName = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    if (date.getDay() === 0 || (liburDates && liburDates.includes(dateStr))) {
      return 'react-datepicker__day--holiday !text-rose-500 font-bold';
    }
    return undefined;
  };

  const formatTime = (timeStr) => {
    if (!timeStr || timeStr === '-') return '-';
    const match = timeStr.match(/\d{2}[:.]\d{2}[:.]\d{2}/);
    if (match) return match[0].replace(/\./g, ':');
    const matchShort = timeStr.match(/\d{2}[:.]\d{2}/);
    if (matchShort) return matchShort[0].replace(/\./g, ':');
    return timeStr;
  };

  const { data: swrData, isLoading: loading, mutate: reloadData } = useSWR(`verifikasi_${tanggal}`, async () => {
    const d = new Date(tanggal);
    if (d.getDay() === 0) {
      return { isHoliday: true, holidayName: 'Hari Minggu', guruList: [], mergedAbsensi: {} };
    }
    const { data: libur } = await supabase.from('master_libur').select('*').eq('tanggal', tanggal).single();
    if (libur) {
      return { isHoliday: true, holidayName: libur.keterangan, guruList: [], mergedAbsensi: {} };
    }

    const { data: allGuru } = await supabase
      .from('master_user')
      .select('id_user, nama, role, rombel, rfid')
      .in('role', ['Wali Kelas', 'Guru Mapel'])
      .eq('status_aktif', 'Aktif')
      .order('nama');

    const { data: gpsLogs } = await supabase
      .from('log_gps_guru')
      .select('*')
      .eq('tanggal', tanggal);

    const { data: nfcLogs } = await supabase
      .from('view_rekap_absensi_nfc')
      .select('*')
      .eq('tanggal', tanggal);

    const { data: verified } = await supabase
      .from('verifikasi_guru')
      .select('*')
      .eq('tanggal', tanggal);

    // Fetch raw logs for fallback
    const startUTC = new Date(`${tanggal}T00:00:00+07:00`).toISOString();
    const endUTC = new Date(`${tanggal}T23:59:59+07:00`).toISOString();
    const { data: rawLogs } = await supabase.from('log_absensi')
      .select('rfid_uid, waktu')
      .gte('waktu', startUTC)
      .lte('waktu', endUTC);

    const rfidToTime = {};
    (rawLogs || []).forEach(log => {
      const wibTime = new Date(log.waktu).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour12: false });
      if (!rfidToTime[log.rfid_uid]) {
        rfidToTime[log.rfid_uid] = { earliest: wibTime, latest: wibTime };
      } else {
        if (wibTime < rfidToTime[log.rfid_uid].earliest) rfidToTime[log.rfid_uid].earliest = wibTime;
        if (wibTime > rfidToTime[log.rfid_uid].latest) rfidToTime[log.rfid_uid].latest = wibTime;
      }
    });

    const gpsMap = {};
    (gpsLogs || []).forEach(g => { gpsMap[g.id_guru] = g; });
    const nfcMap = {};
    (nfcLogs || []).forEach(n => { nfcMap[n.id_user] = n; });
    const verMap = {};
    (verified || []).forEach(v => { verMap[v.id_guru] = v; });

    const mergedAbsensi = {};
    (allGuru || []).forEach(guru => {
      const gps = gpsMap[guru.id_user];
      const nfc = nfcMap[guru.id_user];
      const ver = verMap[guru.id_user];

      let waktu_datang = null;
      let waktu_pulang = null;

      const rawTimes = rfidToTime[guru.rfid];

      if (nfc) {
        if (nfc.jam_datang) waktu_datang = nfc.jam_datang;
        if (nfc.jam_pulang) waktu_pulang = nfc.jam_pulang;
      }

      if (rawTimes) {
        waktu_datang = waktu_datang || rawTimes.earliest;
        if (rawTimes.latest !== rawTimes.earliest) {
          waktu_pulang = waktu_pulang || rawTimes.latest;
        }
      }
      
      if (gps) {
        // Asumsi: jika GPS > jam 10, itu jam pulang. Jika tidak, jam datang.
        const jamGPS = parseInt(gps.waktu.split(':')[0], 10);
        if (jamGPS >= 10) {
          if (!waktu_pulang) waktu_pulang = gps.waktu;
        } else {
          if (!waktu_datang) waktu_datang = gps.waktu;
        }
      }

      let isLate = false;
      if (waktu_datang) {
        const match = waktu_datang.match(/(\d{2})[:.](\d{2})/);
        if (match) {
          const h = parseInt(match[1], 10);
          const m = parseInt(match[2], 10);
          if (h > 7 || (h === 7 && m > 0)) {
            isLate = true;
          }
        }
      }

      let currentStatus = 'Hadir'; // default
      let catatan = '';
      let metode = 'Otomatis';
      let waktu = '-';

      if (ver) {
        currentStatus = ver.status;
        waktu = ver.waktu;
        metode = ver.metode;
        catatan = ver.catatan || '';
      } else if (nfc || gps) {
        currentStatus = 'Hadir';
        metode = (nfc && gps) ? 'NFC+GPS' : (nfc ? 'NFC' : 'GPS');
        catatan = isLate ? 'Terlambat' : 'Absen Mandiri';
        waktu = waktu_datang || waktu_pulang || '-';
      } else {
        currentStatus = 'Hadir';
        catatan = '';
        metode = '-';
      }

      mergedAbsensi[guru.id_user] = {
        status: currentStatus,
        catatan,
        waktu,
        waktu_datang,
        waktu_pulang,
        metode,
        isLate,
        isNFC: !!nfc,
        isGPS: !!gps,
        isVerified: !!ver,
      };
    });

    return { isHoliday: false, holidayName: '', guruList: allGuru || [], mergedAbsensi };
  });

  const isHoliday = swrData?.isHoliday || false;
  const holidayName = swrData?.holidayName || '';
  const guruList = swrData?.guruList || [];

  useEffect(() => {
    if (swrData?.mergedAbsensi) {
      setAbsensi(swrData.mergedAbsensi);
    }
  }, [swrData?.mergedAbsensi]);

  const handleStatusChange = (id_guru, status) => {
    setAbsensi(prev => ({ ...prev, [id_guru]: { ...prev[id_guru], status } }));
  };

  const handleCatatanChange = (id_guru, catatan) => {
    setAbsensi(prev => ({ ...prev, [id_guru]: { ...prev[id_guru], catatan } }));
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}-${m}-${y}`;
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    const rows = guruList.map(guru => ({
      tanggal,
      id_guru: guru.id_user,
      nama_guru: guru.nama,
      status: absensi[guru.id_user]?.status || 'Hadir',
      catatan: absensi[guru.id_user]?.catatan || '-',
      waktu: absensi[guru.id_user]?.waktu || '-',
      verifikator: 'Admin',
      metode: absensi[guru.id_user]?.metode || '-',
    }));

    const { error } = await supabase
      .from('verifikasi_guru')
      .upsert(rows, { onConflict: 'tanggal,id_guru' });

    setSaving(false);
    if (error) {
      setMessage({ type: 'error', text: 'Gagal menyimpan: ' + error.message });
    } else {
      setMessage({ type: 'success', text: `Verifikasi tanggal ${formatDate(tanggal)} berhasil disimpan!` });
    }
  };

  const handleVerifikasiRentang = async () => {
    if (!startDate || !endDate) {
      setRangeMessage({ type: 'error', text: 'Pilih tanggal mulai dan akhir terlebih dahulu.' });
      return;
    }
    
    if (startDate.getFullYear() !== endDate.getFullYear() || startDate.getMonth() !== endDate.getMonth()) {
      setRangeMessage({ type: 'error', text: 'Rentang tanggal harus berada pada bulan dan tahun yang sama.' });
      return;
    }

    setIsProcessingRange(true);
    setRangeMessage(null);

    try {
      const tglMulaiStr = new Date(startDate.getTime() - (startDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      const tglAkhirStr = new Date(endDate.getTime() - (endDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

      const res = await fetch('/api/sync-guru-range', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tglMulai: tglMulaiStr, tglAkhir: tglAkhirStr })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Terjadi kesalahan.');
      }

      setRangeMessage({ type: 'success', text: data.message });
      reloadData();
    } catch (err) {
      setRangeMessage({ type: 'error', text: err.message });
    } finally {
      setIsProcessingRange(false);
    }
  };

  const filteredGuru = guruList.filter(guru => {
    const st = absensi[guru.id_user]?.status || 'Hadir';
    const matchStatus = filterStatus === 'Semua' || st === filterStatus;
    const searchLow = searchQuery.toLowerCase();
    const matchSearch = guru.nama.toLowerCase().includes(searchLow) || guru.id_user.toLowerCase().includes(searchLow);
    return matchStatus && matchSearch;
  });

  const summary = {};
  statusOptions.forEach(s => summary[s] = 0);
  guruList.forEach(m => {
    const s = absensi[m.id_user]?.status;
    if (summary[s] !== undefined) summary[s]++;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-white tracking-tight">Verifikasi Kehadiran Guru</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Kelola dan verifikasi absensi guru (Otomatis & Manual)</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowRangeModal(true)}
            className="px-4 py-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 rounded-xl text-sm font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all shadow-sm flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            <span className="hidden sm:inline">Sinkronisasi Rentang</span>
            <span className="sm:hidden">Sinkronisasi</span>
          </button>
        </div>
      </div>

      {/* Main Controls */}
      <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-3xl p-4 sm:p-6 shadow-sm">
        {/* Filter Tanggal */}
        <div className="flex flex-wrap gap-4 mb-4">
          <div className="relative w-44">
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
              dayClassName={getDayClassName}
              className="pl-4 pr-10 py-2.5 h-[42px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-white text-sm text-left font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-sm w-full z-50 relative"
              portalId="root-portal"
            />
            <svg className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-50" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z" />
            </svg>
          </div>
        </div>

        {/* Filter Search & Status */}
        {!isHoliday && guruList.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between pt-4 border-t border-slate-200 dark:border-white/10">
            <input
              type="text"
              placeholder="Cari nama..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:max-w-xs px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-sm"
            />
            <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 hide-scrollbar">
              {['Semua', ...statusOptions].map(s => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                    filterStatus === s 
                      ? activeStatusColors[s] || activeStatusColors['Semua']
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Summary Bar */}
      {guruList.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="px-3 py-1.5 rounded-lg text-xs font-semibold border shadow-sm bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
            Total: {guruList.length}
          </span>
          {statusOptions.map(s => (
            <span key={s} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border shadow-sm ${statusColors[s] || 'bg-slate-100 text-slate-600'}`}>
              {s}: {summary[s]}
            </span>
          ))}
        </div>
      )}

      {/* Message */}
      {message && (
        <div className={`px-4 py-3 rounded-xl text-sm font-medium shadow-sm animate-in fade-in slide-in-from-top-2 ${
          message.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-300' : 'bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-300'
        }`}>
          {message.text}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : isHoliday ? (
        <div className="text-center py-12 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
          <svg className="w-12 h-12 text-amber-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
          </svg>
          <h3 className="text-amber-400 font-semibold text-lg">{holidayName}</h3>
          <p className="text-amber-300/70 text-sm mt-1">Presensi ditutup pada hari libur.</p>
        </div>
      ) : guruList.length === 0 ? (
        <div className="text-center py-12 text-slate-600 dark:text-white/30">Tidak ada data guru</div>
      ) : filteredGuru.length === 0 ? (
        <div className="text-center py-12 text-slate-600 dark:text-white/30">Tidak ada guru yang cocok dengan pencarian/filter</div>
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-slate-200 dark:border-white/10 bg-white/50 dark:bg-slate-900/40 backdrop-blur-md shadow-sm">
          <table className="w-full text-sm text-left block md:table">
            <thead className="hidden md:table-header-group">
              <tr className="bg-slate-50/80 dark:bg-white/5 border-b border-slate-200 dark:border-white/10">
                <th className="px-5 py-4 text-slate-500 dark:text-slate-400 font-semibold text-xs uppercase tracking-wider">No</th>
                <th className="px-5 py-4 text-slate-500 dark:text-slate-400 font-semibold text-xs uppercase tracking-wider">Nama</th>
                <th className="px-5 py-4 text-slate-500 dark:text-slate-400 font-semibold text-xs uppercase tracking-wider">Jam/Metode</th>
                <th className="px-5 py-4 text-slate-500 dark:text-slate-400 font-semibold text-xs uppercase tracking-wider text-center">Status</th>
                <th className="px-5 py-4 text-slate-500 dark:text-slate-400 font-semibold text-xs uppercase tracking-wider">Catatan</th>
              </tr>
            </thead>
            <tbody className="block md:table-row-group divide-y divide-transparent md:divide-slate-100 md:dark:divide-white/5">
              {filteredGuru.map((guru, idx) => (
                <tr key={guru.id_user} className="block md:table-row bg-white md:bg-transparent dark:bg-slate-800/40 md:dark:bg-transparent mb-4 md:mb-0 rounded-2xl md:rounded-none border border-slate-100 dark:border-white/5 md:border-none shadow-sm md:shadow-none hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors group">
                  <td className="hidden md:table-cell px-5 py-3 text-slate-500 dark:text-slate-400">{idx + 1}</td>
                  <td className="block md:table-cell px-4 py-3 md:px-5 md:py-3 border-b border-slate-50 dark:border-white/5 md:border-none">
                    <div className="flex justify-between items-start md:block">
                      <div>
                        <div className="text-slate-800 dark:text-white font-medium flex flex-wrap items-center gap-2">
                          <span className="md:hidden mr-1 text-slate-400">{idx + 1}.</span>
                          {guru.nama}
                        </div>
                        <div className="text-slate-400 dark:text-slate-500 font-mono text-xs mt-0.5">{guru.role}</div>
                      </div>
                      <div className="md:hidden mt-1 text-right flex flex-col gap-1 items-end">
                        {absensi[guru.id_user]?.waktu_datang && (
                           <div className="flex items-center gap-1">
                             <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">D</span>
                             <span className="text-xs text-slate-500 font-mono">{formatTime(absensi[guru.id_user]?.waktu_datang)}</span>
                           </div>
                        )}
                        {absensi[guru.id_user]?.waktu_pulang && (
                           <div className="flex items-center gap-1">
                             <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">P</span>
                             <span className="text-xs text-slate-500 font-mono">{formatTime(absensi[guru.id_user]?.waktu_pulang)}</span>
                           </div>
                        )}
                        {(!absensi[guru.id_user]?.waktu_datang && !absensi[guru.id_user]?.waktu_pulang) && (
                          <span className="text-slate-300 dark:text-slate-600 text-[10px] border border-slate-100 dark:border-white/5 px-2 py-0.5 rounded bg-slate-50 dark:bg-white/5">-</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="hidden md:table-cell px-5 py-3">
                    <div className="flex flex-col gap-1">
                      {absensi[guru.id_user]?.waktu_datang && (
                         <div className="flex items-center gap-1.5">
                           <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">D</span>
                           <span className="text-xs font-mono text-slate-500 dark:text-slate-400">{formatTime(absensi[guru.id_user]?.waktu_datang)}</span>
                         </div>
                      )}
                      {absensi[guru.id_user]?.waktu_pulang && (
                         <div className="flex items-center gap-1.5">
                           <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">P</span>
                           <span className="text-xs font-mono text-slate-500 dark:text-slate-400">{formatTime(absensi[guru.id_user]?.waktu_pulang)}</span>
                         </div>
                      )}
                      {(!absensi[guru.id_user]?.waktu_datang && !absensi[guru.id_user]?.waktu_pulang) && (
                        <span className="text-slate-300 dark:text-slate-600 text-xs">-</span>
                      )}
                    </div>
                  </td>
                  <td className="block md:table-cell px-4 py-3 md:px-5 md:py-3 border-b border-slate-50 dark:border-white/5 md:border-none">
                    <div className="flex flex-col gap-2">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider md:hidden">Status Verifikasi</span>
                      <div className="flex gap-2 justify-between md:justify-center">
                        {statusOptions.map(s => (
                          <button
                            key={s}
                            onClick={() => handleStatusChange(guru.id_user, s)}
                            className={`flex-1 md:flex-none md:w-8 h-8 md:h-8 rounded-lg text-xs font-bold border transition-all flex items-center justify-center ${
                              absensi[guru.id_user]?.status === s
                                ? activeStatusColors[s] || 'bg-slate-500 text-white'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 text-slate-400 dark:text-slate-500 hover:border-emerald-300 dark:hover:border-emerald-500/50 hover:text-emerald-500 shadow-sm'
                            }`}
                            title={s}
                          >
                            <span className="md:hidden">{s}</span>
                            <span className="hidden md:inline">{s.charAt(0)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </td>
                  <td className="block md:table-cell px-4 py-3 md:px-5 md:py-3">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider md:hidden">Catatan Tambahan</span>
                      <input
                        type="text"
                        value={absensi[guru.id_user]?.catatan || ''}
                        onChange={e => handleCatatanChange(guru.id_user, e.target.value)}
                        placeholder="Tambahkan catatan..."
                        className="w-full bg-slate-50 md:bg-transparent dark:bg-slate-800/50 md:dark:bg-transparent border md:border-b border-slate-200 md:border-transparent md:hover:border-slate-300 dark:border-white/10 md:dark:hover:border-white/20 rounded-lg md:rounded-none focus:border-emerald-500 md:focus:border-emerald-500 text-slate-700 dark:text-white/80 text-xs py-2 md:py-1.5 px-3 md:px-1 focus:outline-none transition-colors"
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Save Button */}
      {!isHoliday && guruList.length > 0 && (
        <div className="fixed md:sticky bottom-6 md:bottom-4 left-4 right-4 md:left-auto md:right-auto z-50 md:z-20 flex justify-end pointer-events-none">
          <button
            onClick={handleSave}
            disabled={saving}
            className="pointer-events-auto w-full sm:w-auto px-8 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl shadow-xl shadow-emerald-600/30 hover:shadow-emerald-500/40 transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:transform-none disabled:shadow-none flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                Menyimpan...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" /></svg>
                Simpan Verifikasi
              </>
            )}
          </button>
        </div>
      )}

      {/* Sync Modal */}
      {showRangeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 dark:border-white/10 relative">
            <button 
              onClick={() => { setShowRangeModal(false); setRangeMessage(null); }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Verifikasi Rentang Waktu</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              Otomatis isi "Hadir" (Auto-Hadir) untuk guru yang tidak memiliki absen GPS/NFC pada rentang tanggal yang dipilih.
            </p>

            {rangeMessage && (
              <div className={`p-4 rounded-xl mb-6 text-sm font-medium border ${rangeMessage.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400'}`}>
                {rangeMessage.text}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Rentang Tanggal</label>
                <DatePicker
                  selectsRange={true}
                  startDate={startDate}
                  endDate={endDate}
                  onChange={(dates) => setDateRange(dates)}
                  dateFormat="dd-MM-yyyy"
                  locale="id"
                  todayButton="Hari Ini"
                  dayClassName={getDayClassName}
                  placeholderText="Pilih tgl mulai - akhir"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-white text-sm text-left font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-sm"
                />
              </div>
            </div>

            <button 
              onClick={handleVerifikasiRentang}
              disabled={isProcessingRange || !startDate || !endDate}
              className="w-full mt-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/25 hover:shadow-emerald-500/40 transition-all disabled:opacity-50 flex justify-center items-center gap-2"
            >
              {isProcessingRange ? 'Memproses...' : 'Simpan Rentang'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
