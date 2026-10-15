'use client';

import { useState, useEffect, useCallback } from 'react';
import { getCacheData, setCacheData } from '@/lib/muridCache';

/**
 * useMuridOfflineData
 * Hook generik untuk data offline role Murid.
 * 
 * - Saat online: jalankan fetcher → simpan hasil ke IndexedDB cache
 * - Saat offline: fetcher dilewati → ambil dari IndexedDB cache
 * - Mengembalikan { data, isLoading, isOffline, cacheAge, refresh }
 * 
 * @param {string|null} cacheKey - Key unik cache (null = tidak fetch)
 * @param {() => Promise<*>} fetcher - Async function yang fetch data dari Supabase
 * @param {*} fallback - Nilai default jika tidak ada data
 */
export function useMuridOfflineData(cacheKey, fetcher, fallback = null) {
  const [data, setData] = useState(fallback);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [cacheAge, setCacheAge] = useState(null); // timestamp savedAt

  const load = useCallback(async () => {
    if (!cacheKey) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const online = typeof navigator !== 'undefined' ? navigator.onLine : true;

    if (online) {
      try {
        const freshData = await fetcher();
        setData(freshData);
        setIsOffline(false);
        setCacheAge(null);
        // Simpan ke cache IndexedDB
        await setCacheData(cacheKey, freshData);
      } catch (err) {
        console.warn('[useMuridOfflineData] fetch failed, trying cache:', err);
        // Fetch gagal → coba cache
        const cached = await getCacheData(cacheKey);
        if (cached) {
          setData(cached.data);
          setIsOffline(true);
          setCacheAge(cached.savedAt);
        } else {
          setData(fallback);
          setIsOffline(true);
        }
      }
    } else {
      // Offline: langsung pakai cache
      const cached = await getCacheData(cacheKey);
      if (cached) {
        setData(cached.data);
        setCacheAge(cached.savedAt);
      } else {
        setData(fallback);
      }
      setIsOffline(true);
    }

    setIsLoading(false);
  }, [cacheKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  // Dengarkan perubahan status koneksi
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      load(); // Auto-refresh saat kembali online
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [load]);

  return {
    data,
    isLoading,
    isOffline,
    cacheAge,
    refresh: load,
  };
}

/**
 * useIsOffline
 * Hook sederhana untuk mendeteksi status koneksi.
 * @returns {boolean}
 */
export function useIsOffline() {
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );

  useEffect(() => {
    const on = () => setIsOffline(false);
    const off = () => setIsOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  return isOffline;
}
