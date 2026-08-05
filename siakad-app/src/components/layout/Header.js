'use client';

export default function Header({ onMenuClick }) {
  return (
    <header className="sticky top-0 z-30 lg:hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-300 dark:border-white/5 px-4 py-3">
      <div className="flex items-center justify-between">
        <button 
          onClick={onMenuClick} 
          className="p-2 rounded-lg hover:bg-emerald-50 dark:hover:bg-white/5 shadow-sm dark:shadow-none transition-colors"
        >
          <svg className="w-6 h-6 text-slate-700 dark:text-white/70" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain drop-shadow-[0_0_5px_rgba(52,211,148,0.5)]" />
          <h1 className="text-sm font-semibold text-slate-800 dark:text-white/80">Inovatif+</h1>
        </div>
        <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl flex items-center justify-center text-slate-900 dark:text-white font-bold text-sm shadow-md">
          MI
        </div>
      </div>
    </header>
  );
}
