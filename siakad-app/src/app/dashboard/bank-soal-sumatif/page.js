'use client';

export default function BankSoalSumatifPage() {
  const bankSoalUrl = 'https://banksoalminova.blogspot.com/';

  return (
    <div className="space-y-4 h-[calc(100vh-220px)] min-h-[540px]">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/80">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">
            Bank Soal Sumatif
          </p>
          <h1 className="mt-1 text-xl font-bold text-slate-800 dark:text-white">
            Bank Soal Minova
          </h1>
        </div>

        <a
          href={bankSoalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500"
        >
          Buka di Tab Baru
        </a>
      </div>

      <div className="h-[calc(100%-72px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
        <iframe
          src={bankSoalUrl}
          title="Bank Soal Minova"
          className="h-full w-full border-0"
          allow="fullscreen"
          loading="lazy"
        />
      </div>
    </div>
  );
}
