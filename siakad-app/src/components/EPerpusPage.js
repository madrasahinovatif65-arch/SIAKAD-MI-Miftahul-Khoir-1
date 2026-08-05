'use client';

export default function EPerpusPage() {
  // TODO: Update URL ini dengan alamat E-Perpus madrasah yang asli
  const EPERPUS_URL = 'https://perpus.kemenag.go.id/';

  return (
    <div className="h-full flex flex-col space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">E-Perpus</h2>
        <p className="text-slate-600 dark:text-white/40 text-sm mt-1">Perpustakaan Digital Madrasah</p>
      </div>

      <div className="flex-1 bg-white/50 dark:bg-white/5 border border-slate-300 dark:border-white/5 rounded-2xl overflow-hidden shadow-xl flex flex-col">
        <div className="p-4 bg-white/50 dark:bg-white/5 border-b border-slate-300 dark:border-white/5 flex justify-between items-center">
          <p className="text-slate-700 dark:text-white/70 text-sm">Menampilkan E-Perpus dari: <span className="font-mono text-emerald-600 dark:text-emerald-400">{EPERPUS_URL}</span></p>
          <a
            href={EPERPUS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600/40 rounded-lg text-sm font-medium transition-colors"
          >
            Buka di Tab Baru
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
          </a>
        </div>
        <div className="flex-1 w-full bg-white relative">
          <iframe 
            src={EPERPUS_URL} 
            className="absolute inset-0 w-full h-full border-0"
            title="E-Perpus Madrasah"
            allow="fullscreen"
          />
        </div>
      </div>
    </div>
  );
}
