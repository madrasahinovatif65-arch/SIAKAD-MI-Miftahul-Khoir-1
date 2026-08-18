'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

export default function NotificationProvider() {
  const { user } = useAuth();
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!user) return;

    // Request notification permission
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }

    const showNotification = (title, body) => {
      // Show system notification if granted
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/icon-192x192.png' });
      }
      
      // Show in-app toast
      setToast({ title, body });
      setTimeout(() => setToast(null), 5000);
    };

    let channel;

    if (user.role === 'Murid') {
      channel = supabase
        .channel('realtime-absensi')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'data_absensi', filter: `id_murid=eq.${user.id_user}` },
          (payload) => {
            if (payload.eventType === 'DELETE') return;
            const { status } = payload.new;
            if (status) showNotification('Absensi Murid Berhasil', `Kehadiran Anda telah dicatat: ${status}.`);
          }
        )
        .subscribe();
    } else if (['Guru Mapel', 'Wali Kelas', 'Kepala Madrasah', 'Admin'].includes(user.role)) {
      channel = supabase
        .channel('realtime-verifikasi')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'verifikasi_guru', filter: `id_guru=eq.${user.id_user}` },
          (payload) => {
            if (payload.eventType === 'DELETE') return;
            const { status, metode } = payload.new;
            if (status) showNotification('Verifikasi Kehadiran', `Kehadiran Anda telah diverifikasi (${metode || 'Sistem'}): ${status}.`);
          }
        )
        .subscribe();

      const gpsChannel = supabase
        .channel('realtime-gps')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'log_gps_guru', filter: `id_guru=eq.${user.id_user}` },
          (payload) => {
            if (payload.eventType === 'DELETE') return;
            const { status } = payload.new;
            if (status) showNotification('Absen GPS Berhasil', `Lokasi Anda telah tersimpan dengan status: ${status}.`);
          }
        )
        .subscribe();

      // Return cleanup for multiple channels
      return () => {
        supabase.removeChannel(channel);
        supabase.removeChannel(gpsChannel);
      };
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [user]);

  if (!toast) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] animate-in slide-in-from-top-2 fade-in duration-300">
      <div className="bg-white dark:bg-slate-800 shadow-xl border border-emerald-500/30 rounded-2xl p-4 min-w-[300px] flex gap-4 items-start">
        <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-500/20 rounded-full flex items-center justify-center shrink-0">
          <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
          </svg>
        </div>
        <div className="flex-1">
          <h4 className="font-bold text-slate-800 dark:text-white text-sm">{toast.title}</h4>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">{toast.body}</p>
        </div>
        <button onClick={() => setToast(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
