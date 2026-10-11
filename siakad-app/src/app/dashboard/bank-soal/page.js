'use client';

export default function BankSoalPage() {
  return (
    <div className="w-full h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-white/10 p-6">
        <h1 className="text-3xl font-bold text-slate-800 dark:text-white">Bank Soal</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">Kumpulan soal pembelajaran terlengkap</p>
      </div>

      {/* Iframe Container */}
      <div className="flex-1 overflow-hidden">
        <iframe
          src="https://banksoalminova.blogspot.com/"
          className="w-full h-full border-none"
          title="Bank Soal Minova"
          allow="fullscreen"
        />
      </div>
    </div>
  );
}
