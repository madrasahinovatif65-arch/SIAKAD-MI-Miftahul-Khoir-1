'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  getPushNotificationStatus,
  subscribeUserToPush,
  unsubscribeUserFromPush,
  sendLocalTestNotification,
} from '@/lib/pushNotification';

export default function NotificationPermissionCard() {
  const { user } = useAuth();
  const [status, setStatus] = useState({
    supported: true,
    permission: 'default',
    isSubscribed: false,
    isLocallyDisabled: false,
    isActive: false,
  });
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [showGuide, setShowGuide] = useState(false);

  const checkStatus = useCallback(async () => {
    const current = await getPushNotificationStatus();
    setStatus(current);
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Hapus pesan feedback otomatis setelah 5 detik
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // Handler: Nyalakan Notifikasi
  const handleEnable = async () => {
    if (!user) return;
    setLoading(true);
    setFeedback(null);

    try {
      await subscribeUserToPush(user.id_user);
      await checkStatus();
      setFeedback({
        type: 'success',
        text: 'Notifikasi berhasil diaktifkan! Anda akan menerima pembaruan di perangkat ini.',
      });

      // Kirim notifikasi selamat datang
      try {
        await sendLocalTestNotification();
      } catch (_) {}
    } catch (err) {
      console.error('[NotificationCard] Enable error:', err);
      setFeedback({
        type: 'error',
        text: err.message || 'Gagal mengaktifkan notifikasi.',
      });
      await checkStatus();
    } finally {
      setLoading(false);
    }
  };

  // Handler: Matikan Notifikasi
  const handleDisable = async () => {
    setLoading(true);
    setFeedback(null);

    try {
      await unsubscribeUserFromPush();
      await checkStatus();
      setFeedback({
        type: 'info',
        text: 'Notifikasi push pada perangkat ini telah dinonaktifkan.',
      });
    } catch (err) {
      console.error('[NotificationCard] Disable error:', err);
      setFeedback({
        type: 'error',
        text: 'Terjadi kesalahan saat mematikan notifikasi.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Handler: Kirim Uji Coba
  const handleTest = async () => {
    setTesting(true);
    try {
      await sendLocalTestNotification();
      setFeedback({
        type: 'success',
        text: 'Notifikasi uji coba berhasil dikirim! Periksa panel notifikasi perangkat Anda.',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err.message || 'Gagal mengirim notifikasi uji coba.',
      });
    } finally {
      setTesting(false);
    }
  };

  // Jika browser tidak mendukung push sama sekali
  if (!status.supported) {
    return (
      <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/30 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-3">
        <span className="text-xl">⚠️</span>
        <div>
          <p className="font-semibold text-sm">Notifikasi Tidak Didukung</p>
          <p className="mt-0.5 text-amber-700/80 dark:text-amber-400">
            Peramban (browser) yang Anda gunakan saat ini tidak mendukung fitur Web Push Notification. Disarankan menggunakan Google Chrome, Microsoft Edge, atau Safari versi terbaru.
          </p>
        </div>
      </div>
    );
  }

  const isDenied = status.permission === 'denied';
  const isActive = status.isActive;

  return (
    <div
      className={`rounded-2xl border transition-all duration-300 p-4 sm:p-5 shadow-sm overflow-hidden ${
        isDenied
          ? 'bg-rose-50/80 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40'
          : isActive
          ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40'
          : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-white/10'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Kolom Informasi & Status */}
        <div className="flex items-start gap-3.5">
          <div
            className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-xl shadow-sm transition-transform ${
              isActive
                ? 'bg-emerald-500 text-white shadow-emerald-500/20'
                : isDenied
                ? 'bg-rose-500 text-white shadow-rose-500/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
            }`}
          >
            {isActive ? '🔔' : isDenied ? '🚫' : '🔕'}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                Notifikasi Perangkat (Push)
              </h3>

              {/* Status Badge */}
              {isActive ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Aktif
                </span>
              ) : isDenied ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  Diblokir Peramban
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                  Nonaktif
                </span>
              )}
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-lg leading-relaxed">
              {isActive
                ? 'Fitur notifikasi aktif. Anda akan menerima pemberitahuan absensi, jurnal, kalender, dan pengumuman madrasah langsung di layar perangkat ini.'
                : isDenied
                ? 'Peramban memblokir izin notifikasi untuk situs ini. Anda dapat membuka blokir melalui ikon setelan di sebelah alamat web browser Anda.'
                : 'Nyalakan notifikasi untuk menerima info jadwal sekolah, konfirmasi tap NFC, dan pengumuman secara real-time meskipun aplikasi sedang tidak dibuka.'}
            </p>
          </div>
        </div>

        {/* Kolom Tombol Aksi */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap sm:self-center">
          {isActive ? (
            <>
              <button
                type="button"
                onClick={handleTest}
                disabled={testing}
                className="px-3 py-2 text-xs font-semibold rounded-xl bg-emerald-100/80 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                title="Kirim notifikasi contoh ke perangkat Anda"
              >
                {testing ? (
                  <span className="w-3.5 h-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>🚀</span>
                )}
                <span>Tes Notifikasi</span>
              </button>

              <button
                type="button"
                onClick={handleDisable}
                disabled={loading}
                className="px-3 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {loading ? (
                  <span className="w-3.5 h-3.5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>🔕</span>
                )}
                <span>Matikan</span>
              </button>
            </>
          ) : isDenied ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowGuide(!showGuide)}
                className="px-3 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10 transition-colors"
              >
                {showGuide ? 'Tutup Panduan' : 'Cara Buka Blokir'}
              </button>
              <button
                type="button"
                onClick={checkStatus}
                className="px-3 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition-colors"
              >
                Cek Ulang Izin
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleEnable}
              disabled={loading}
              className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-md shadow-emerald-500/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Memproses Izin...</span>
                </>
              ) : (
                <>
                  <span>🔔</span>
                  <span>Nyalakan Notifikasi</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Alert Feedback Real-time */}
      {feedback && (
        <div
          className={`mt-3.5 px-3 py-2 rounded-xl text-xs flex items-center gap-2 animate-in fade-in duration-200 ${
            feedback.type === 'success'
              ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              : feedback.type === 'error'
              ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
              : 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
          }`}
        >
          <span>{feedback.type === 'success' ? '✅' : feedback.type === 'error' ? '❌' : 'ℹ️'}</span>
          <span className="flex-1 leading-relaxed">{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600 font-bold px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Panduan Membuka Blokir Izin Browser */}
      {showGuide && isDenied && (
        <div className="mt-4 pt-3.5 border-t border-rose-200/80 dark:border-rose-900/40 text-xs text-slate-600 dark:text-slate-300 space-y-2.5 animate-in fade-in duration-300">
          <p className="font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
            <span>💡</span> Panduan Mengizinkan Notifikasi di Browser:
          </p>
          <ol className="list-decimal list-inside space-y-1.5 pl-1 leading-relaxed text-slate-600 dark:text-slate-400">
            <li>
              Klik <strong>ikon gembok / setelan situs (🔒 atau ⚙️)</strong> di sebelah kiri bilah alamat (URL) browser Anda.
            </li>
            <li>
              Cari opsi <strong>Notifikasi (Notifications)</strong>, lalu ubah pilihannya dari <em>Blokir</em> menjadi <strong>Izinkan (Allow)</strong>.
            </li>
            <li>
              Jika menggunakan HP Android (Chrome), Anda juga dapat masuk ke <em>Titik Tiga (⋮) &gt; Setelan &gt; Setelan Situs &gt; Notifikasi</em>.
            </li>
            <li>
              Setelah itu, klik tombol <strong>&ldquo;Cek Ulang Izin&rdquo;</strong> di samping.
            </li>
          </ol>
        </div>
      )}
    </div>
  );
}
