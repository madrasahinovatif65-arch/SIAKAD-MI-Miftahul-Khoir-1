'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function PengumumanPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targets, setTargets] = useState(['Semua Pengguna']);
  
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', msg: '' });

  // Hanya admin atau kepsek yang boleh
  if (user && !['Admin', 'Kepala Madrasah', 'Staf TU'].includes(user.role)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="w-20 h-20 bg-rose-100 dark:bg-rose-500/20 text-rose-500 rounded-full flex items-center justify-center text-4xl mb-4 shadow-lg shadow-rose-500/20">
          🔒
        </div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-white">Akses Ditolak</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-2">Anda tidak memiliki hak akses untuk mengirim pengumuman broadcast.</p>
      </div>
    );
  }

  const targetOptions = [
    { id: 'Semua Pengguna', label: 'Semua Pengguna (Broadcast Massal)', icon: '🌍' },
    { id: 'Semua Guru', label: 'Semua Guru & Staf', icon: '👨‍🏫' },
    { id: 'Semua Murid', label: 'Semua Murid', icon: '🎓' },
    { id: 'Wali Kelas', label: 'Wali Kelas Saja', icon: '📋' },
    { id: 'Guru Mapel', label: 'Guru Mapel Saja', icon: '📚' },
  ];

  const handleToggleTarget = (id) => {
    if (id === 'Semua Pengguna') {
      setTargets(['Semua Pengguna']);
      return;
    }
    
    let newTargets = targets.filter(t => t !== 'Semua Pengguna');
    if (newTargets.includes(id)) {
      newTargets = newTargets.filter(t => t !== id);
    } else {
      newTargets.push(id);
    }
    
    if (newTargets.length === 0) {
      newTargets = ['Semua Pengguna'];
    }
    setTargets(newTargets);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      setStatus({ type: 'error', msg: 'Judul dan isi pengumuman tidak boleh kosong.' });
      return;
    }

    setIsLoading(true);
    setStatus({ type: '', msg: '' });

    try {
      const res = await fetch('/api/push/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, message, targets }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Gagal mengirim pengumuman');

      setStatus({ 
        type: 'success', 
        msg: `Pengumuman berhasil disiarkan! Terkirim ke ${data.sent || 0} perangkat.`
      });
      setTitle('');
      setMessage('');
      setTargets(['Semua Pengguna']);
      
    } catch (err) {
      setStatus({ type: 'error', msg: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-white tracking-tight flex items-center gap-3">
          <span className="p-2.5 bg-sky-100 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 rounded-2xl">📢</span>
          Siaran Pengumuman
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm sm:text-base">
          Kirim notifikasi langsung ke layar HP seluruh warga sekolah.
        </p>
      </div>

      <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-slate-200/50 dark:border-white/5 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/20 dark:shadow-none">
        
        {status.msg && (
          <div className={`p-4 rounded-2xl mb-6 text-sm font-semibold flex items-center gap-3 ${
            status.type === 'error' 
              ? 'bg-rose-50 text-rose-600 border border-rose-100 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-400' 
              : 'bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400'
          }`}>
            <span>{status.type === 'error' ? '⚠️' : '✅'}</span>
            {status.msg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Target Audience */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-200 block">
              Pilih Target Penerima
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {targetOptions.map((opt) => {
                const isActive = targets.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleToggleTarget(opt.id)}
                    className={`flex items-center gap-3 p-4 rounded-2xl border text-left transition-all duration-300 ${
                      isActive 
                        ? 'bg-sky-50 dark:bg-sky-500/20 border-sky-200 dark:border-sky-500/30 shadow-sm shadow-sky-500/10' 
                        : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-colors ${
                      isActive ? 'bg-white dark:bg-sky-500/20 shadow-sm' : 'bg-white/50 dark:bg-white/5'
                    }`}>
                      {opt.icon}
                    </div>
                    <div>
                      <div className={`font-semibold text-sm ${isActive ? 'text-sky-700 dark:text-sky-400' : 'text-slate-700 dark:text-slate-300'}`}>
                        {opt.label}
                      </div>
                    </div>
                    {isActive && (
                      <div className="ml-auto w-5 h-5 rounded-full bg-sky-500 flex items-center justify-center text-white">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <label htmlFor="title" className="text-sm font-bold text-slate-700 dark:text-slate-200 block">
              Judul Pengumuman
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Info Libur Idul Fitri"
              className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 rounded-2xl px-5 py-4 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-all font-medium placeholder:font-normal placeholder:text-slate-400"
              required
            />
          </div>

          {/* Message */}
          <div className="space-y-2">
            <label htmlFor="message" className="text-sm font-bold text-slate-700 dark:text-slate-200 block">
              Isi Pesan
            </label>
            <textarea
              id="message"
              rows="5"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ketik isi pengumuman secara lengkap di sini..."
              className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 rounded-2xl px-5 py-4 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-all resize-none placeholder:text-slate-400"
              required
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || !title.trim() || !message.trim()}
            className="w-full relative overflow-hidden group bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl py-4 font-bold text-sm sm:text-base hover:bg-slate-800 dark:hover:bg-slate-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-slate-900/20 dark:shadow-white/10"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Menyiarkan...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
                Siarkan Sekarang
              </span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
