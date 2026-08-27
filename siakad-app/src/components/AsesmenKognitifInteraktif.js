'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import useSWR from 'swr';

// ─────────────────────────────────────────────────────────────
// Utilitas: Web Speech API (TTS ramah anak, suara wanita id-ID)
// ─────────────────────────────────────────────────────────────
function speakText(teks, onEnd) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();

  const utt = new SpeechSynthesisUtterance(teks);
  utt.lang  = 'id-ID';
  utt.rate  = 0.85;   // Agak lambat agar mudah dipahami anak
  utt.pitch = 1.15;   // Sedikit lebih tinggi → terkesan ramah

  // Pilih suara wanita Indonesia jika tersedia
  const voices = window.speechSynthesis.getVoices();
  const voiceWanita = voices.find(v =>
    v.lang === 'id-ID' && /female|wanita|woman/i.test(v.name)
  ) || voices.find(v => v.lang === 'id-ID')
    || voices.find(v => v.lang.startsWith('id'));

  if (voiceWanita) utt.voice = voiceWanita;
  if (onEnd) utt.onend = onEnd;

  window.speechSynthesis.speak(utt);
}

// ─────────────────────────────────────────────────────────────
// Konstanta
// ─────────────────────────────────────────────────────────────
const KATEGORI_COLOR = {
  'Sangat Cakap':    'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  'Cakap':           'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
  'Berkembang':      'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  'Perlu Bimbingan': 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
};

const DIMENSI_CONFIG = {
  literasi:  { label: 'Literasi',  icon: '📖', color: 'from-blue-500 to-cyan-400' },
  numerasi:  { label: 'Numerasi',  icon: '🔢', color: 'from-violet-500 to-purple-400' },
  reasoning: { label: 'Penalaran', icon: '🧩', color: 'from-emerald-500 to-teal-400' },
};

// ─────────────────────────────────────────────────────────────
// Modal Disclaimer Orang Tua
// ─────────────────────────────────────────────────────────────
function DisclaimerModal({ onMulai }) {
  return (
    <div className="flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl max-w-md w-full p-7 animate-in fade-in zoom-in duration-300 border border-slate-200 dark:border-white/10">
        <div className="text-center mb-5">
          <div className="w-16 h-16 bg-amber-100 dark:bg-amber-500/20 rounded-2xl flex items-center justify-center mx-auto mb-3 text-3xl">
            🛡️
          </div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">Perhatian untuk Orang Tua</h2>
        </div>

        <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300 mb-6">
          <div className="flex gap-3 items-start p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
            <span className="text-lg shrink-0">👧</span>
            <p>Mohon biarkan anak menjawab sendiri tanpa bantuan. Tujuan tes ini hanya untuk mengenali cara belajar anak, bukan untuk dinilai.</p>
          </div>
          <div className="flex gap-3 items-start p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
            <span className="text-lg shrink-0">📋</span>
            <p><strong>Hasil tes ini TIDAK berpengaruh pada nilai rapor.</strong> Hasilnya hanya digunakan guru untuk merencanakan pembelajaran yang sesuai dengan kemampuan anak.</p>
          </div>
          <div className="flex gap-3 items-start p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20">
            <span className="text-lg shrink-0">🔊</span>
            <p>Tekan ikon <strong>🔊</strong> untuk mendengarkan pertanyaan kapan saja. Anak tidak wajib mendengarkan audio, bisa langsung membaca teks pertanyaan.</p>
          </div>
        </div>

        <button
          id="btn-mulai-tes"
          onClick={onMulai}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-base shadow-lg hover:shadow-emerald-300 dark:hover:shadow-emerald-900 hover:scale-[1.02] transition-all"
        >
          ✅ Saya Mengerti — Mulai Tes
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Kartu Soal: Pilihan Emoji (Fase A)
// ─────────────────────────────────────────────────────────────
function KartuEmoji({ opsi, jawabanDipilih, onPilih }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6">
      {opsi.map((o) => {
        const dipilih = jawabanDipilih === o.label;
        return (
          <button
            key={o.label}
            id={`pilihan-${o.label}`}
            onClick={() => onPilih(o.label)}
            className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all duration-200 select-none
              ${dipilih
                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/20 scale-105 shadow-lg shadow-emerald-200 dark:shadow-emerald-900'
                : 'border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 hover:border-emerald-300 hover:scale-[1.03] active:scale-95'
              }`}
          >
            <span className="text-5xl sm:text-6xl leading-none">{o.emoji}</span>
            <span className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 text-center leading-tight">
              {o.label}
            </span>
            {dipilih && (
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">✓ Dipilih</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Kartu Soal: Dropdown (Fase B–C)
// ─────────────────────────────────────────────────────────────
function KartuDropdown({ opsi, jawabanDipilih, onPilih }) {
  return (
    <div className="mt-6">
      <select
        id="pilihan-dropdown"
        value={jawabanDipilih || ''}
        onChange={e => onPilih(e.target.value)}
        className="w-full px-4 py-3.5 rounded-xl border-2 border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-base focus:outline-none focus:border-emerald-500 transition-colors"
      >
        <option value="">-- Pilih jawaban --</option>
        {opsi.map(o => <option key={o.label} value={o.label}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Kartu Soal: Fill / Isian (Fase B–C)
// ─────────────────────────────────────────────────────────────
function KartuFill({ jawabanDipilih, onPilih }) {
  return (
    <div className="mt-6">
      <input
        id="pilihan-fill"
        type="text"
        placeholder="Tulis jawaban kamu di sini..."
        value={jawabanDipilih || ''}
        onChange={e => onPilih(e.target.value)}
        className="w-full px-4 py-3.5 rounded-xl border-2 border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-base focus:outline-none focus:border-emerald-500 transition-colors"
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Layar Hasil Akhir
// ─────────────────────────────────────────────────────────────
function LayarHasil({ hasil, namaMurid }) {
  const dims = [
    { key: 'literasi',  ...DIMENSI_CONFIG.literasi },
    { key: 'numerasi',  ...DIMENSI_CONFIG.numerasi },
    { key: 'reasoning', ...DIMENSI_CONFIG.reasoning },
  ];

  return (
    <div className="max-w-lg mx-auto text-center">
      <div className="text-6xl mb-4">🎉</div>
      <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-1">Tes Selesai!</h2>
      <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
        Terima kasih, <strong>{namaMurid}</strong>. Guru kamu sudah menerima hasilnya.
      </p>

      <div className="grid grid-cols-1 gap-3 mb-6">
        {dims.map(d => {
          const skor     = hasil[`skor_${d.key}`];
          const kategori = hasil[`kategori_${d.key}`];
          return (
            <div key={d.key} className="flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-left">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${d.color} flex items-center justify-center text-2xl shrink-0`}>
                {d.icon}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{d.label}</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${d.color} transition-all duration-700`}
                      style={{ width: `${skor || 0}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-500">{skor ?? '–'}%</span>
                </div>
              </div>
              <span className={`px-2 py-1 rounded-lg text-xs font-medium ${KATEGORI_COLOR[kategori] || ''}`}>
                {kategori || '–'}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-slate-400 dark:text-slate-500">
        Hasil ini tidak mempengaruhi nilai rapor. Guru akan menggunakannya untuk membantu proses belajar kamu. 💪
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Komponen Utama
// ─────────────────────────────────────────────────────────────
export default function AsesmenKognitifInteraktif({ user, tahunAjaran, semester }) {
  const [tahap, setTahap] = useState('disclaimer'); // disclaimer | loading | tes | submitting | hasil | error
  const [soalList, setSoalList] = useState([]);
  const [indeks, setIndeks] = useState(0);
  const [jawaban, setJawaban] = useState({});   // { [id_soal]: label_dipilih }
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [hasilAkhir, setHasilAkhir] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);

  // Tentukan fase berdasarkan angka kelas di rombel (misal: "Kelas 2B" -> "2")
  const getFase = (rombelStr) => {
    if (!rombelStr) return 'C';
    const match = String(rombelStr).match(/\d+/);
    if (!match) return 'C'; // Fallback
    const num = parseInt(match[0], 10);
    if (num <= 2) return 'A';
    if (num <= 4) return 'B';
    return 'C';
  };
  const fase = getFase(user?.rombel || user?.kelas);

  // Muat soal dari API
  const mulaiTes = async () => {
    setLoading(true);
    try {
      const ta = tahunAjaran || '-';
      const sem = semester || '-';
      const res = await fetch(
        `/api/asesmen/kognitif-interaktif?fase=${fase}&tahun_ajaran=${encodeURIComponent(ta)}&semester=${encodeURIComponent(sem)}&id_murid=${user.id_user}`
      );
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Gagal memuat soal dari server.');
        setTahap('error');
        return;
      }

      if (data.sudah_dikerjakan) {
        setHasilAkhir(data.hasil);
        setTahap('hasil');
        return;
      }

      const soal = data.soal || [];
      if (soal.length === 0) {
        setErrorMsg('Belum ada soal tes yang tersedia untuk kelasmu saat ini. Silakan hubungi guru.');
        setTahap('error');
        return;
      }

      setSoalList(soal);
      setTahap('tes');
    } catch (err) {
      console.error(err);
      setErrorMsg('Terjadi kesalahan koneksi. Pastikan internet kamu stabil, lalu coba lagi.');
      setTahap('error');
    } finally {
      setLoading(false);
    }
  };

  const soalSekarang = soalList[indeks];

  // Audio TIDAK autoplay — hanya diputar saat murid menekan tombol 🔊

  const handlePilih = (label) => {
    setJawaban(prev => ({ ...prev, [soalSekarang.id]: label }));
  };

  const handleLanjut = () => {
    window.speechSynthesis?.cancel();
    if (indeks < soalList.length - 1) {
      setIndeks(i => i + 1);
    } else {
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setTahap('submitting');
    try {
      const res = await fetch('/api/asesmen/kognitif-interaktif', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_murid:    user.id_user,
          nama_murid:  user.nama,
          rombel:      user.rombel,
          tahun_ajaran: tahunAjaran,
          semester,
          fase,
          jawaban,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setHasilAkhir(data.hasil);
      setTahap('hasil');
    } catch (err) {
      console.error(err);
      setTahap('tes');
    } finally {
      setSubmitting(false);
    }
  };

  const dimSekarang = soalSekarang ? DIMENSI_CONFIG[soalSekarang.dimensi] : null;
  const progress    = soalList.length > 0 ? ((indeks) / soalList.length) * 100 : 0;
  const sudahPilih  = soalSekarang ? !!jawaban[soalSekarang.id] : false;

  // ── Error
  if (tahap === 'error') {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-5 text-center px-4">
        <div className="text-6xl">⚠️</div>
        <h3 className="text-xl font-bold text-slate-800 dark:text-white">Oops!</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">{errorMsg}</p>
        <button
          onClick={() => { setErrorMsg(''); setTahap('disclaimer'); }}
          className="px-6 py-2.5 rounded-xl bg-emerald-500 text-white font-semibold text-sm hover:bg-emerald-600 transition-colors"
        >
          ← Kembali
        </button>
      </div>
    );
  }

  // ── Disclaimer
  if (tahap === 'disclaimer') {
    return <DisclaimerModal onMulai={() => { setTahap('loading'); mulaiTes(); }} />;
  }

  // ── Loading soal
  if (tahap === 'loading' || loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
        <p className="text-slate-500 dark:text-slate-400 text-sm">Memuat soal...</p>
      </div>
    );
  }

  // ── Submitting
  if (tahap === 'submitting') {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin" />
        <p className="text-slate-500 dark:text-slate-400 text-sm">Menghitung hasil...</p>
      </div>
    );
  }

  // ── Hasil
  if (tahap === 'hasil') {
    return (
      <div className="py-6 px-2">
        <LayarHasil hasil={hasilAkhir} namaMurid={user.nama} />
      </div>
    );
  }

  // ── Tes
  return (
    <div className="max-w-lg mx-auto">

      {/* Progress bar */}
      <div className="mb-5">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
          <span className="flex items-center gap-1.5">
            <span className="text-base">{dimSekarang?.icon}</span>
            <span className="font-medium">{dimSekarang?.label}</span>
          </span>
          <span>Soal {indeks + 1} / {soalList.length}</span>
        </div>
        <div className="h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${dimSekarang?.color || 'from-emerald-500 to-teal-400'} transition-all duration-500`}
            style={{ width: `${((indeks + 1) / soalList.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Kartu Soal */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm p-5 sm:p-6">

        {/* Pertanyaan + Tombol Audio */}
        <div className="flex items-start gap-3">
          <button
            id="btn-audio-soal"
            onClick={() => {
              setIsPlaying(true);
              speakText(soalSekarang.teks_pertanyaan, () => setIsPlaying(false));
            }}
            className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-xl transition-all ${
              isPlaying
                ? 'bg-emerald-500 text-white animate-pulse'
                : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20'
            }`}
            title="Dengarkan pertanyaan"
          >
            {isPlaying ? '🔊' : '🔈'}
          </button>
          <p className="text-base sm:text-lg font-semibold text-slate-700 dark:text-slate-100 leading-snug flex-1 pt-1">
            {soalSekarang.teks_pertanyaan}
          </p>
        </div>

        {/* Pilihan Jawaban — adaptive per tipe */}
        {soalSekarang.tipe_jawaban === 'emoji' && (
          <KartuEmoji
            opsi={soalSekarang.opsi_jawaban || []}
            jawabanDipilih={jawaban[soalSekarang.id]}
            onPilih={handlePilih}
          />
        )}
        {soalSekarang.tipe_jawaban === 'dropdown' && (
          <KartuDropdown
            opsi={soalSekarang.opsi_jawaban || []}
            jawabanDipilih={jawaban[soalSekarang.id]}
            onPilih={handlePilih}
          />
        )}
        {soalSekarang.tipe_jawaban === 'fill' && (
          <KartuFill
            jawabanDipilih={jawaban[soalSekarang.id]}
            onPilih={handlePilih}
          />
        )}
      </div>

      {/* Tombol Lanjut */}
      <div className="mt-5 flex justify-end">
        <button
          id="btn-lanjut"
          onClick={handleLanjut}
          disabled={!sudahPilih}
          className={`px-6 py-3 rounded-xl font-semibold text-sm transition-all ${
            sudahPilih
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md hover:shadow-lg hover:scale-[1.02]'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
          }`}
        >
          {indeks < soalList.length - 1 ? 'Soal Berikutnya →' : '✅ Selesai & Kirim Jawaban'}
        </button>
      </div>
    </div>
  );
}
