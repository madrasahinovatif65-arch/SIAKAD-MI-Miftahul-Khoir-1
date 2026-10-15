'use client';

import { useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { formatTimeShort, getTodayDate, getTahunPelajaran } from '@/lib/dateUtils';
import useSWR from 'swr';
import { useIsMobile } from '@/hooks/useIsMobile';
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { id } from 'date-fns/locale/id';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

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

// Format ringkas untuk label sumbu X grafik: "Sen, 13 Okt"
const formatChartLabel = (dateStr) => {
  if (!dateStr) return '';
  try {
    const [y, m, d] = dateStr.split('-');
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    return new Intl.DateTimeFormat('id-ID', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }).format(date);
  } catch (_) {
    return dateStr;
  }
};

// Konversi string jam '06:45:00' atau '06.45' ke desimal jam (6.75)
const parseTimeToDecimal = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const match = timeStr.match(/(\d{1,2})[:.](\d{2})/);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return Number((h + m / 60).toFixed(2));
};

// Plugin Chart.js untuk menggambar garis batas jam masuk sekolah (07:00 WIB)
const thresholdLinePlugin = {
  id: 'thresholdLine',
  afterDraw: (chart) => {
    const { ctx, chartArea, scales } = chart;
    if (!chartArea || !scales || !scales.y) return;
    const { left, right, top, bottom } = chartArea;
    const yPos = scales.y.getPixelForValue(7.0);

    if (yPos >= top && yPos <= bottom) {
      ctx.save();
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#f43f5e'; // Rose color
      ctx.lineWidth = 1.5;
      ctx.moveTo(left, yPos);
      ctx.lineTo(right, yPos);
      ctx.stroke();

      // Label teks di ujung garis batas
      ctx.fillStyle = '#f43f5e';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('07:00 (Batas Masuk)', right - 4, yPos - 4);
      ctx.restore();
    }
  },
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

      // Merge: absensi overrides NFC tapi jam NFC tetap dipertahankan untuk kebutuhan grafik
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
            catatan: '',
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
        .select('status, catatan, jurnal_guru!inner(tanggal, jam_pelajaran, mata_pelajaran, rombel, master_user(nama))')
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

  // 3. Olah Data untuk Grafik Batang (Kronologis dari Terlama ke Terbaru)
  const {
    chronologicalData,
    chartConfigData,
    chartOptions,
    avgTimeDisplay,
    tepatWaktuCount,
    terlambatCount,
  } = useMemo(() => {
    const sorted = [...data].sort((a, b) => a.tanggal.localeCompare(b.tanggal));

    let sumDecimal = 0;
    let countHadirWithTime = 0;
    let onTime = 0;
    let late = 0;

    sorted.forEach((item) => {
      if (item.status === 'Hadir') {
        const dec = parseTimeToDecimal(item.jam_datang) || 7.0;
        sumDecimal += dec;
        countHadirWithTime++;
        if (dec <= 7.0) {
          onTime++;
        } else {
          late++;
        }
      }
    });

    const avgDec = countHadirWithTime > 0 ? sumDecimal / countHadirWithTime : null;
    let avgStr = '-';
    if (avgDec !== null) {
      const h = Math.floor(avgDec);
      const m = Math.round((avgDec - h) * 60);
      avgStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} WIB`;
    }

    const labels = sorted.map((d) => formatChartLabel(d.tanggal));
    const values = sorted.map((d) => {
      if (d.status !== 'Hadir') return 0;
      const dec = parseTimeToDecimal(d.jam_datang);
      const actualVal = dec !== null ? dec : 7.0;
      // Batasi tinggi batang maksimal di 7.25 (pukul 07:15) agar tidak overflow skala grafik
      return Math.min(actualVal, 7.25);
    });

    const barColors = sorted.map((d) => {
      if (d.status !== 'Hadir') return 'rgba(148, 163, 184, 0.15)'; // Hari tidak hadir
      const dec = parseTimeToDecimal(d.jam_datang) || 7.0;
      return dec <= 7.0 ? '#10b981' : '#f59e0b'; // Emerald = tepat waktu, Amber = lewat jam 7
    });

    const hoverColors = sorted.map((d) => {
      if (d.status !== 'Hadir') return 'rgba(148, 163, 184, 0.3)';
      const dec = parseTimeToDecimal(d.jam_datang) || 7.0;
      return dec <= 7.0 ? '#059669' : '#d97706';
    });

    const validDecimals = values.filter((v) => v > 0);
    const minVal = validDecimals.length > 0 ? Math.min(...validDecimals) : 6.0;

    // Skala sumbu Y: minimal jam 06:00 (atau lebih awal jika ada siswa tiba < 06:00)
    // dan maksimal tepat di pukul 07:15 (7.25)
    const minY = Math.min(6.0, Math.floor(minVal * 4) / 4);
    const maxY = 7.25; // 07:15 WIB

    const chartData = {
      labels,
      datasets: [
        {
          label: 'Jam Kedatangan',
          data: values,
          backgroundColor: barColors,
          hoverBackgroundColor: hoverColors,
          borderRadius: 6,
          borderSkipped: false,
          barPercentage: 0.6,
          categoryPercentage: 0.8,
        },
      ],
    };

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f172a',
          titleColor: '#ffffff',
          bodyColor: '#cbd5e1',
          padding: 12,
          cornerRadius: 12,
          callbacks: {
            title: (items) => {
              if (!items.length) return '';
              const idx = items[0].dataIndex;
              const item = sorted[idx];
              return formatHariTanggal(item?.tanggal);
            },
            label: (context) => {
              const item = sorted[context.dataIndex];
              if (!item) return '';
              if (item.status !== 'Hadir') {
                return `Status: ${item.status}`;
              }
              const dec = parseTimeToDecimal(item.jam_datang) || 7.0;
              const h = Math.floor(dec);
              const m = Math.round((dec - h) * 60);
              const timeFormatted = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} WIB`;
              const isLate = dec > 7.0;
              const statusStr = isLate ? '⚠️ Terlambat' : '✓ Tepat Waktu';

              const lines = [
                `Jam Datang: ${timeFormatted} (${statusStr})`,
              ];
              if (item.jam_pulang) {
                lines.push(`Jam Pulang: ${formatTimeShort(item.jam_pulang)} WIB`);
              }
              return lines;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: '#94a3b8',
            font: { size: 10, weight: '600' },
            maxRotation: 45,
            minRotation: 0,
          },
        },
        y: {
          min: minY,
          max: maxY,
          grid: {
            color: 'rgba(148, 163, 184, 0.1)',
          },
          ticks: {
            stepSize: 0.25, // Tiap 15 menit: 06:00, 06:15, 06:30, 06:45, 07:00, 07:15
            callback: (val) => {
              const h = Math.floor(val);
              const m = Math.round((val - h) * 60);
              return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            },
            color: '#94a3b8',
            font: { size: 10, weight: '600' },
          },
        },
      },
    };

    return {
      chronologicalData: sorted,
      chartConfigData: chartData,
      chartOptions: options,
      avgTimeDisplay: avgStr,
      tepatWaktuCount: onTime,
      terlambatCount: late,
    };
  }, [data]);

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

      {/* ── 4. Grafik Batang Waktu Kehadiran Siswa (Skala Maks 07:15) ────────── */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-lg shadow-sm">
              📊
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-white">
                Grafik Waktu Kedatangan (Jam Hadir)
              </h3>
              <p className="text-xs text-slate-400">
                Pola jam kehadiran siswa setiap hari selama rentang tanggal terpilih (Skala s.d. 07:15 WIB)
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold">
              <span className="text-slate-400 font-normal">Rata-rata:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{avgTimeDisplay}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold border border-emerald-200/60 dark:border-emerald-800/40">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>{tepatWaktuCount} Tepat Waktu</span>
            </div>
            {terlambatCount > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 text-xs font-semibold border border-amber-200/60 dark:border-amber-800/40">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>{terlambatCount} Terlambat</span>
              </div>
            )}
          </div>
        </div>

        {/* Legend Petunjuk Garis Batas */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-100 dark:border-white/5 pt-3 flex-wrap gap-2">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
              <span>Tepat Waktu (&le; 07:00 WIB)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" />
              <span>Terlambat (&gt; 07:00 WIB)</span>
            </span>
          </div>
          <span className="text-slate-400 italic">
            *Skala sumbu Y: <strong>06:00 s.d. 07:15 WIB</strong> · Garis merah: <strong>07:00 WIB</strong>
          </span>
        </div>

        {/* Canvas Grafik dengan Horizontal Scroll di Layar HP */}
        {chronologicalData.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            Belum ada data kehadiran untuk menampilkan grafik.
          </div>
        ) : (
          <div className="overflow-x-auto hide-scrollbar pt-2">
            <div
              style={{
                minWidth: chronologicalData.length > 10 ? `${chronologicalData.length * 42}px` : '100%',
                height: '240px',
              }}
            >
              <Bar
                data={chartConfigData}
                options={chartOptions}
                plugins={[thresholdLinePlugin]}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── 5. Filter Status Tabs (Dispen Ditiadakan) ─────────────────────── */}
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

      {/* ── 6. Daftar Riwayat Kehadiran (Fokus Catatan Guru & Ketidakhadiran Mapel) ── */}
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
            const isManual = row.metode === 'Manual' || (row.pencatat && row.pencatat !== 'System');
            const namaGuruPencatat = isManual ? (row.pencatat || user?.wali_kelas || 'Wali Kelas') : null;
            const mapelAbsenHariIni = absenMapel.filter(
              (m) => m.jurnal_guru?.tanggal === row.tanggal
            );

            return (
              <div
                key={idx}
                className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-white/10 shadow-sm hover:shadow-md transition-all space-y-3.5 group"
              >
                {/* Header Card: Tanggal, Metode/Pencatat, dan Status */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start sm:items-center gap-3.5">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center text-base font-extrabold shrink-0 border ${badge.bg}`}
                    >
                      {badge.icon}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-slate-800 dark:text-white leading-tight">
                          {formatHariTanggal(row.tanggal)}
                        </h4>

                        {/* Indikator Metode / Absen Manual Guru */}
                        {isManual ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50 shadow-xs">
                            <span>👨‍🏫</span>
                            <span>Absen Manual: <strong>{namaGuruPencatat}</strong></span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                            <span>📡</span>
                            <span>Tap Kartu NFC</span>
                          </span>
                        )}
                      </div>

                      {/* Ringkasan Sub-keterangan */}
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                        {row.status === 'Hadir'
                          ? 'Kehadiran harian tercatat di madrasah'
                          : `Status presensi: ${row.status}`}
                      </p>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="self-end sm:self-center">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${badge.bg}`}
                    >
                      {badge.label}
                    </span>
                  </div>
                </div>

                {/* Kotak Catatan Guru (Harian) jika ada */}
                {row.catatan && row.catatan !== '-' ? (
                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/30 text-xs">
                    <span className="text-amber-500 text-base shrink-0 mt-0.5">💬</span>
                    <div className="space-y-0.5 min-w-0">
                      <div className="text-[11px] font-bold text-amber-900 dark:text-amber-300">
                        Catatan Guru {namaGuruPencatat ? `(${namaGuruPencatat})` : ''}:
                      </div>
                      <div className="text-slate-700 dark:text-slate-200 italic font-medium leading-relaxed">
                        &ldquo;{row.catatan}&rdquo;
                      </div>
                    </div>
                  </div>
                ) : (
                  row.status !== 'Hadir' && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-white/5">
                      <span>📝</span>
                      <span>
                        Tercatat keterangan {row.status} oleh {isManual ? namaGuruPencatat : 'Sistem'}.
                      </span>
                    </div>
                  )
                )}

                {/* Ketidakhadiran Sesi Mapel pada Hari Ini (jika ada) */}
                {mapelAbsenHariIni.length > 0 && (
                  <div className="pt-2.5 border-t border-slate-100 dark:border-white/5 space-y-2">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-600 dark:text-rose-400">
                      <span>⚠️</span>
                      <span>Ketidakhadiran Sesi Mata Pelajaran ({mapelAbsenHariIni.length} Mapel):</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {mapelAbsenHariIni.map((m, mIdx) => {
                        const mBadge = getStatusBadge(m.status);
                        const guruMapel = m.jurnal_guru?.master_user?.nama;
                        return (
                          <div
                            key={mIdx}
                            className="p-2.5 rounded-xl bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/40 text-xs space-y-1.5"
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-slate-800 dark:text-white truncate">
                                {m.jurnal_guru?.mata_pelajaran || 'Mapel'}
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${mBadge.bg} shrink-0`}>
                                {mBadge.label}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                              <span className="font-mono">
                                {m.jurnal_guru?.jam_pelajaran ? m.jurnal_guru.jam_pelajaran.replace(/\s*\(.*\)/, '') : '-'}
                              </span>
                              {guruMapel && (
                                <span className="text-[10px] text-rose-600 dark:text-rose-400 font-medium truncate max-w-[140px]">
                                  👨‍🏫 {guruMapel}
                                </span>
                              )}
                            </div>
                            {m.catatan && (
                              <div className="text-[11px] italic text-rose-700 dark:text-rose-300 bg-white/70 dark:bg-black/20 px-2 py-1 rounded-md border border-rose-100 dark:border-rose-950/40">
                                &ldquo;{m.catatan}&rdquo;
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── 7. Injeksi: Rekap Ketidakhadiran Mata Pelajaran ─────────────────── */}
      {(absenMapel.length > 0 || loadingMapel) && (
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold text-sm">
                📚
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                  Rekap Ketidakhadiran Sesi Mata Pelajaran
                </h3>
                <p className="text-[11px] text-slate-400">
                  Daftar sesi mata pelajaran di mana siswa tercatat tidak mengikuti kelas
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
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-800 dark:text-white">
                            {j?.mata_pelajaran || '-'}
                          </div>
                          {j?.master_user?.nama && (
                            <div className="text-[10px] text-slate-400 font-normal">
                              👨‍🏫 {j.master_user.nama}
                            </div>
                          )}
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
