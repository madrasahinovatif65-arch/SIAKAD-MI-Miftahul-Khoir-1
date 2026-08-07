'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import useSWR from 'swr';

export default function AbsenGPSPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState('idle'); // idle | locating | sending | done | error | already | nfc
  const [message, setMessage] = useState('');
  const [location, setLocation] = useState(null);
  const [todayAbsen, setTodayAbsen] = useState(null);
  const [todayNFC, setTodayNFC] = useState(null);

  const SCHOOL_LAT = parseFloat(process.env.NEXT_PUBLIC_SCHOOL_LAT || '-7.123456');
  const SCHOOL_LNG = parseFloat(process.env.NEXT_PUBLIC_SCHOOL_LNG || '112.123456');
  const RADIUS = parseInt(process.env.NEXT_PUBLIC_GPS_RADIUS_METER || '50');

  // Cek apakah sudah absen hari ini (GPS atau NFC) menggunakan SWR
  const { data: todayStatus, mutate: reloadStatus } = useSWR(user ? `absen_gps_${user.id_user}` : null, async () => {
    const today = new Date().toISOString().split('T')[0];

    // Cek NFC dulu (prioritas)
    const { data: nfcData } = await supabase
      .from('nfc_guru')
      .select('*')
      .eq('tanggal', today)
      .eq('id_guru', user.id_user)
      .single();

    if (nfcData) {
      return { type: 'nfc', data: nfcData, message: `Anda sudah tercatat hadir via NFC hari ini (${nfcData.jam_datang || '-'}). GPS dinonaktifkan.` };
    }

    // Cek GPS
    const { data: gpsData } = await supabase
      .from('log_gps_guru')
      .select('*')
      .eq('tanggal', today)
      .eq('id_guru', user.id_user)
      .single();

    if (gpsData) {
      return { type: 'already', data: gpsData, message: `Anda sudah absen GPS hari ini pukul ${gpsData.waktu}. Status: ${gpsData.status}` };
    }

    return null;
  });

  useEffect(() => {
    if (todayStatus) {
      setStatus(todayStatus.type);
      setMessage(todayStatus.message);
      if (todayStatus.type === 'nfc') setTodayNFC(todayStatus.data);
      if (todayStatus.type === 'already') setTodayAbsen(todayStatus.data);
    }
  }, [todayStatus]);

  function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  const handleAbsen = () => {
    if (status === 'nfc' || status === 'already') return;

    setStatus('locating');
    setMessage('Mengambil lokasi GPS...');

    if (!navigator.geolocation) {
      setStatus('error');
      setMessage('GPS tidak didukung oleh perangkat ini.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const distance = calculateDistance(latitude, longitude, SCHOOL_LAT, SCHOOL_LNG);

        setLocation({ latitude, longitude, accuracy, distance });
        setStatus('sending');
        setMessage('Mengirim data absensi...');

        const today = new Date().toISOString().split('T')[0];
        const waktu = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

        const { error } = await supabase.from('log_gps_guru').upsert({
          tanggal: today,
          id_guru: user.id_user,
          nama_guru: user.nama,
          waktu,
          latitude,
          longitude,
          akurasi: Math.round(accuracy),
          jarak_meter: Math.round(distance),
          status: distance <= RADIUS ? 'Menunggu Verifikasi' : 'Di Luar Radius',
        }, { onConflict: 'tanggal,id_guru' });

        if (error) {
          setStatus('error');
          setMessage('Gagal menyimpan: ' + error.message);
        } else {
          setStatus('done');
          setMessage(
            distance <= RADIUS
              ? `✅ Absensi berhasil! Jarak: ${Math.round(distance)}m (dalam radius ${RADIUS}m). Menunggu verifikasi admin.`
              : `⚠️ Absensi tercatat, tetapi Anda di luar radius sekolah (${Math.round(distance)}m > ${RADIUS}m).`
          );
        }
      },
      (err) => {
        setStatus('error');
        setMessage('Gagal mengambil lokasi: ' + err.message);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'nfc': return '📱';
      case 'already': return '✅';
      case 'done': return '🎉';
      case 'error': return '❌';
      case 'locating': case 'sending': return '⏳';
      default: return '📍';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Absen GPS</h2>
        <p className="text-slate-600 dark:text-white/40 text-sm mt-1">Absensi guru berbasis lokasi GPS</p>
      </div>

      {/* Main Card */}
      <div className="bg-white/50 dark:bg-white/5 border border-slate-300 dark:border-white/5 rounded-2xl p-8 text-center space-y-6">
        <div className="text-6xl">{getStatusIcon()}</div>

        <div>
          <p className="text-slate-900 dark:text-white font-semibold text-lg">{user.nama}</p>
          <p className="text-slate-600 dark:text-white/40 text-sm">{user.role} {user.rombel !== '-' ? `· ${user.rombel}` : ''}</p>
        </div>

        {message && (
          <div className={`px-4 py-3 rounded-xl text-sm mx-auto max-w-md ${
            status === 'done' || status === 'already' || status === 'nfc'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
              : status === 'error'
              ? 'bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-300'
              : 'bg-emerald-100 dark:bg-emerald-500/10 border border-blue-500/30 text-emerald-700 dark:text-emerald-300'
          }`}>
            {message}
          </div>
        )}

        {location && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-lg mx-auto">
            {[
              { label: 'Latitude', value: location.latitude.toFixed(6) },
              { label: 'Longitude', value: location.longitude.toFixed(6) },
              { label: 'Akurasi', value: `${Math.round(location.accuracy)}m` },
              { label: 'Jarak', value: `${Math.round(location.distance)}m` },
            ].map(item => (
              <div key={item.label} className="bg-white dark:bg-white/5 shadow-sm dark:shadow-none rounded-xl p-3">
                <p className="text-slate-600 dark:text-white/40 text-xs">{item.label}</p>
                <p className="text-slate-900 dark:text-white font-mono text-sm mt-1">{item.value}</p>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={handleAbsen}
          disabled={status === 'locating' || status === 'sending' || status === 'already' || status === 'nfc'}
          className={`px-12 py-4 text-slate-900 dark:text-white font-semibold rounded-2xl shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed ${
            status === 'nfc' || status === 'already'
              ? 'bg-gray-600'
              : 'bg-gradient-to-r from-blue-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-blue-500/25'
          }`}
        >
          {status === 'locating' ? 'Mengambil Lokasi...' :
           status === 'sending' ? 'Mengirim...' :
           status === 'already' ? 'Sudah Absen Hari Ini' :
           status === 'nfc' ? 'Sudah Tap NFC Hari Ini' :
           status === 'done' ? 'Absen Lagi' :
           'Absen Sekarang'}
        </button>
      </div>

      {/* Info */}
      <div className="bg-white/50 dark:bg-white/5 border border-slate-300 dark:border-white/5 rounded-2xl p-5">
        <h3 className="text-slate-900 dark:text-white font-semibold text-sm mb-2">ℹ️ Sistem Hybrid NFC + GPS</h3>
        <ul className="text-slate-600 dark:text-white/40 text-xs space-y-1">
          <li>• Jika sudah melakukan tap NFC, tombol GPS otomatis nonaktif hari itu.</li>
          <li>• Jika belum tap NFC, Anda bisa absen melalui GPS.</li>
          <li>• Absen GPS memerlukan verifikasi admin.</li>
          <li>• Radius sekolah: {RADIUS} meter dari titik pusat.</li>
        </ul>
      </div>
    </div>
  );
}
