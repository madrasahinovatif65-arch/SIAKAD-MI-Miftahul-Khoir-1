'use client';

import { useState, useEffect } from 'react';
import { formatTimeShort, getTodayDate } from '@/lib/dateUtils';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import useSWR from 'swr';

export default function AbsenGPSWidget() {
  const { user } = useAuth();
  const [status, setStatus] = useState('idle'); // idle | locating | ready | sending | done | error
  const [message, setMessage] = useState('');
  const [location, setLocation] = useState(null);
  const [mode, setMode] = useState('masuk'); // masuk | pulang
  const [existingGpsData, setExistingGpsData] = useState(null);
  const [times, setTimes] = useState(null);
  const [methods, setMethods] = useState(null);

  const SCHOOL_LAT = parseFloat(process.env.NEXT_PUBLIC_SCHOOL_LAT || '-7.123456');
  const SCHOOL_LNG = parseFloat(process.env.NEXT_PUBLIC_SCHOOL_LNG || '112.123456');
  const RADIUS = parseInt(process.env.NEXT_PUBLIC_GPS_RADIUS_METER || '50');

  const { data: todayStatus, mutate: reloadStatus } = useSWR(user ? `absen_gps_${user.id_user}` : null, async () => {
    const today = getTodayDate();

    // Cek Hari Libur
    const { data: libur } = await supabase.from('master_libur').select('*').eq('tanggal', today).single();
    if (libur) return { type: 'error', message: `Hari libur: ${libur.keterangan}. Absensi ditutup.` };

    const todayDate = new Date();
    if (todayDate.getDay() === 0) return { type: 'error', message: 'Hari Minggu. Absensi ditutup.' };

    const [gpsRes, nfcRes, verRes] = await Promise.all([
      supabase.from('log_gps_guru').select('*').eq('tanggal', today).eq('id_guru', user.id_user).single(),
      supabase.from('view_rekap_absensi_nfc').select('*').eq('tanggal', today).eq('id_user', user.id_user).single(),
      supabase.from('verifikasi_guru').select('*').eq('tanggal', today).eq('id_guru', user.id_user).single()
    ]);

    const gpsData = gpsRes.data;
    const nfcData = nfcRes.data;
    const verData = verRes.data;

    let hasMasuk = false;
    let hasPulang = false;
    let timeMasuk = null;
    let timePulang = null;
    let methodMasuk = null;
    let methodPulang = null;

    // 1. Cek Verifikasi Guru (Final status Sakit/Izin/Alfa)
    if (verData && ['Sakit', 'Izin', 'Alfa'].includes(verData.status)) {
      return {
        type: 'error',
        message: `📝 Absensi Anda hari ini telah ditetapkan secara manual dengan status: ${verData.status}.`,
        times: { masuk: '-', pulang: '-' },
        methods: { masuk: verData.verifikator || 'Admin', pulang: verData.verifikator || 'Admin' }
      };
    }

    // 2. Data GPS
    if (gpsData?.waktu) {
      hasMasuk = true;
      timeMasuk = formatTimeShort(gpsData.waktu);
      methodMasuk = 'GPS';
    }
    if (gpsData?.waktu_pulang) {
      hasPulang = true;
      timePulang = formatTimeShort(gpsData.waktu_pulang);
      methodPulang = 'GPS';
    }

    // 3. Data NFC (Prioritas untuk presence fisik - timpa GPS jika ada)
    if (nfcData?.jam_datang) {
      hasMasuk = true;
      timeMasuk = formatTimeShort(nfcData.jam_datang);
      methodMasuk = 'kartu (NFC)';
    }
    if (nfcData?.jam_pulang) {
      hasPulang = true;
      timePulang = formatTimeShort(nfcData.jam_pulang);
      methodPulang = 'kartu (NFC)';
    }

    // Jika Admin verifikasi Hadir manual tapi tidak ada record GPS/NFC
    if (verData && verData.status === 'Hadir' && !hasMasuk) {
      hasMasuk = true;
      timeMasuk = verData.waktu ? formatTimeShort(verData.waktu) : '-';
      methodMasuk = verData.verifikator || 'Admin';
    }

    // Check if waiting for admin verification from GPS (pending status)
    if (verData && (verData.status === 'Menunggu Verifikasi' || verData.status === 'Di Luar Radius')) {
      if (hasMasuk && methodMasuk === 'GPS') methodMasuk = 'GPS (menunggu verifikasi)';
      if (hasPulang && methodPulang === 'GPS') methodPulang = 'GPS (menunggu verifikasi)';
    }

    const times = { masuk: timeMasuk, pulang: timePulang };
    const methods = { masuk: methodMasuk, pulang: methodPulang };

    // Belum absen masuk
    if (!hasMasuk) {
      if (todayDate.getHours() < 6) {
        return { type: 'error', message: 'Absen masuk pagi baru dibuka pukul 06:00.', times, methods };
      }
      return { type: 'idle', mode: 'masuk', gpsData, message: 'Silakan lakukan absen kehadiran (masuk).', times, methods };
    }

    // Sudah absen masuk dan pulang
    if (hasMasuk && hasPulang) {
      if (methodMasuk === methodPulang) {
        return { type: 'done', message: `✅ Anda sudah absen datang dan pulang menggunakan ${methodMasuk} hari ini.`, times, methods };
      }
      return { type: 'done', message: `✅ Anda sudah absen datang menggunakan ${methodMasuk} dan pulang menggunakan ${methodPulang} hari ini.`, times, methods };
    }

    // Jika sudah absen masuk via NFC, langsung nonaktifkan GPS untuk hari ini
    if (hasMasuk && methodMasuk === 'kartu (NFC)') {
      return { type: 'done', message: `✅ Anda sudah absen datang via NFC. Absen GPS dinonaktifkan.`, times, methods };
    }

    // Sudah absen masuk, cek batasan waktu absen pulang
    const isFriday = todayDate.getDay() === 5;
    const h = todayDate.getHours();
    const m = todayDate.getMinutes();

    let canPulang = false;
    let msg = '';

    if (isFriday) {
      if (h > 10 || (h === 10 && m >= 30)) canPulang = true;
      else msg = `Anda sudah absen datang menggunakan ${methodMasuk}. Absen pulang hari Jumat dibuka jam 10:30.`;
    } else {
      if (h >= 12) canPulang = true;
      else msg = `Anda sudah absen datang menggunakan ${methodMasuk}. Absen pulang dibuka jam 12:00.`;
    }

    if (!canPulang) {
      return { type: 'error', message: msg, times, methods };
    }

    return { type: 'idle', mode: 'pulang', gpsData, message: `Anda sudah absen datang menggunakan ${methodMasuk}. Silakan lakukan absen pulang.`, times, methods };
  });

  useEffect(() => {
    if (todayStatus) {
      setStatus(todayStatus.type);
      setMessage(todayStatus.message);
      if (todayStatus.mode) setMode(todayStatus.mode);
      if (todayStatus.gpsData) setExistingGpsData(todayStatus.gpsData);
      if (todayStatus.times) setTimes(todayStatus.times);
      if (todayStatus.methods) setMethods(todayStatus.methods);

      // Auto check permission
      if (todayStatus.type !== 'error' && todayStatus.type !== 'done') {
        if (navigator.permissions && navigator.permissions.query) {
          navigator.permissions.query({ name: 'geolocation' }).then((result) => {
            if (result.state === 'granted') {
              handleRefreshGPS();
            } else if (result.state === 'denied') {
              setStatus('error');
              setMessage('⚠️ Akses lokasi diblokir. Harap izinkan akses lokasi di pengaturan browser.');
            }
            result.onchange = function () {
              if (this.state === 'denied') {
                setStatus('error');
                setMessage('⚠️ Akses lokasi diblokir. Harap izinkan akses lokasi di pengaturan browser.');
              }
            };
          }).catch(() => { });
        }
      }
    }
  }, [todayStatus]);

  function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  const handleRefreshGPS = () => {
    if (status === 'done' || status === 'sending') return;

    reloadStatus();

    const isServerError = todayStatus?.type === 'error';

    if (!navigator.geolocation) {
      if (!isServerError) {
        setStatus('error');
        setMessage('GPS tidak didukung oleh perangkat ini.');
      }
      return;
    }

    if (!isServerError) {
      setStatus('locating');
      setMessage('Mencari sinyal GPS...');
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const distance = calculateDistance(latitude, longitude, SCHOOL_LAT, SCHOOL_LNG);
        setLocation({ latitude, longitude, distance });

        if (isServerError) return;

        if (distance > RADIUS) {
          setStatus('error');
          setMessage(`⚠️ Anda berada di luar radius sekolah (${Math.round(distance)}m). Absen ditolak.`);
          return;
        }

        setStatus('ready');
        setMessage(`📍 Anda berada di dalam radius sekolah (${Math.round(distance)}m).`);
      },
      (err) => {
        if (isServerError) return;
        setStatus('error');
        if (err.code === 1) { // PERMISSION_DENIED
          setMessage('⚠️ Akses lokasi ditolak. Izinkan akses di pengaturan browser Anda.');
        } else {
          setMessage('Gagal mendapatkan lokasi GPS: ' + err.message);
        }
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const handleAbsen = async () => {
    if (!location) {
      handleRefreshGPS();
      return;
    }
    if (location.distance > RADIUS) {
      setStatus('error');
      setMessage('⚠️ Anda berada di luar radius sekolah. Absen ditolak.');
      return;
    }

    setStatus('sending');
    setMessage('Menyimpan data absensi...');

    const today = getTodayDate();
    const waktu = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    const payload = {
      tanggal: today,
      id_guru: user.id_user,
      latitude: location.latitude,
      longitude: location.longitude,
      jarak_meter: Math.round(location.distance),
      status: 'Hadir',
    };

    if (mode === 'masuk') {
      payload.waktu = waktu;
      // Pertahankan waktu pulang jika sebelumnya sudah ada (kasus tidak biasa)
      if (existingGpsData?.waktu_pulang) payload.waktu_pulang = existingGpsData.waktu_pulang;
    } else {
      payload.waktu_pulang = waktu;
      // Pertahankan waktu masuk dari gpsData atau isi '-' jika tidak ada (meski harusnya ada NFC)
      payload.waktu = existingGpsData?.waktu || '-';
    }

    const { error } = await supabase.from('log_gps_guru').upsert(payload, { onConflict: 'tanggal,id_guru' });

    if (error) {
      setStatus('error');
      setMessage('Gagal menyimpan: ' + error.message);
    } else {
      setStatus('done');
      setMessage(`✅ Absen ${mode} tercatat pukul ${waktu}.`);
      reloadStatus();
    }
  };

  if (!user || (user.role !== 'Wali Kelas' && user.role !== 'Guru Mapel')) return null;

  const isDone = status === 'done' || status === 'error';

  return (
    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl rounded-[2rem] p-6 lg:p-8 border border-white/60 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">

        {/* Kiri: Info & Status */}
        <div className="flex items-start gap-4">
          <div className={`w-16 h-16 shrink-0 rounded-2xl flex items-center justify-center shadow-inner ${status === 'done' ? 'bg-gradient-to-br from-emerald-100 to-teal-50 dark:from-emerald-900/40 dark:to-teal-900/20 border border-emerald-200/50 dark:border-emerald-500/20' : 'bg-gradient-to-br from-rose-100 to-red-50 dark:from-rose-900/40 dark:to-red-900/20 border border-rose-200/50 dark:border-rose-500/20'}`}>
            {status === 'done' ? (
              <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            ) : status === 'error' ? (
              <svg className="w-8 h-8 text-rose-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            ) : (
              <svg className="w-8 h-8 text-rose-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
              </svg>
            )}
          </div>
          <div>
            <h3 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white">
              Absen GPS {mode === 'masuk' ? 'Kehadiran' : 'Kepulangan'}
            </h3>
            <p className={`text-sm mt-1 font-medium ${isDone ? (status === 'error' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400') : 'text-slate-500 dark:text-slate-400'}`}>
              {message}
            </p>
            {times && (times.masuk || times.pulang) && (
              <div className="mt-3 flex items-center gap-2 text-[11px] sm:text-xs font-semibold flex-wrap">
                <span className="flex items-center bg-slate-100 dark:bg-white/5 px-2.5 py-1 rounded-md text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10">
                  Masuk: <span className="text-emerald-600 dark:text-emerald-400 ml-1">{times.masuk || '-'}</span>
                  {methods?.masuk && <span className="ml-1 text-slate-400 dark:text-slate-500 text-[10px] font-medium">({methods.masuk})</span>}
                </span>
                <span className="flex items-center bg-slate-100 dark:bg-white/5 px-2.5 py-1 rounded-md text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10">
                  Pulang: <span className="text-emerald-600 dark:text-emerald-400 ml-1">{times.pulang || '-'}</span>
                  {methods?.pulang && <span className="ml-1 text-slate-400 dark:text-slate-500 text-[10px] font-medium">({methods.pulang})</span>}
                </span>
              </div>
            )}
            {location && status === 'ready' && !isDone && (
              <div className="mt-3 flex items-center gap-2 text-[11px] sm:text-xs font-semibold flex-wrap">
                <span className="bg-slate-100 dark:bg-white/5 px-2.5 py-1 rounded-md text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10">
                  Jarak: <span className={location.distance <= RADIUS ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>{Math.round(location.distance)} meter</span>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Kanan: Tombol-tombol */}
        {status !== 'done' && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto shrink-0">
            <button
              onClick={handleRefreshGPS}
              disabled={status === 'locating' || status === 'sending'}
              className="flex justify-center items-center gap-2 px-5 py-3 rounded-xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <svg className={`w-4 h-4 ${status === 'locating' ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              Refresh GPS
            </button>

            <button
              onClick={handleAbsen}
              disabled={status === 'locating' || status === 'sending' || status === 'error' || !location || location.distance > RADIUS}
              className={`flex justify-center items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-white shadow-md transition-all ${(status === 'error' || !location || location.distance > RADIUS)
                  ? 'bg-slate-300 dark:bg-slate-700 shadow-none cursor-not-allowed opacity-50'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 shadow-emerald-500/25 active:scale-95'
                }`}
            >
              {status === 'sending' ? 'Menyimpan...' : (mode === 'masuk' ? 'Absen Masuk' : 'Absen Pulang')}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
