import { getTodayDate } from '@/lib/dateUtils';
'use client';

import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { preload } from 'swr';
import { fetchMasterLibur, fetchPresensiData, fetchVerifikasiGuru, fetchVerifiedDatesGuru } from '@/lib/fetchers';

export default function BackgroundSync() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Run prefetches in background with slight delay to not block initial render
    const timer = setTimeout(() => {
      const today = getTodayDate();

      // 1. Prefetch master_libur_all
      preload('master_libur_all', fetchMasterLibur);

      // 2. Prefetch Presensi Murid if user has rombel
      if (user.rombel && user.rombel !== '-') {
        preload(['presensi', user.rombel, today], fetchPresensiData);
      }

      // 3. Prefetch Verifikasi Guru
      preload('verified_dates_guru', fetchVerifiedDatesGuru);
      preload(['verifikasi', today], fetchVerifikasiGuru);
      
    }, 1500);

    return () => clearTimeout(timer);
  }, [user]);

  return null;
}
