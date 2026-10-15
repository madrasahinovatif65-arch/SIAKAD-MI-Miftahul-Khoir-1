'use client';

import { formatCacheAge } from '@/lib/muridCache';

/**
 * OfflineBanner
 * Banner yang muncul saat murid offline, menampilkan data cache terakhir.
 * Muncul di atas halaman Dashboard dan Riwayat Absen murid.
 */
export default function OfflineBanner({ isOffline, cacheAge, onRefresh }) {
  if (!isOffline) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
      {/* Icon */}
      <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center text-lg shrink-0">
        📶
      </div>

      {/* Teks */}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-bold text-amber-900 dark:text-amber-300">
          Sedang Offline
        </div>
        <div className="text-[11px] text-amber-700/80 dark:text-amber-400/80 leading-relaxed">
          {cacheAge
            ? `Menampilkan data terakhir · disimpan ${formatCacheAge(cacheAge)}`
            : 'Tidak ada data tersimpan. Buka halaman ini saat online agar data ter-cache.'}
        </div>
      </div>

      {/* Tombol refresh */}
      {onRefresh && (
        <button
          onClick={onRefresh}
          className="shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-amber-200 dark:bg-amber-800/50 text-amber-900 dark:text-amber-200 hover:bg-amber-300 dark:hover:bg-amber-700/60 active:scale-95 transition-all"
        >
          Coba Lagi
        </button>
      )}
    </div>
  );
}
