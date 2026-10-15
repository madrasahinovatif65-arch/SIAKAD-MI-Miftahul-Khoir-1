'use client';

import { useState } from 'react';

// Daftar pintu masuk Taman Ilmu — pilot project (2 sumber resmi)
const PINTU_BELAJAR = [
  {
    id: 'letsread',
    label: 'Perpustakaan Cerita',
    sublabel: "Let's Read Asia",
    desc: 'Kumpulan ribuan dongeng, fabel, dan cerita bergambar seru dengan bahasa yang ramah anak dan penuh warna.',
    tags: ['🎨 Cerita Bergambar', '🌱 Cocok Fase A - C', '⚡ Langsung di Aplikasi'],
    url: 'https://www.letsreadasia.org',
    iframeOk: true,
    icon: (
      <svg className="w-9 h-9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
      </svg>
    ),
    badge: '📖 Buku Cerita & Fabel',
    badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    gradient: 'from-emerald-500 to-teal-500',
    ring: 'ring-emerald-500',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
    border: 'hover:border-emerald-400',
    guideTitle: 'Kapan Memilih Menu Ini?',
    guideContent: 'Pilih menu ini saat kamu ingin membaca santai, menikmati dongeng, fabel binatang, atau cerita petualangan seru untuk menambah imajinasi dan kosa kata.',
    guideFeatures: [
      'Bisa dibaca langsung di dalam layar SIAKAD tanpa login',
      'Cerita pendek berjenjang sesuai tingkat kelas (Fase A, B, & C)',
      'Ilustrasi visual menarik yang membuat membaca jadi tidak membosankan',
    ],
  },
  {
    id: 'buku_kemendik',
    label: 'Katalog Buku Pelajaran',
    sublabel: 'Kemendikdasmen RI (SIBI)',
    desc: 'Katalog buku teks Kurikulum Merdeka resmi dari Kementerian untuk semua mata pelajaran jenjang madrasah/sekolah dasar.',
    tags: ['📚 Buku Teks Utama', '📐 Kurikulum Merdeka', '🌐 Terbuka Tab Baru'],
    url: 'https://buku.kemendikdasmen.go.id/katalog',
    iframeOk: false, // SAMEORIGIN — hanya buka tab baru
    icon: (
      <svg className="w-9 h-9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 3.741-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" />
      </svg>
    ),
    badge: '📚 Buku Pelajaran Resmi',
    badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    gradient: 'from-blue-500 to-indigo-500',
    ring: 'ring-blue-500',
    iconBg: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    border: 'hover:border-blue-400',
    guideTitle: 'Kapan Memilih Menu Ini?',
    guideContent: 'Pilih menu ini jika kamu butuh materi mata pelajaran sekolah (Matematika, IPAS, Bahasa Indonesia, dll.) untuk mengerjakan tugas atau belajar persiapan ujian.',
    guideFeatures: [
      'Buku teks standar nasional yang digunakan bapak/ibu guru di kelas',
      'Tersedia buku siswa dan referensi lengkap per mata pelajaran',
      'Membuka situs resmi Kementerian di tab baru untuk membaca atau mengunduh PDF',
    ],
  },
];

export default function EPerpusPage() {
  const [activeEntry, setActiveEntry] = useState(null); // objek dari PINTU_BELAJAR

  // Jika sudah ada pilihan aktif dan iframeOk, tampilkan viewer
  if (activeEntry) {
    return (
      <div className="h-full flex flex-col animate-in fade-in duration-300" style={{ minHeight: '80vh' }}>
        {/* Topbar Viewer */}
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-white/10 px-4 py-3 flex items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveEntry(null)}
              className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Kembali
            </button>
            <div className="hidden sm:flex items-center gap-2">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${activeEntry.badgeColor}`}>{activeEntry.badge}</span>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{activeEntry.label}</span>
              <span className="text-xs text-slate-400 dark:text-slate-500">— {activeEntry.sublabel}</span>
            </div>
          </div>
          <a
            href={activeEntry.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-lg text-sm font-medium border border-emerald-200 dark:border-emerald-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
            <span className="hidden sm:inline">Buka Tab Baru</span>
          </a>
        </div>

        {/* Iframe / Fallback */}
        <div className="flex-1 relative bg-slate-100 dark:bg-slate-950" style={{ minHeight: '600px' }}>
          {activeEntry.iframeOk ? (
            <iframe
              src={activeEntry.url}
              className="absolute inset-0 w-full h-full border-0"
              title={activeEntry.label}
              allow="fullscreen"
            />
          ) : (
            /* Fallback untuk situs yang memblokir iframe (SAMEORIGIN) */
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 p-8 text-center">
              <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${activeEntry.gradient} flex items-center justify-center text-white shadow-lg`}>
                {activeEntry.icon}
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">{activeEntry.label}</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm">
                  Situs <strong className="text-slate-700 dark:text-slate-200">{activeEntry.sublabel}</strong> tidak dapat ditampilkan di dalam aplikasi karena kebijakan keamanan situs tersebut.
                </p>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 max-w-sm">
                  Klik tombol di bawah untuk membukanya di tab peramban baru.
                </p>
              </div>
              <a
                href={activeEntry.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r ${activeEntry.gradient} text-white font-semibold rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
                Buka {activeEntry.label}
              </a>
              <span className="text-xs text-slate-400 dark:text-slate-600">{activeEntry.url}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Tampilan utama: 2 tombol pilihan + Panduan Referensi Murid
  return (
    <div className="h-full flex flex-col space-y-6">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl p-6 sm:p-8 md:p-10 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-teal-900/20 rounded-full blur-2xl translate-y-1/3 -translate-x-1/4" />
        <div className="relative z-10 max-w-3xl">
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-3 drop-shadow-sm">
            🌱 Taman Ilmu
          </h2>
          <p className="text-emerald-50 text-sm sm:text-base leading-relaxed opacity-90">
            Selamat datang! Pilih pintu belajarmu hari ini — baca buku cerita seru atau cari buku pelajaran resmi madrasahmu.
          </p>
        </div>
      </div>

      {/* 2 Kartu Pintu Masuk */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {PINTU_BELAJAR.map((entry) => (
          <button
            key={entry.id}
            onClick={() => setActiveEntry(entry)}
            className={`group relative bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border-2 border-slate-100 dark:border-white/5 ${entry.border} hover:shadow-xl hover:-translate-y-1 transition-all duration-300 text-left flex flex-col gap-4 focus:outline-none focus:ring-2 ${entry.ring} focus:ring-offset-2`}
          >
            {/* Badge */}
            <span className={`self-start text-xs font-bold px-3 py-1 rounded-full ${entry.badgeColor}`}>
              {entry.badge}
            </span>

            {/* Icon + Teks */}
            <div className="flex items-start gap-4">
              <div className={`flex-shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center ${entry.iconBg} group-hover:scale-110 transition-transform duration-300 shadow-sm`}>
                {entry.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white leading-tight">{entry.label}</h3>
                <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-2">{entry.sublabel}</p>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{entry.desc}</p>
              </div>
            </div>

            {/* Tag Fitur */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {entry.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300"
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* CTA Footer */}
            <div className={`mt-auto pt-2 flex items-center gap-2 text-sm font-semibold bg-gradient-to-r ${entry.gradient} bg-clip-text text-transparent`}>
              {entry.iframeOk ? 'Buka di dalam aplikasi' : 'Buka di tab peramban baru'}
              <svg className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </div>

            {/* Glow overlay saat hover */}
            <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${entry.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300 pointer-events-none`} />
          </button>
        ))}
      </div>

      {/* Box Deskripsi & Referensi Panduan Murid */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 sm:p-7 border border-slate-200/80 dark:border-white/10 shadow-sm space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-lg">
            💡
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white">
              Panduan Referensi Menu Taman Ilmu
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Kenali isi dan tujuan setiap pilihan menu agar kamu menemukan bahan bacaan yang tepat:
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          {PINTU_BELAJAR.map((item) => (
            <div
              key={item.id}
              className="rounded-xl p-4 bg-slate-50/80 dark:bg-slate-900/50 border border-slate-200/60 dark:border-white/5 flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${item.badgeColor}`}>
                    {item.label}
                  </span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">({item.sublabel})</span>
                </div>
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                  🎯 {item.guideTitle}
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
                  {item.guideContent}
                </p>

                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Kelebihan & Isi Konten:</p>
                  <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                    {item.guideFeatures.map((feat, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-emerald-500 font-bold">✓</span>
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/60 dark:border-white/5 flex items-center justify-between text-[11px] text-slate-400">
                <span>Metode Akses:</span>
                <span className="font-medium text-slate-600 dark:text-slate-300">
                  {item.iframeOk ? '🖥️ Langsung di Aplikasi' : '🌐 Tab Peramban Eksternal'}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Tips membaca */}
        <div className="p-3.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/30 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2.5">
          <span className="text-base flex-shrink-0">✨</span>
          <p className="leading-relaxed">
            <strong>Tips untuk Murid:</strong> Mulailah dengan membaca 1 judul cerita di <strong>Perpustakaan Cerita</strong> setiap hari untuk melatih kemampuan literasimu, lalu buka <strong>Katalog Buku Pelajaran</strong> bila ada materi tugas sekolah yang ingin kamu pelajari lebih dalam!
          </p>
        </div>
      </div>

      {/* Catatan pilot project */}
      <p className="text-center text-xs text-slate-400 dark:text-slate-600 pb-2">
        🚧 Taman Ilmu masih dalam tahap <em>pilot project</em>. Konten akan terus bertambah.
      </p>
    </div>
  );
}
