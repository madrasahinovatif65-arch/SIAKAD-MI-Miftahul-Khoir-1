'use client';

import { useEffect, useState, useRef } from 'react';

/**
 * Komponen DoubleBackToExit
 * Menangani perilaku tombol kembali saat berada di halaman Beranda:
 * - Tekanan pertama: Menampilkan peringatan "Tekan tombol kembali sekali lagi untuk keluar"
 * - Tekanan kedua (dalam 2 detik): Mengizinkan keluar dari aplikasi / navigasi mundur
 */
export default function DoubleBackToExit() {
  const [showToast, setShowToast] = useState(false);
  const lastPressRef = useRef(0);
  const toastTimeoutRef = useRef(null);

  useEffect(() => {
    // Fungsi untuk memastikan riwayat memiliki state penjaga (guard)
    const pushGuard = () => {
      try {
        const currentState = window.history.state || {};
        if (!currentState.siakad_home_guard) {
          window.history.pushState(
            { ...currentState, siakad_home_guard: true },
            '',
            window.location.href
          );
        }
      } catch (err) {
        console.warn('[DoubleBackToExit] Gagal inisialisasi guard state:', err);
      }
    };

    // Pasang guard state saat berada di beranda
    pushGuard();

    const handlePopState = (event) => {
      // Jika event menuju ke state penjaga (misal kembali dari sub-halaman lain ke beranda),
      // maka abaikan karena ini adalah navigasi masuk ke beranda.
      if (event.state && event.state.siakad_home_guard) {
        return;
      }

      const now = Date.now();
      const diff = now - lastPressRef.current;

      // Cek apakah penekanan kembali terjadi dalam jendela 2 detik
      if (diff < 2000 && lastPressRef.current > 0) {
        // === Tekanan kedua: Izinkan keluar ===
        lastPressRef.current = 0;
        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
        setShowToast(false);

        // Jika dijalankan di dalam WebView / Android Native Bridge
        if (typeof window !== 'undefined' && window.Android && typeof window.Android.exitApp === 'function') {
          window.Android.exitApp();
          return;
        }

        // Jalankan navigasi kembali asli browser
        window.history.back();

        // Upaya penutupan jendela jika dalam mode PWA / Standalone
        setTimeout(() => {
          try {
            window.close();
          } catch (_) {}
        }, 150);
      } else {
        // === Tekanan pertama: Tampilkan peringatan & tahan di beranda ===
        lastPressRef.current = now;

        // Pasang kembali guard state agar penekanan berikutnya dapat ditangkap
        try {
          const currentState = window.history.state || {};
          window.history.pushState(
            { ...currentState, siakad_home_guard: true },
            '',
            window.location.href
          );
        } catch (_) {}

        // Tampilkan toast
        setShowToast(true);

        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
        toastTimeoutRef.current = setTimeout(() => {
          setShowToast(false);
          lastPressRef.current = 0;
        }, 2000);
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  if (!showToast) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-24 lg:bottom-10 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none transition-all duration-300 ease-out transform animate-in fade-in slide-in-from-bottom-3"
    >
      <div className="flex items-center gap-2.5 px-5 py-3 rounded-full bg-slate-900/95 dark:bg-slate-800/95 text-white text-xs sm:text-sm font-semibold shadow-2xl backdrop-blur-md border border-white/10 ring-1 ring-black/30">
        <span className="text-base flex-shrink-0 animate-bounce">👋</span>
        <span className="tracking-wide">Tekan tombol kembali sekali lagi untuk keluar</span>
      </div>
    </div>
  );
}
