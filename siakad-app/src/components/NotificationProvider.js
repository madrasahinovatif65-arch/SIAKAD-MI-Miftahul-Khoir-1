'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { supabaseNfc } from '@/lib/supabaseNfc';
import Link from 'next/link';

export default function NotificationProvider() {
  const { user } = useAuth();
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!user) return;
    console.log('[NotificationProvider] Initializing for user:', user.id_user, 'Role:', user.role);

    // Request notification permission
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }

    // Format waktu ISO/timestamp ke HH:MM
    const formatTime = (isoOrTimeStr) => {
      if (!isoOrTimeStr) return '';
      try {
        // Coba parse sebagai ISO timestamp (dari Supabase waktu GPS)
        const d = new Date(isoOrTimeStr);
        if (!isNaN(d)) {
          const wib = new Date(d.getTime() + (7 * 60 * 60 * 1000));
          const h = String(wib.getUTCHours()).padStart(2, '0');
          const m = String(wib.getUTCMinutes()).padStart(2, '0');
          return `${h}:${m}`;
        }
      } catch (_) {}
      // Jika format string waktu "HH.MM" atau "HH:MM"
      return isoOrTimeStr.replace('.', ':').substring(0, 5);
    };

    const showNotification = (title, body, href = '/dashboard/riwayat') => {
      console.log('[NotificationProvider] Showing notification:', title, body);
      // Show system notification if granted
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(title, { body, icon: '/logo.png' });
        } catch (error) {
          console.warn('[NotificationProvider] System notification failed, likely on mobile Chrome:', error);
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(registration => {
              registration.showNotification(title, { body, icon: '/logo.png' }).catch(console.error);
            }).catch(console.error);
          }
        }
      }

      // Show in-app toast
      setToast({ title, body, href, id: Date.now() });
    };

    let channel;
    let gpsChannel;
    let nfcChannel;

    if (user.rfid && supabaseNfc) {
      console.log('[NotificationProvider] Subscribing to NFC Realtime for RFID:', user.rfid);
      nfcChannel = supabaseNfc
        .channel('realtime-nfc')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'log_absensi', filter: `rfid_uid=eq.${user.rfid}` },
          (payload) => {
            console.log('[NotificationProvider] NFC Payload received:', payload);
            const waktu = formatTime(payload.new?.waktu);
            const jenis = payload.new?.jenis_absen || 'Absen';
            const timeStr = waktu ? ` pukul ${waktu}` : '';
            showNotification(
              `Tap NFC Berhasil 💳`,
              `${jenis} Anda telah terdeteksi${timeStr} WIB.`,
              '/dashboard/riwayat'
            );
          }
        )
        .subscribe((status) => console.log('[NotificationProvider] NFC Status:', status));
    }

    if (user.role === 'Murid') {
      console.log('[NotificationProvider] Subscribing to Murid Realtime');
      channel = supabase
        .channel('realtime-absensi')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'data_absensi', filter: `nisn=eq.${user.id_user}` },
          (payload) => {
            if (payload.eventType === 'DELETE') return;
            const { status, created_at } = payload.new;
            const waktu = formatTime(created_at);
            const timeStr = waktu ? ` pukul ${waktu}` : '';
            if (status) showNotification(
              'Absensi Tercatat ✅',
              `Kehadiran Anda dicatat${timeStr}: ${status}.`,
              '/dashboard/riwayat'
            );
          }
        )
        .subscribe((status) => console.log('[NotificationProvider] Murid Status:', status));
    } else if (['Guru Mapel', 'Wali Kelas', 'Kepala Madrasah', 'Admin'].includes(user.role)) {
      console.log('[NotificationProvider] Subscribing to Guru Realtime');
      channel = supabase
        .channel('realtime-verifikasi')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'verifikasi_guru', filter: `id_guru=eq.${user.id_user}` },
          (payload) => {
            if (payload.eventType === 'DELETE') return;
            const { status, metode, created_at } = payload.new;
            const waktu = formatTime(created_at);
            const timeStr = waktu ? ` pukul ${waktu}` : '';
            if (status) showNotification(
              'Verifikasi Kehadiran 📋',
              `Kehadiran Anda (${metode || 'Sistem'}) diverifikasi${timeStr}: ${status}.`,
              '/dashboard/riwayat'
            );
          }
        )
        .subscribe((status) => console.log('[NotificationProvider] Verifikasi Status:', status));

      console.log('[NotificationProvider] Subscribing to GPS Realtime');
      gpsChannel = supabase
        .channel('realtime-gps')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'log_gps_guru', filter: `id_guru=eq.${user.id_user}` },
          (payload) => {
            console.log('[NotificationProvider] GPS Payload received:', payload);
            if (payload.eventType === 'DELETE') return;
            const { status, waktu, created_at } = payload.new;
            // Waktu GPS disimpan dalam format "HH.MM", fallback ke created_at
            const timeDisplay = waktu ? formatTime(waktu) : formatTime(created_at);
            const timeStr = timeDisplay ? ` pukul ${timeDisplay}` : '';
            if (status) showNotification(
              'Absen GPS Berhasil 📍',
              `Lokasi Anda tersimpan${timeStr} WIB dengan status: ${status}.`,
              '/dashboard/riwayat'
            );
          }
        )
        .subscribe((status) => console.log('[NotificationProvider] GPS Status:', status));
    }

    return () => {
      console.log('[NotificationProvider] Cleaning up subscriptions');
      if (channel) supabase.removeChannel(channel);
      if (gpsChannel) supabase.removeChannel(gpsChannel);
      if (nfcChannel && supabaseNfc) supabaseNfc.removeChannel(nfcChannel);
    };
  }, [user]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  if (!toast) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] animate-in slide-in-from-top-2 fade-in duration-300 max-w-[340px] w-[calc(100vw-2rem)]">
      <Link
        href={toast.href || '/dashboard/riwayat'}
        onClick={() => setToast(null)}
        className="block"
      >
        <div className="bg-white dark:bg-slate-800 shadow-2xl border border-emerald-500/30 rounded-2xl p-4 flex gap-3 items-start cursor-pointer hover:border-emerald-500/60 hover:shadow-emerald-500/10 transition-all duration-200 group">
          {/* Ikon */}
          <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-500/20 rounded-full flex items-center justify-center shrink-0 group-hover:bg-emerald-200 dark:group-hover:bg-emerald-500/30 transition-colors">
            <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
            </svg>
          </div>

          {/* Teks */}
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-slate-800 dark:text-white text-sm leading-tight">{toast.title}</h4>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 leading-snug">{toast.body}</p>
            <p className="text-emerald-600 dark:text-emerald-400 text-xs mt-2 font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
              Lihat riwayat
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </p>
          </div>

          {/* Tombol tutup */}
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setToast(null); }}
            className="text-slate-300 hover:text-slate-500 dark:text-slate-600 dark:hover:text-slate-400 transition-colors shrink-0 mt-0.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </Link>
    </div>
  );
}
