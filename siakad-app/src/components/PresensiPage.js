'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import useSWR from 'swr';
import { fetchMasterLibur, fetchPresensiData } from '@/lib/fetchers';
import { useIsMobile } from '@/hooks/useIsMobile';
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { id } from 'date-fns/locale/id';

registerLocale('id', id);

export default function PresensiPage() {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const [tanggal, setTanggal] = useState(() => new Date().toISOString().split('T')[0]);
  const [rombel, setRombel] = useState(user?.rombel || '');
  const [absensi, setAbsensi] = useState({});
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('Semua');
  const [message, setMessage] = useState(null);

  // Range Verification states
  const [showRangeModal, setShowRangeModal] = useState(false);
  const [dateRange, setDateRange] = useState([null, null]);
  const [startDate, endDate] = dateRange;
  const [rangeRombel, setRangeRombel] = useState(user?.rombel || '');
  const [isProcessingRange, setIsProcessingRange] = useState(false);
  const [rangeMessage, setRangeMessage] = useState(null);

  const { data: rombelData } = useSWR('master_rombel', async () => {
    if (user?.role === 'Wali Kelas' && user?.rombel && user.rombel !== '-') {
      return [user.rombel];
    }
    const { data } = await supabase.from('master_user').select('rombel').eq('role', 'Murid');
    return [...new Set((data || []).map(d => d.rombel).filter(Boolean))].sort();
  });
  
  const rombelOptions = rombelData || [];
  
  const { data: verifiedDates } = useSWR(rombel ? `verified_dates_${rombel}` : null, async () => {
    const { data } = await supabase.from('data_absensi').select('tanggal').eq('rombel', rombel);
    const uniqueDates = [...new Set((data || []).map(d => d.tanggal))];
    return uniqueDates.map(d => {
      // Pastikan timezone tidak bergeser, parse manual
      const [y, m, day] = d.split('-');
      return new Date(y, m - 1, day);
    });
  });

  const { data: liburDates } = useSWR('master_libur_all', fetchMasterLibur);

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
    // Match HH:MM:SS or HH.MM.SS
    const match = timeStr.match(/\d{2}[:.]\d{2}[:.]\d{2}/);
    if (match) return match[0].replace(/\./g, ':'); // normalize to colon
    const matchShort = timeStr.match(/\d{2}[:.]\d{2}/);
    if (matchShort) return matchShort[0].replace(/\./g, ':');
    return timeStr;
  };

  useEffect(() => {
    if (!rombel && rombelOptions.length > 0) {
      setRombel(user?.rombel && user.rombel !== '-' ? user.rombel : rombelOptions[0]);
    }
  }, [rombel, rombelOptions, user]);

  const { data: presensiData, isLoading: loading, mutate: reloadData } = useSWR(
    rombel && tanggal ? ['presensi', rombel, tanggal] : null, 
    fetchPresensiData
  );

  const isHoliday = presensiData?.isHoliday || false;
  const holidayName = presensiData?.holidayName || '';
  const muridList = presensiData?.murid || [];
  const nfcData = presensiData?.nfcMap || {};

  useEffect(() => {
    if (presensiData?.mergedAbsensi) {
      setAbsensi(presensiData.mergedAbsensi);
    }
  }, [presensiData?.mergedAbsensi]);

  const handleStatusChange = (nisn, status) => {
    setAbsensi(prev => ({ ...prev, [nisn]: { ...prev[nisn], status } }));
  };

  const handleCatatanChange = (nisn, catatan) => {
    setAbsensi(prev => ({ ...prev, [nisn]: { ...prev[nisn], catatan } }));
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}-${m}-${y}`;
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    const rows = muridList.map(m => ({
      tanggal,
      rombel,
      nisn: m.id_user,
      status: absensi[m.id_user]?.status || 'Hadir',
      catatan: absensi[m.id_user]?.catatan || '-',
      pencatat: user.nama,
      metode: nfcData[m.id_user] ? 'NFC' : 'Manual',
    }));

    const { error } = await supabase
      .from('data_absensi')
      .upsert(rows, { onConflict: 'tanggal,nisn' });

    setSaving(false);
    if (error) {
      setMessage({ type: 'error', text: 'Gagal menyimpan: ' + error.message });
    } else {
      setMessage({ type: 'success', text: `Presensi ${rombel} tanggal ${formatDate(tanggal)} berhasil disimpan!` });
    }
  };

  const handleVerifikasiRentang = async () => {
    if (!startDate || !endDate) {
      setRangeMessage({ type: 'error', text: 'Pilih tanggal mulai dan akhir terlebih dahulu.' });
      return;
    }
    if (!rangeRombel) {
      setRangeMessage({ type: 'error', text: 'Pilih kelas terlebih dahulu.' });
      return;
    }
    
    // Validasi 1 bulan
    if (startDate.getFullYear() !== endDate.getFullYear() || startDate.getMonth() !== endDate.getMonth()) {
      setRangeMessage({ type: 'error', text: 'Rentang tanggal harus berada pada bulan dan tahun yang sama.' });
      return;
    }

    setIsProcessingRange(true);
    setRangeMessage(null);

    try {
      const tglMulaiStr = new Date(startDate.getTime() - (startDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      const tglAkhirStr = new Date(endDate.getTime() - (endDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

      const res = await fetch('/api/sync-range', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tglMulai: tglMulaiStr, tglAkhir: tglAkhirStr, rombel: rangeRombel })
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

  const statusOptions = ['Hadir', 'Sakit', 'Izin', 'Alfa'];
  const statusColors = {
    Hadir: 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
    Sakit: 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
    Izin: 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20',
    Alfa: 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20',
  };
  const activeStatusColors = {
    Semua: 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 border-transparent shadow-md',
    Hadir: 'bg-emerald-500 text-white border-transparent shadow-md shadow-emerald-500/20',
    Sakit: 'bg-amber-500 text-white border-transparent shadow-md shadow-amber-500/20',
    Izin: 'bg-blue-500 text-white border-transparent shadow-md shadow-blue-500/20',
    Alfa: 'bg-rose-500 text-white border-transparent shadow-md shadow-rose-500/20',
  };

  const summary = statusOptions.reduce((acc, s) => {
    acc[s] = Object.values(absensi).filter(a => a.status === s).length;
    return acc;
  }, {});

  const filteredMurid = muridList.filter(m => {
    const matchSearch = m.nama.toLowerCase().includes(searchQuery.toLowerCase()) || m.id_user.includes(searchQuery);
    const matchStatus = filterStatus === 'Semua' || absensi[m.id_user]?.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-white tracking-tight">Presensi Murid</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Catat kehadiran harian murid secara efisien</p>
        </div>
        <button
          onClick={() => setShowRangeModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 dark:bg-emerald-500/20 dark:hover:bg-emerald-500/30 dark:text-emerald-300 rounded-xl font-bold text-sm transition-all shadow-sm"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
          </svg>
          Verifikasi Rentang
        </button>
      </div>

      <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-3xl p-4 sm:p-6 shadow-sm">
        {/* Filter Tanggal & Rombel */}
        <div className="flex flex-wrap gap-4 mb-4">
          <div className="relative w-44">
            <DatePicker withPortal={isMobile} onFocus={(e) => { if (isMobile) e.target.readOnly = true; }}
              selected={new Date(tanggal)}
              onChange={(date) => {
                if (date) {
                  // Ensure correct local time date format
                  const y = date.getFullYear();
                  const m = String(date.getMonth() + 1).padStart(2, '0');
                  const d = String(date.getDate()).padStart(2, '0');
                  setTanggal(`${y}-${m}-${d}`);
                }
              }}
              dateFormat="dd-MM-yyyy"
              locale="id"
              todayButton="Hari Ini"
              highlightDates={verifiedDates || []}
              dayClassName={getDayClassName}
              className="pl-4 pr-10 py-2.5 h-[42px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-white text-sm text-left font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-sm w-full z-50 relative"
              portalId="root-portal"
            />
            <svg className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-50" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z" />
            </svg>
          </div>
          <div className="relative w-44">
            <select
              value={rombel}
              onChange={e => setRombel(e.target.value)}
              style={{ backgroundImage: 'none' }}
              className="appearance-none pl-4 pr-10 py-2.5 h-[42px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-sm w-full"
            >
              {rombelOptions.map(r => (
                <option key={r} value={r} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{r}</option>
              ))}
            </select>
            <svg className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          </div>
        </div>

        {/* Filter Search & Status */}
        {!isHoliday && muridList.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between pt-4 border-t border-slate-200 dark:border-white/10">
            <input
              type="text"
              placeholder="Cari nama / NISN..."
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
                      ? activeStatusColors[s]
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
      {muridList.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="px-3 py-1.5 rounded-lg text-xs font-semibold border shadow-sm bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
            Siswa: {muridList.length}
          </span>
          <span className="px-3 py-1.5 rounded-lg text-xs font-semibold border shadow-sm bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20">
            NFC: {muridList.filter(m => !!nfcData[m.id_user]).length}
          </span>
          {statusOptions.map(s => (
            <span key={s} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border shadow-sm ${statusColors[s]}`}>
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
          <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : isHoliday ? (
        <div className="text-center py-12 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
          <svg className="w-12 h-12 text-amber-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
          </svg>
          <h3 className="text-amber-400 font-semibold text-lg">{holidayName}</h3>
          <p className="text-amber-300/70 text-sm mt-1">Presensi ditutup pada hari libur.</p>
        </div>
      ) : muridList.length === 0 ? (
        <div className="text-center py-12 text-slate-600 dark:text-white/30">Tidak ada murid di rombel ini</div>
      ) : filteredMurid.length === 0 ? (
        <div className="text-center py-12 text-slate-600 dark:text-white/30">Tidak ada murid yang cocok dengan pencarian/filter</div>
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-slate-200 dark:border-white/10 bg-white/50 dark:bg-slate-900/40 backdrop-blur-md shadow-sm">
          <table className="w-full text-sm text-left block md:table">
            <thead className="hidden md:table-header-group">
              <tr className="bg-slate-50/80 dark:bg-white/5 border-b border-slate-200 dark:border-white/10">
                <th className="px-5 py-4 text-slate-500 dark:text-slate-400 font-semibold text-xs uppercase tracking-wider">No</th>
                <th className="px-5 py-4 text-slate-500 dark:text-slate-400 font-semibold text-xs uppercase tracking-wider">Nama</th>
                <th className="px-5 py-4 text-slate-500 dark:text-slate-400 font-semibold text-xs uppercase tracking-wider">NFC</th>
                <th className="px-5 py-4 text-slate-500 dark:text-slate-400 font-semibold text-xs uppercase tracking-wider text-center">Status</th>
                <th className="px-5 py-4 text-slate-500 dark:text-slate-400 font-semibold text-xs uppercase tracking-wider">Catatan</th>
              </tr>
            </thead>
            <tbody className="block md:table-row-group divide-y divide-transparent md:divide-slate-100 md:dark:divide-white/5">
              {filteredMurid.map((m, idx) => (
                <tr key={m.id_user} className="block md:table-row bg-white md:bg-transparent dark:bg-slate-800/40 md:dark:bg-transparent mb-4 md:mb-0 rounded-2xl md:rounded-none border border-slate-100 dark:border-white/5 md:border-none shadow-sm md:shadow-none hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors group">
                  <td className="hidden md:table-cell px-5 py-3 text-slate-500 dark:text-slate-400">{idx + 1}</td>
                  <td className="block md:table-cell px-4 py-3 md:px-5 md:py-3 border-b border-slate-50 dark:border-white/5 md:border-none">
                    <div className="flex justify-between items-start md:block">
                      <div>
                        <div className="text-slate-800 dark:text-white font-medium">
                          <span className="md:hidden mr-1.5 text-slate-400">{idx + 1}.</span>
                          {m.nama}
                        </div>
                        <div className="text-slate-400 dark:text-slate-500 font-mono text-xs mt-0.5">{m.id_user}</div>
                      </div>
                      {/* NFC Status for Mobile */}
                      <div className="md:hidden mt-1">
                        {nfcData[m.id_user] ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                            {formatTime(nfcData[m.id_user].jam_datang || nfcData[m.id_user].jam_pulang) || 'Tap'}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600 text-[10px] border border-slate-100 dark:border-white/5 px-2 py-0.5 rounded bg-slate-50 dark:bg-white/5">No NFC</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="hidden md:table-cell px-5 py-3">
                    {nfcData[m.id_user] ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold shadow-sm">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                        {formatTime(nfcData[m.id_user].jam_datang || nfcData[m.id_user].jam_pulang) || 'Tap'}
                      </span>
                    ) : (
                      <span className="text-slate-300 dark:text-slate-600 text-xs">-</span>
                    )}
                  </td>
                  <td className="block md:table-cell px-4 py-3 md:px-5 md:py-3 border-b border-slate-50 dark:border-white/5 md:border-none">
                    <div className="flex flex-col gap-2">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider md:hidden">Status Presensi</span>
                      <div className="flex gap-2 justify-between md:justify-center">
                        {statusOptions.map(s => (
                          <button
                            key={s}
                            onClick={() => handleStatusChange(m.id_user, s)}
                            className={`flex-1 md:flex-none md:w-8 h-8 md:h-8 rounded-lg text-xs font-bold border transition-all flex items-center justify-center ${
                              absensi[m.id_user]?.status === s
                                ? activeStatusColors[s]
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
                        value={absensi[m.id_user]?.catatan || ''}
                        onChange={e => handleCatatanChange(m.id_user, e.target.value)}
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
      {!isHoliday && muridList.length > 0 && (
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
                Simpan Presensi
              </>
            )}
          </button>
        </div>
      )}

      {/* Modal Verifikasi Rentang */}
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
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Otomatisasi absen "Hadir" untuk tanggal yang terlewat. Maksimal 1 bulan berjalan.</p>
            
            {rangeMessage && (
              <div className={`p-4 rounded-xl mb-6 text-sm font-medium border ${rangeMessage.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400'}`}>
                {rangeMessage.text}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Kelas</label>
                <div className="relative">
                  <select
                    value={rangeRombel}
                    onChange={e => setRangeRombel(e.target.value)}
                    style={{ backgroundImage: 'none' }}
                    className="appearance-none w-full pl-4 pr-10 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-sm"
                  >
                    <option value="" className="bg-white dark:bg-slate-900 text-slate-400">Pilih Kelas...</option>
                    {rombelOptions.map(r => (
                      <option key={r} value={r} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{r}</option>
                    ))}
                  </select>
                  <svg className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Rentang Tanggal</label>
                <DatePicker withPortal={isMobile} onFocus={(e) => { if (isMobile) e.target.readOnly = true; }}
                  selectsRange={true}
                  startDate={startDate}
                  endDate={endDate}
                  onChange={(update) => setDateRange(update)}
                  dateFormat="dd-MM-yyyy"
                  locale="id"
                  todayButton="Hari Ini"
                  dayClassName={getDayClassName}
                  placeholderText="Pilih tgl mulai - akhir"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-white text-sm text-left font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-sm"
                />
              </div>
              <button
                onClick={handleVerifikasiRentang}
                disabled={isProcessingRange}
                className="w-full mt-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/25 hover:shadow-emerald-500/40 transition-all disabled:opacity-50 flex justify-center items-center gap-2"
              >
                {isProcessingRange ? 'Memproses...' : 'Simpan Rentang'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
