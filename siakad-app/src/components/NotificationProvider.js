'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { supabaseNfc } from '@/lib/supabaseNfc';
import Link from 'next/link';

// Helper: konversi VAPID public key Base64URL → Uint8Array
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export default function NotificationProvider() {
  const { user } = useAuth();
  const [toast, setToast] = useState(null);

  // ── Daftarkan Web Push Subscription ──────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) return;

    const registerPush = async () => {
      try {
        // Minta izin notifikasi
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          console.log('[Push] Notifikasi tidak diizinkan');
          return;
        }

        const registration = await navigator.serviceWorker.ready;

        // Cek apakah sudah ada subscription
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
          // Buat subscription baru
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey),
          });
          console.log('[Push] Subscription baru dibuat');
        }

        // Kirim subscription ke server
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_user: user.id_user, subscription }),
        });
        console.log('[Push] Subscription berhasil disimpan ke server untuk:', user.id_user);
      } catch (err) {
        console.error('[Push] Gagal mendaftarkan push subscription:', err);
      }
    };

    registerPush();
  }, [user]);

  // ── Realtime In-App Toast (untuk saat aplikasi sedang dibuka) ────────────
  useEffect(() => {
    if (!user) return;
    console.log('[NotificationProvider] Initializing for user:', user.id_user, 'Role:', user.role);

    // Format waktu ISO/timestamp ke HH:MM WIB
    const formatTime = (isoOrTimeStr) => {
      if (!isoOrTimeStr) return '';
      try {
        const d = new Date(isoOrTimeStr);
        if (!isNaN(d)) {
          const wib = new Date(d.getTime() + 7 * 60 * 60 * 1000);
          return `${String(wib.getUTCHours()).padStart(2, '0')}:${String(wib.getUTCMinutes()).padStart(2, '0')}`;
        }
      } catch (_) {}
      return isoOrTimeStr.replace('.', ':').substring(0, 5);
    };

    const showToast = (title, body, href = '/dashboard/riwayat') => {
      console.log('[NotificationProvider] Toast:', title, body);
      setToast({ title, body, href, id: Date.now() });
    };

    let channel, gpsChannel, nfcChannel;

    // NFC — subscribe ke Supabase NFC
    if (user.rfid && supabaseNfc) {
      console.log('[NotificationProvider] Subscribing NFC for RFID:', user.rfid);
      nfcChannel = supabaseNfc
        .channel('realtime-nfc')
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'log_absensi', filter: `rfid_uid=eq.${user.rfid}` },
          (payload) => {
            const waktu = formatTime(payload.new?.waktu);
            const jenis = payload.new?.jenis_absen?.toLowerCase() || 'datang';
            const timeStr = waktu ? ` pukul ${waktu}` : '';
            
            const msgBody = user.role === 'Murid'
              ? `Ananda ${user.nama} telah ${jenis}${timeStr}`
              : `Anda telah tercatat ${jenis}${timeStr}`;
            
            const hrefUrl = user.role === 'Murid' ? '/dashboard/riwayat-murid' : '/dashboard/riwayat-guru';
              
            showToast('Tap NFC Berhasil 💳', msgBody, hrefUrl);
          }
        )
        .subscribe((s) => console.log('[NotificationProvider] NFC Status:', s));
    }

    if (user.role === 'Murid') {
      channel = supabase
        .channel('realtime-absensi')
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'data_absensi', filter: `nisn=eq.${user.id_user}` },
          (payload) => {
            if (payload.eventType === 'DELETE') return;
            const { status, created_at } = payload.new;
            const waktu = formatTime(created_at);
            const jenis = status?.toLowerCase() || 'datang';
            const timeStr = waktu ? ` pukul ${waktu}` : '';
            if (status) showToast('Absensi Tercatat ✅', `Ananda ${user.nama} telah ${jenis}${timeStr}`, '/dashboard/riwayat-murid');
          }
        )
        .subscribe((s) => console.log('[NotificationProvider] Murid Status:', s));

    } else if (['Guru Mapel', 'Wali Kelas', 'Kepala Madrasah', 'Admin'].includes(user.role)) {
      channel = supabase
        .channel('realtime-verifikasi')
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'verifikasi_guru', filter: `id_guru=eq.${user.id_user}` },
          (payload) => {
            if (payload.eventType === 'DELETE') return;
            const { status, metode, created_at } = payload.new;
            const waktu = formatTime(created_at);
            const jenis = status?.toLowerCase() || 'hadir';
            const timeStr = waktu ? ` pukul ${waktu}` : '';
            if (status) showToast('Verifikasi Kehadiran 📋', `Anda telah tercatat ${jenis}${timeStr} (${metode || 'Sistem'})`, '/dashboard/riwayat-guru');
          }
        )
        .subscribe((s) => console.log('[NotificationProvider] Verifikasi Status:', s));

      gpsChannel = supabase
        .channel('realtime-gps')
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'log_gps_guru', filter: `id_guru=eq.${user.id_user}` },
          (payload) => {
            if (payload.eventType === 'DELETE') return;
            const { status, waktu, created_at } = payload.new;
            const timeDisplay = waktu ? formatTime(waktu) : formatTime(created_at);
            const jenis = status?.toLowerCase() || 'datang';
            const timeStr = timeDisplay ? ` pukul ${timeDisplay}` : '';
            if (status) showToast('Absen GPS Berhasil 📍', `Anda telah tercatat ${jenis}${timeStr}`, '/dashboard/riwayat-guru');
          }
        )
        .subscribe((s) => console.log('[NotificationProvider] GPS Status:', s));
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
      if (gpsChannel) supabase.removeChannel(gpsChannel);
      if (nfcChannel && supabaseNfc) supabaseNfc.removeChannel(nfcChannel);
    };
  }, [user]);

  // Auto-tutup toast setelah 6 detik
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 6000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  if (!toast) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] animate-in slide-in-from-top-2 fade-in duration-300 max-w-[340px] w-[calc(100vw-2rem)]">
      <Link href={toast.href || '/dashboard/riwayat'} onClick={() => setToast(null)} className="block">
        <div className="bg-white dark:bg-slate-800 shadow-2xl border border-emerald-500/30 rounded-2xl p-4 flex gap-3 items-start cursor-pointer hover:border-emerald-500/60 transition-all duration-200 group">
          <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-500/20 rounded-full flex items-center justify-center shrink-0 group-hover:bg-emerald-200 dark:group-hover:bg-emerald-500/30 transition-colors">
            <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
            </svg>
          </div>
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
