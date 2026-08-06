'use client';

export default function NotifikasiPage() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="w-32 h-32 mb-8 relative">
        <div className="absolute inset-0 bg-emerald-100 dark:bg-emerald-500/20 rounded-full animate-ping opacity-75" />
        <div className="relative w-full h-full bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30">
          <svg className="w-14 h-14 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
          </svg>
        </div>
      </div>
      
      <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-3 text-center">
        Belum Ada Notifikasi
      </h2>
      <p className="text-slate-500 dark:text-slate-400 text-center max-w-md">
        Saat ini belum ada pengumuman atau notifikasi baru untuk Anda. Kami akan memberi tahu segera jika ada pembaruan informasi akademik.
      </p>

      <button className="mt-8 px-8 py-3 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold rounded-xl border border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors">
        Muat Ulang
      </button>
    </div>
  );
}
