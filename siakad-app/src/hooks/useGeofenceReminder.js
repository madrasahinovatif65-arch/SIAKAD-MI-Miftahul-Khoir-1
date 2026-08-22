'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { getTodayDate } from '@/lib/dateUtils';

/**
 * Hook: useGeofenceReminder
 * Memantau posisi GPS guru. Jika dalam radius sekolah dan belum absen,
 * serta berada di jendela waktu absen, tampilkan Push Notification pengingat.
 *
 * Aturan:
 * - Hanya aktif untuk role Guru (semua tipe)
 * - Jendela DATANG : 06:00 – 09:00
 * - Jendela PULANG : 12:00 – 16:00 (hari biasa) | 10:30 – 13:00 (Jumat)
 * - Tidak aktif hari Minggu dan hari libur (master_kalender)
 * - Anti-spam: hanya 1 notif per sesi (ditandai di sessionStorage)
 */
export function useGeofenceReminder(user) {
  const watchIdRef = useRef(null);
  const notifiedRef = useRef({
    datang: false,
    pulang: false,
  });

  const SCHOOL_LAT = parseFloat(process.env.NEXT_PUBLIC_SCHOOL_LAT || '-7.123456');
  const SCHOOL_LNG = parseFloat(process.env.NEXT_PUBLIC_SCHOOL_LNG || '112.123456');
  const RADIUS = parseInt(process.env.NEXT_PUBLIC_GPS_RADIUS_METER || '100'); // agak diperlebar untuk pengingat

  useEffect(() => {
    // Hanya jalankan untuk role guru/staf
    const GURU_ROLES = ['Guru Mapel', 'Wali Kelas', 'Kepala Madrasah', 'Admin', 'Staf TU'];
    if (!user || !GURU_ROLES.includes(user.role)) return;

    // Cek apakah browser mendukung Geolocation & Notification
    if (!navigator.geolocation || !('Notification' in window)) return;

    // Ambil flag dari sessionStorage agar tidak berulang di sesi ini
    const sessionKey = `geofence_reminded_${getTodayDate()}_${user.id_user}`;
    const sessionData = JSON.parse(sessionStorage.getItem(sessionKey) || '{}');
    notifiedRef.current = {
      datang: sessionData.datang || false,
      pulang: sessionData.pulang || false,
    };

    function calculateDistance(lat1, lon1, lat2, lon2) {
      const R = 6371000;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    function getWindowType() {
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0=Minggu, 5=Jumat
      const h = now.getHours();
      const m = now.getMinutes();
      const totalMins = h * 60 + m;

      // Minggu: nonaktif
      if (dayOfWeek === 0) return null;

      // Jendela Datang: 06:00 - 09:00 (360 - 540 menit)
      if (totalMins >= 360 && totalMins < 540) return 'datang';

      // Jendela Pulang Jumat: 10:30 - 13:00 (630 - 780 menit)
      if (dayOfWeek === 5 && totalMins >= 630 && totalMins < 780) return 'pulang';

      // Jendela Pulang Biasa: 12:00 - 16:00 (720 - 960 menit)
      if (dayOfWeek !== 5 && totalMins >= 720 && totalMins < 960) return 'pulang';

      return null;
    }

    async function checkAbsenStatus(windowType) {
      const today = getTodayDate();

      try {
        // Cek hari libur
        const { data: kalender } = await supabase
          .from('master_kalender')
          .select('tipe_hari')
          .eq('tanggal', today)
          .single();

        if (kalender && kalender.tipe_hari === 'Libur') return 'libur';

        if (windowType === 'datang') {
          // Cek apakah sudah absen datang (NFC, GPS, atau Verifikasi)
          const [gpsRes, nfcRes, verRes] = await Promise.all([
            supabase.from('log_gps_guru').select('id').eq('tanggal', today).eq('id_guru', user.id_user).single(),
            supabase.from('view_rekap_absensi_nfc').select('id_user').eq('tanggal', today).eq('id_user', user.id_user).single(),
            supabase.from('verifikasi_guru').select('id_guru').eq('tanggal', today).eq('id_guru', user.id_user).single(),
          ]);
          if (gpsRes.data || nfcRes.data || verRes.data) return 'sudah_absen';
          return 'belum_absen';
        }

        if (windowType === 'pulang') {
          // Untuk pulang: cek apakah status GPS sudah 'pulang' atau NFC punya jam_pulang
          const [gpsRes, nfcRes] = await Promise.all([
            supabase.from('log_gps_guru').select('status').eq('tanggal', today).eq('id_guru', user.id_user).single(),
            supabase.from('view_rekap_absensi_nfc').select('jam_pulang').eq('tanggal', today).eq('id_user', user.id_user).single(),
          ]);
          const sudahPulangGPS = gpsRes.data?.status?.toLowerCase() === 'pulang';
          const sudahPulangNFC = !!nfcRes.data?.jam_pulang;
          if (sudahPulangGPS || sudahPulangNFC) return 'sudah_absen';
          return 'belum_absen';
        }
      } catch (_) {
        return 'error';
      }

      return 'belum_absen';
    }

    async function sendGeofenceNotification(windowType) {
      // Cek status absen
      const absenStatus = await checkAbsenStatus(windowType);
      if (absenStatus !== 'belum_absen') return;

      // Minta izin notifikasi jika belum
      let permission = Notification.permission;
      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }
      if (permission !== 'granted') return;

      // Kirim notifikasi via Service Worker agar bisa diklik dan dinavigasi
      const registration = await navigator.serviceWorker?.ready;
      if (!registration) return;

      const isDatang = windowType === 'datang';
      const title = isDatang ? '🏫 Waktunya Absen Datang!' : '🏃 Waktunya Absen Pulang!';
      const body = isDatang
        ? 'Anda terdeteksi di area sekolah. Segera lakukan absensi Datang via NFC atau GPS.'
        : 'Anda masih di area sekolah. Jangan lupa absensi Pulang via NFC atau GPS.';

      registration.showNotification(title, {
        body,
        icon: '/logo.png',
        badge: '/logo.png',
        tag: `geofence-${windowType}`,
        requireInteraction: true,
        vibrate: [200, 100, 200, 100, 200],
        data: { url: '/dashboard/absen-gps' },
      });

      // Tandai sudah diingatkan di sesi ini
      notifiedRef.current[windowType] = true;
      const sessionKey = `geofence_reminded_${getTodayDate()}_${user.id_user}`;
      sessionStorage.setItem(sessionKey, JSON.stringify(notifiedRef.current));
    }

    function onPosition(pos) {
      const { latitude, longitude } = pos.coords;
      const distance = calculateDistance(latitude, longitude, SCHOOL_LAT, SCHOOL_LNG);

      // Jika di luar radius, tidak perlu apa-apa
      if (distance > RADIUS) return;

      const windowType = getWindowType();
      if (!windowType) return;

      // Jika sudah pernah diingatkan di sesi ini, skip
      if (notifiedRef.current[windowType]) return;

      // Kirim pengingat
      sendGeofenceNotification(windowType);
    }

    // Mulai memantau posisi
    watchIdRef.current = navigator.geolocation.watchPosition(
      onPosition,
      (err) => {
        // Izin ditolak atau error - hentikan tanpa noise
        if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
      },
      {
        enableHighAccuracy: false,
        maximumAge: 60000,       // Cache posisi 1 menit agar hemat baterai
        timeout: 30000,
      }
    );

    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [user]);
}
