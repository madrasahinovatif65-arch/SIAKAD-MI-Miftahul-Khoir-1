'use client';

import { useState } from 'react';

export default function EPerpusPage() {
  const [activeCategory, setActiveCategory] = useState(null);
  const [activeUrl, setActiveUrl] = useState(null);

  const TAMAN_ILMU_DATA = {
    fase: {
      title: 'Fase Belajarmu',
      options: [
        { label: 'Fase A (Kelas 1-2)', url: 'https://perpus.kemenag.go.id/' },
        { label: 'Fase B (Kelas 3-4)', url: 'https://perpus.kemenag.go.id/' },
        { label: 'Fase C (Kelas 5-6)', url: 'https://perpus.kemenag.go.id/' },
      ]
    },
    kegiatan: {
      title: 'Kegiatan Hari Ini',
      options: [
        { label: 'Buku Cerita Bergambar', url: 'https://perpus.kemenag.go.id/' },
        { label: 'Kuis Interaktif', url: 'https://perpus.kemenag.go.id/' },
        { label: 'Video Belajar', url: 'https://perpus.kemenag.go.id/' },
      ]
    },
    materi: {
      title: 'Materi Pelajaran',
      options: [
        { label: 'PAI & Budi Pekerti', url: 'https://perpus.kemenag.go.id/' },
        { label: 'Matematika & IPA', url: 'https://perpus.kemenag.go.id/' },
        { label: 'Tematik Umum', url: 'https://perpus.kemenag.go.id/' },
      ]
    }
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl p-6 sm:p-8 md:p-10 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-teal-900/20 rounded-full blur-2xl translate-y-1/3 -translate-x-1/4"></div>
        
        <div className="relative z-10 max-w-3xl">
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-4 drop-shadow-sm">
            Taman Ilmu
          </h2>
          <p className="text-emerald-50 text-sm sm:text-base leading-relaxed opacity-95">
            Selamat datang di Taman Ilmu! Pintu gerbang petualangan belajarmu yang seru. Di sini, kamu bebas memilih cara belajar paling asyik: masuk lewat tingkatan kelasmu, langsung baca buku cerita bergambar yang seru, menantang diri lewat kuis interaktif, atau menjelajahi materi pelajaran umum dan agama madrasah!
          </p>
        </div>
      </div>

      {/* Cards Section */}
      {!activeUrl && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Card 1 */}
          <div 
            onClick={() => setActiveCategory(activeCategory === 'fase' ? null : 'fase')}
            className={`cursor-pointer group relative bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border-2 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 flex flex-col items-center justify-center text-center gap-4 ${activeCategory === 'fase' ? 'border-emerald-500 shadow-md scale-[1.02]' : 'border-slate-100 dark:border-white/5'}`}
          >
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
              </svg>
            </div>
            <h3 className="font-bold text-slate-800 dark:text-white tracking-wide">PILIH FASE BELAJARMU!</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Sesuaikan materi dengan kelasmu saat ini.</p>
          </div>

          {/* Card 2 */}
          <div 
            onClick={() => setActiveCategory(activeCategory === 'kegiatan' ? null : 'kegiatan')}
            className={`cursor-pointer group relative bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border-2 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 flex flex-col items-center justify-center text-center gap-4 ${activeCategory === 'kegiatan' ? 'border-amber-500 shadow-md scale-[1.02]' : 'border-slate-100 dark:border-white/5'}`}
          >
            <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 9.75L16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
              </svg>
            </div>
            <h3 className="font-bold text-slate-800 dark:text-white tracking-wide">MAU NGAPAIN HARI INI?</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Buku, Kuis, atau Video pembelajaran menarik.</p>
          </div>

          {/* Card 3 */}
          <div 
            onClick={() => setActiveCategory(activeCategory === 'materi' ? null : 'materi')}
            className={`cursor-pointer group relative bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border-2 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 flex flex-col items-center justify-center text-center gap-4 ${activeCategory === 'materi' ? 'border-blue-500 shadow-md scale-[1.02]' : 'border-slate-100 dark:border-white/5'}`}
          >
            <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>
            <h3 className="font-bold text-slate-800 dark:text-white tracking-wide">CARI MATERI APA?</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Pilih subjek pelajaran yang ingin didalami.</p>
          </div>
        </div>
      )}

      {/* Options Panel */}
      {activeCategory && !activeUrl && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-200 dark:border-white/5 animate-in fade-in zoom-in-95 duration-300">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-slate-800 dark:text-white">{TAMAN_ILMU_DATA[activeCategory].title}</h3>
            <button 
              onClick={() => setActiveCategory(null)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-500 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {TAMAN_ILMU_DATA[activeCategory].options.map((opt, i) => (
              <button
                key={i}
                onClick={() => setActiveUrl(opt.url)}
                className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 dark:border-white/10 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-left transition-all group"
              >
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:bg-white dark:group-hover:bg-slate-800 shadow-sm">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                </div>
                <span className="font-semibold text-slate-700 dark:text-slate-200 group-hover:text-emerald-700 dark:group-hover:text-emerald-300">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Iframe View */}
      {activeUrl && (
        <div className="flex-1 flex flex-col bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden border border-slate-200 dark:border-white/5 animate-in slide-in-from-bottom-8 fade-in duration-500">
          <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-white/10 p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setActiveUrl(null)}
                className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 shadow-sm transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Kembali
              </button>
              <div className="hidden sm:block">
                <p className="text-xs text-slate-500 dark:text-slate-400">Menampilkan:</p>
                <p className="text-sm font-semibold text-slate-800 dark:text-white truncate max-w-xs">{activeUrl}</p>
              </div>
            </div>
            <a
              href={activeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600/20 rounded-lg text-sm font-medium transition-colors"
            >
              <span className="hidden sm:inline">Buka di Tab Baru</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </a>
          </div>
          <div className="flex-1 w-full bg-slate-100 dark:bg-slate-950 relative min-h-[500px]">
            <iframe 
              src={activeUrl} 
              className="absolute inset-0 w-full h-full border-0"
              title="Taman Ilmu Viewer"
              allow="fullscreen"
            />
          </div>
        </div>
      )}
    </div>
  );
}
