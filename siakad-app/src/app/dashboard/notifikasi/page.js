'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import useSWR from 'swr';
import Link from 'next/link';

// --- Helpers ---
const formatTimeAgo = (dateStr) => {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return 'Baru saja';
  if (diffMins < 60) return `${diffMins} menit yang lalu`;
  if (diffHours < 24) return `${diffHours} jam yang lalu`;
  if (diffDays === 1) return 'Kemarin';
  return `${diffDays} hari yang lalu`;
};

const typeConfig = {
  ABSENSI:   { icon: '✅', color: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' },
  JURNAL:    { icon: '📋', color: 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400' },
  PENGINGAT: { icon: '⏰', color: 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400' },
  REKAP:     { icon: '📊', color: 'bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400' },
  PENGUMUMAN:{ icon: '📢', color: 'bg-sky-100 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400' },
  PERINGATAN:{ icon: '⚠️', color: 'bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400' },
  SISTEM:    { icon: '⚙️', color: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300' },
};
const getTypeCfg = (type) => typeConfig[type] || { icon: 'ℹ️', color: 'bg-teal-100 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400' };

// --- Fetcher ---
const fetchNotifikasi = async (userId, role) => {
  const { data, error } = await supabase
    .from('notifikasi')
    .select('*')
    .or(`id_user.eq.${userId},role_target.eq.${role}`)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

// --- Card Component ---
function NotifCard({ notif, onMarkRead, onDelete }) {
  const cfg = getTypeCfg(notif.type);
  return (
    <div className={`relative flex items-start gap-4 p-4 rounded-2xl border transition-all duration-300 ${
      !notif.is_read
        ? 'bg-emerald-50/80 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700/40 shadow-sm'
        : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-white/5'
    }`}>
      {!notif.is_read && (
        <span className="absolute top-4 right-4 w-2 h-2 bg-rose-500 rounded-full flex-shrink-0" />
      )}
      <div className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-xl ${cfg.color}`}>
        {cfg.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <p className={`text-sm font-bold leading-snug ${notif.is_read ? 'text-slate-600 dark:text-slate-300' : 'text-slate-800 dark:text-white'}`}>
            {notif.title}
          </p>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 whitespace-nowrap flex-shrink-0">
            {formatTimeAgo(notif.created_at)}
          </span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{notif.message}</p>
        <div className="flex items-center gap-3 mt-2.5 flex-wrap">
          {notif.link && (
            <Link href={notif.link} className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline">
              Lihat Detail →
            </Link>
          )}
          {!notif.is_read && (
            <button onClick={() => onMarkRead(notif.id)} className="text-xs text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
              Tandai dibaca
            </button>
          )}
          <button onClick={() => onDelete(notif.id)} className="text-xs text-slate-400 dark:text-slate-500 hover:text-rose-500 transition-colors ml-auto">
            Hapus
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Main Page ---
export default function NotifikasiPage() {
  const { user } = useAuth();
  const [filter, setFilter] = useState('semua');

  const { data: notifs = [], isLoading, mutate } = useSWR(
    user ? `notifikasi_${user.id_user}_${user.role}` : null,
    () => fetchNotifikasi(user.id_user, user.role)
  );

  const unreadCount = notifs.filter(n => !n.is_read).length;

  const filtered = filter === 'semua' ? notifs
    : filter === 'belum' ? notifs.filter(n => !n.is_read)
    : notifs.filter(n => n.is_read);

  const handleMarkRead = async (id) => {
    await supabase.from('notifikasi').update({ is_read: true }).eq('id', id);
    mutate();
  };

  const handleMarkAllRead = async () => {
    const ids = notifs.filter(n => !n.is_read).map(n => n.id);
    if (ids.length === 0) return;
    await supabase.from('notifikasi').update({ is_read: true }).in('id', ids);
    mutate();
  };

  const handleDelete = async (id) => {
    await supabase.from('notifikasi').delete().eq('id', id);
    mutate();
  };

  const handleDeleteRead = async () => {
    const ids = notifs.filter(n => n.is_read).map(n => n.id);
    if (ids.length === 0) return;
    await supabase.from('notifikasi').delete().in('id', ids);
    mutate();
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
            🔔 Notifikasi
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 bg-rose-500 text-white text-xs font-bold rounded-full">
                {unreadCount}
              </span>
            )}
          </h1>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
            {unreadCount > 0 ? `${unreadCount} notifikasi belum dibaca` : 'Semua sudah dibaca'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button onClick={handleMarkAllRead} className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors">
              Tandai semua dibaca
            </button>
          )}
          {notifs.some(n => n.is_read) && (
            <button onClick={handleDeleteRead} className="text-xs font-semibold text-slate-400 dark:text-slate-500 hover:text-rose-500 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-white/5 transition-colors">
              Hapus yang dibaca
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'semua', label: 'Semua', count: notifs.length },
          { key: 'belum', label: 'Belum Dibaca', count: unreadCount },
          { key: 'sudah', label: 'Sudah Dibaca', count: notifs.length - unreadCount },
        ].map(tab => (
          <button key={tab.key} onClick={() => setFilter(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              filter === tab.key
                ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}>
            {tab.label}
            {tab.count > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${filter === tab.key ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 mb-5 relative">
            <div className="absolute inset-0 bg-emerald-100 dark:bg-emerald-500/20 rounded-full animate-ping opacity-40" />
            <div className="relative w-full h-full bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <svg className="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
            </div>
          </div>
          <h2 className="text-lg font-bold text-slate-700 dark:text-white">
            {filter === 'belum' ? 'Semua sudah dibaca!' : 'Belum ada notifikasi'}
          </h2>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-1 max-w-xs">
            {filter === 'belum' ? 'Tidak ada notifikasi baru saat ini.' : 'Belum ada pemberitahuan yang masuk untuk akun Anda.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(notif => (
            <NotifCard key={notif.id} notif={notif} onMarkRead={handleMarkRead} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

