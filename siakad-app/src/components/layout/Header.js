'use client';

export default function Header() {
  return (
    <header className="sticky top-0 z-30 md:hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-white/10 px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between">
        {/* Kiri: Spacer untuk menyeimbangkan posisi tengah */}
        <div className="w-10 h-10" />
        
        {/* Tengah: Logo dan Nama */}
        <div className="flex items-center gap-2 justify-center">
          <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain drop-shadow-[0_0_5px_rgba(52,211,148,0.5)]" />
          <h1 className="text-base font-bold text-slate-800 dark:text-white tracking-tight">INOVATIF+</h1>
        </div>
        
        {/* Kanan: Badge MI */}
        <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-2xl flex items-center justify-center text-white font-black text-sm shadow-[0_4px_10px_rgba(16,185,129,0.3)]">
          MI
        </div>
      </div>
    </header>
  );
}
