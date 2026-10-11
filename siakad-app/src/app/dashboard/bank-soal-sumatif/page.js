'use client';

export default function BankSoalSumatifPage() {
  const bankSoalUrl = 'https://banksoalminova.blogspot.com/';

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
              </svg>
              Eksternal
            </span>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Koleksi Soal & Evaluasi
            </p>
          </div>
          <h1 className="mt-1.5 text-2xl font-bold text-slate-800 dark:text-white">
            Bank Soal Sumatif
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Portal Bank Soal Minova untuk asesmen dan evaluasi pembelajaran sumatif
          </p>
        </div>

        <a
          href={bankSoalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 active:scale-95 shrink-0"
        >
          <span>Buka di Tab Baru</span>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
        </a>
      </div>

      {/* Frame Container */}
      <div className="h-[calc(100vh-230px)] min-h-[620px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
        <iframe
          src={bankSoalUrl}
          title="Bank Soal Sumatif Minova"
          className="h-full w-full border-0"
          allow="fullscreen; clipboard-read; clipboard-write"
          loading="lazy"
        />
      </div>
    </div>
  );
}
