'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { formatTimeShort, getTodayDate, getTahunPelajaran } from '@/lib/dateUtils';
import useSWR from 'swr';
import { useIsMobile } from '@/hooks/useIsMobile';
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { id } from 'date-fns/locale/id';

registerLocale('id', id);

// Format tanggal ramah anak & orang tua: "Senin, 13 Oktober 2026"
const formatHariTanggal = (dateStr) => {
  if (!dateStr) return '';
  try {
    const [y, m, d] = dateStr.split('-');
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    return new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  } catch (_) {
    return dateStr;
  }
};

export default function RiwayatMuridPage() {
  const { user } = useAuth();
  const isMobile = useIsMobile();

  // Default tanggal: awal bulan berjalan s.d. hari ini
  const [tglMulai, setTglMulai] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [tglAkhir, setTglAkhir] = useState(() => getTodayDate());
  const [filterStatus, setFilterStatus] = useState('Semua');
  const [activePreset, setActivePreset] = useState('bulan_ini');

  // Quick preset filter
  const applyPreset = (type) => {
    setActivePreset(type);
    const today = new Date();
    const todayStr = getTodayDate();

    if (type === 'bulan_ini') {
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      setTglMulai(`${y}-${m}-01`);
      setTglAkhir(todayStr);
    } else if (type === '30_hari') {
      const past = new Date();
      past.setDate(past.getDate() - 30);
      const y = past.getFullYear();
      const m = String(past.getMonth() + 1).padStart(2, '0');
      const d = String(past.getDate()).padStart(2, '0');
      setTglMulai(`${y}-${m}-${d}`);
      setTglAkhir(todayStr);
    } else if (type === 'semester') {
      const m = today.getMonth() + 1;
      const y = today.getFullYear();
      const start = m >= 7 ? `${y}-07-01` : `${y}-01-01`;
      setTglMulai(start);
      setTglAkhir(todayStr);
    }
  };

  // 1. Ambil data absensi harian (data_absensi + view_rekap_absensi_nfc)
  const { data: swrData, isLoading: loading } = useSWR(
    user && tglMulai && tglAkhir ? `riwayat_murid_${user.id_user}_${tglMulai}_${tglAkhir}` : null,
    async () => {
      // Ambil dari data_absensi
      const { data: absensi } = await supabase
        .from('data_absensi')
        .select('*')
        .eq('nisn', user.id_user)
        .gte('tanggal', tglMulai)
        .lte('tanggal', tglAkhir)
        .order('tanggal', { ascending: false });

      // Ambil dari data_nfc_murid
      const { data: nfc } = await supabase
        .from('view_rekap_absensi_nfc')
        .select('*')
        .eq('id_user', user.id_user)
        .gte('tanggal', tglMulai)
        .lte('tanggal', tglAkhir)
        .order('tanggal', { ascending: false });

      // Merge: absensi overrides NFC tapi jam NFC tetap dipertahankan
      const absenMap = {};
      (absensi || []).forEach((a) => {
        absenMap[a.tanggal] = a;
      });

      const combined = [];
      (nfc || []).forEach((n) => {
        if (!absenMap[n.tanggal]) {
          combined.push({
            tanggal: n.tanggal,
            status: 'Hadir',
            jam_datang: n.jam_datang,
            jam_pulang: n.jam_pulang,
            catatan: n.jam_datang ? `NFC: ${formatTimeShort(n.jam_datang)}${n.jam_pulang ? ' - ' + formatTimeShort(n.jam_pulang) : ''}` : 'Hadir Mandiri via NFC',
            metode: 'NFC',
          });
        }
      });

      (absensi || []).forEach((a) => {
        const nfcMatch = (nfc || []).find((n) => n.tanggal === a.tanggal);
        combined.push({
          ...a,
          jam_datang: a.jam_datang || nfcMatch?.jam_datang,
          jam_pulang: a.jam_pulang || nfcMatch?.jam_pulang,
          metode: a.metode || (nfcMatch ? 'NFC' : 'Manual'),
        });
      });

      combined.sort((a, b) => b.tanggal.localeCompare(a.tanggal));
      return combined;
    }
  );

  const data = swrData || [];

  // 2. Ambil data ketidakhadiran per mata pelajaran
  const { data: absenMapelData, isLoading: loadingMapel } = useSWR(
    user && tglMulai && tglAkhir ? `absen_mapel_murid_${user.id_user}_${tglMulai}_${tglAkhir}` : null,
    async () => {
      const { data } = await supabase
        .from('data_absensi_mapel')
        .select('status, catatan, jurnal_guru!inner(tanggal, jam_pelajaran, mata_pelajaran, rombel)')
        .eq('nisn', user.id_user)
        .gte('jurnal_guru.tanggal', tglMulai)
        .lte('jurnal_guru.tanggal', tglAkhir)
        .order('jurnal_guru(tanggal)', { ascending: false });
      return (data || []).filter((d) => d.status !== 'Hadir');
    }
  );
  const absenMapel = absenMapelData || [];

  // Hitung ringkasan status murid MI (Hadir, Sakit, Izin, Alfa — Card Dispen Ditiadakan)
  const summary = { Hadir: 0, Sakit: 0, Izin: 0, Alfa: 0 };
  data.forEach((d) => {
    if (summary[d.status] !== undefined) {
      summary[d.status]++;
    }
  });

  const total = data.length;
  const persentase = total > 0 ? Math.round((summary.Hadir / total) * 100) : 0;

  // Status Badge Styling
  const getStatusBadge = (status) => {
    switch (status) {
      case 'Hadir':
        return {
          bg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/20',
          dot: 'bg-emerald-500',
          icon: '✓',
          label: 'Hadir',
        };
      case 'Sakit':
        return {
          bg: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300 border-amber-200 dark:border-amber-500/20',
          dot: 'bg-amber-500',
          icon: '🩹',
          label: 'Sakit',
        };
      case 'Izin':
        return {
          bg: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300 border-sky-200 dark:border-sky-500/20',
          dot: 'bg-sky-500',
          icon: '✉️',
          label: 'Izin',
        };
      case 'Alfa':
        return {
          bg: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300 border-rose-200 dark:border-rose-500/20',
          dot: 'bg-rose-500',
          icon: '✕',
          label: 'Alfa',
        };
      default:
        return {
          bg: 'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-white/10',
          dot: 'bg-slate-400',
          icon: '•',
          label: status,
        };
    }
  };

  const filteredData = data.filter((d) => filterStatus === 'Semua' || d.status === filterStatus);

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
      {/* ── 1. Hero / Header Banner Siswa ─────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-600 to-teal-700 p-6 sm:p-8 text-white shadow-xl shadow-emerald-950/10">
        <div className="absolute top-0 right-0 w-72 h-72 bg-white/10 rounded-full blur-3xl -translate-y-1/3 translate-x-1/3 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-60 h-60 bg-teal-900/30 rounded-full blur-2xl translate-y-1/3 -translate-x-1/4 pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-2xl sm:text-3xl font-extrabold shadow-inner shrink-0">
              {user?.nama ? user.nama.charAt(0).toUpperCase() : '👨‍🎓'}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/20 backdrop-blur-md text-emerald-50 border border-white/20">
                  {user?.rombel || 'Siswa'}
                </span>
                {user?.rfid && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-400/20 text-emerald-100 border border-emerald-300/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                    Kartu NFC Aktif
                  </span>
                )}
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight">
                {user?.nama}
              </h1>
              <p className="text-xs sm:text-sm text-emerald-100/80 mt-0.5 font-medium">
                NISN: <span className="font-mono text-white font-bold">{user?.id_user}</span> · {getTahunPelajaran()}
              </p>
            </div>
          </div>

          <div className="self-start md:self-center bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 flex items-center gap-4">
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-wider text-emerald-100/70 font-semibold">
                Performa Kehadiran
              </p>
              <p className="text-2xl sm:text-3xl font-black text-white">
                {persentase}%
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-xl shadow-sm">
              {persentase >= 90 ? '🌟' : persentase >= 75 ? '👍' : '⚠️'}
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. Filter Tanggal & Quick Presets ─────────────────────────────── */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Tombol Pintasan Cepat (Presets) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-xs font-semibold text-slate-400 mr-1 hidden sm:inline">Pintasan:</span>
            {[
              { key: 'bulan_ini', label: 'Bulan Ini' },
              { key: '30_hari', label: '30 Hari Terakhir' },
              { key: 'semester', label: 'Semester Ini' },
            ].map((preset) => (
              <button
                key={preset.key}
                type="button"
                onClick={() => applyPreset(preset.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                  activePreset === preset.key
                    ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Date Picker Custom */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <div className="relative w-full sm:w-auto">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 z-30 pointer-events-none">
                DARI:
              </span>
              <DatePicker
                withPortal={isMobile}
                onFocus={(e) => { if (isMobile) e.target.readOnly = true; }}
                selected={new Date(tglMulai)}
                onChange={(date) => {
                  if (date) {
                    setActivePreset('custom');
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
                className="w-full sm:w-40 pl-14 pr-8 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/50 shadow-sm"
                portalId="root-portal"
              />
            </div>

            <span className="text-slate-300 dark:text-slate-600 font-bold hidden sm:inline">-</span>

            <div className="relative w-full sm:w-auto">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 z-30 pointer-events-none">
                HINGGA:
              </span>
              <DatePicker
                withPortal={isMobile}
                onFocus={(e) => { if (isMobile) e.target.readOnly = true; }}
                selected={new Date(tglAkhir)}
                onChange={(date) => {
                  if (date) {
                    setActivePreset('custom');
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
                className="w-full sm:w-40 pl-16 pr-8 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/50 shadow-sm"
                portalId="root-portal"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. Ringkasan Statistik (Card Dispen Dihapus) ────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card Kehadiran */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-white/10 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Kehadiran</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-sm font-bold shadow-sm">
              ✓
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-800 dark:text-white">{persentase}%</span>
            <span className="text-xs text-slate-400 font-medium">({summary.Hadir}/{total} hari)</span>
          </div>
          <div className="mt-3 w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, persentase)}%` }}
            />
          </div>
        </div>

        {/* Card Sakit */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-white/10 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Sakit</span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center text-sm font-bold shadow-sm">
              🩹
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold text-slate-800 dark:text-white">{summary.Sakit}</span>
            <span className="text-xs text-slate-400 font-medium">Hari</span>
          </div>
          <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
            {summary.Sakit > 0 ? 'Keterangan surat/wali murid' : 'Kondisi sehat walafiat'}
          </p>
        </div>

        {/* Card Izin */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-white/10 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Izin</span>
            <div className="w-8 h-8 rounded-xl bg-sky-100 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center text-sm font-bold shadow-sm">
              ✉️
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold text-slate-800 dark:text-white">{summary.Izin}</span>
            <span className="text-xs text-slate-400 font-medium">Hari</span>
          </div>
          <p className="mt-2 text-[11px] text-sky-600 dark:text-sky-400 font-medium">
            {summary.Izin > 0 ? 'Keperluan keluarga/resmi' : 'Tidak ada catatan izin'}
          </p>
        </div>

        {/* Card Alfa */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-white/10 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Tanpa Keterangan (Alfa)</span>
            <div className="w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center text-sm font-bold shadow-sm">
              ✕
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold text-slate-800 dark:text-white">{summary.Alfa}</span>
            <span className="text-xs text-slate-400 font-medium">Hari</span>
          </div>
          <p className="mt-2 text-[11px] text-rose-600 dark:text-rose-400 font-medium">
            {summary.Alfa === 0 ? '✨ Disiplin sangat baik (0 Alfa)' : 'Harap klarifikasi ke wali kelas'}
          </p>
        </div>
      </div>

      {/* ── 4. Filter Status Tabs (Dispen Ditiadakan) ─────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
          {[
            { key: 'Semua', count: total },
            { key: 'Hadir', count: summary.Hadir },
            { key: 'Sakit', count: summary.Sakit },
            { key: 'Izin', count: summary.Izin },
            { key: 'Alfa', count: summary.Alfa },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilterStatus(tab.key)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                filterStatus === tab.key
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md'
                  : 'bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <span>{tab.key}</span>
              <span
                className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                  filterStatus === tab.key
                    ? 'bg-white/20 dark:bg-slate-900/20 text-white dark:text-slate-900'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <span className="text-xs text-slate-400 font-medium ml-auto">
          Menampilkan <strong className="text-slate-700 dark:text-slate-200">{filteredData.length}</strong> data
        </span>
      </div>

      {/* ── 5. Daftar Riwayat Kehadiran ───────────────────────────────────── */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-slate-100 dark:bg-slate-800/60 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filteredData.length === 0 ? (
        <div className="bg-white/80 dark:bg-slate-900/80 rounded-2xl border border-slate-200/80 dark:border-white/10 p-10 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 mx-auto flex items-center justify-center text-2xl mb-3">
            📅
          </div>
          <h3 className="text-sm font-bold text-slate-700 dark:text-white">
            {filterStatus === 'Semua' ? 'Belum Ada Data Absensi' : `Tidak Ada Catatan ${filterStatus}`}
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Tidak ditemukan riwayat kehadiran untuk rentang tanggal yang dipilih. Ubah filter tanggal di atas untuk melihat periode lainnya.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredData.map((row, idx) => {
            const badge = getStatusBadge(row.status);
            return (
              <div
                key={idx}
                className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-white/10 shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
              >
                {/* Bagian Kiri: Status Icon & Tanggal */}
                <div className="flex items-start sm:items-center gap-3.5">
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center text-base font-extrabold shrink-0 border ${badge.bg}`}
                  >
                    {badge.icon}
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-white leading-tight">
                      {formatHariTanggal(row.tanggal)}
                    </h4>

                    {/* Waktu Masuk & Pulang */}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap text-xs text-slate-500 dark:text-slate-400">
                      {row.jam_datang ? (
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md text-slate-700 dark:text-slate-300">
                          <span>🕒 Datang: {formatTimeShort(row.jam_datang)}</span>
                          {row.jam_pulang && <span>· Pulang: {formatTimeShort(row.jam_pulang)}</span>}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">
                          {row.status === 'Hadir' ? 'Dicatat Wali Kelas' : `Keterangan: ${row.status}`}
                        </span>
                      )}

                      {row.catatan && row.catatan !== '-' && (
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                          &ldquo;{row.catatan}&rdquo;
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bagian Kanan: Status & Metode */}
                <div className="flex items-center gap-2.5 self-end sm:self-center">
                  {row.metode === 'NFC' ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Tap NFC
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-white/5">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                      Presensi Manual
                    </span>
                  )}

                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${badge.bg}`}
                  >
                    {badge.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 6. Injeksi: Ketidakhadiran Mata Pelajaran ───────────────────────── */}
      {(absenMapel.length > 0 || loadingMapel) && (
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold text-sm">
                📚
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                  Ketidakhadiran Sesi Mata Pelajaran
                </h3>
                <p className="text-[11px] text-slate-400">
                  Catatan dari jurnal harian bapak/ibu guru saat Anda tidak berada di kelas
                </p>
              </div>
            </div>

            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40">
              {absenMapel.length} Catatan
            </span>
          </div>

          {loadingMapel ? (
            <div className="flex justify-center py-6">
              <div className="w-6 h-6 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-white/5 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Tanggal</th>
                    <th className="py-2.5 px-3">Jam Ke</th>
                    <th className="py-2.5 px-3">Mata Pelajaran</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3">Catatan Guru</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {absenMapel.map((item, idx) => {
                    const j = item.jurnal_guru;
                    const badge = getStatusBadge(item.status);
                    return (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-3 font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {j ? formatHariTanggal(j.tanggal) : '-'}
                        </td>
                        <td className="py-3 px-3 text-slate-500 dark:text-slate-400 font-mono">
                          {j?.jam_pelajaran ? j.jam_pelajaran.replace(/\s*\(.*\)/, '') : '-'}
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-800 dark:text-white">
                          {j?.mata_pelajaran || '-'}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-500 dark:text-slate-400 italic">
                          {item.catatan || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
