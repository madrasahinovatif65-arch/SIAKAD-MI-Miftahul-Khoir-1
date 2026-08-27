'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

// ─────────────────────────────────────────────────────────────
// Utilitas TTS
// ─────────────────────────────────────────────────────────────
function speakText(teks) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(teks);
  utt.lang  = 'id-ID';
  utt.rate  = 0.85;
  utt.pitch = 1.1;
  const voices = window.speechSynthesis.getVoices();
  const voice  = voices.find(v => v.lang === 'id-ID' && /female|wanita|woman/i.test(v.name))
              || voices.find(v => v.lang === 'id-ID')
              || voices.find(v => v.lang.startsWith('id'));
  if (voice) utt.voice = voice;
  window.speechSynthesis.speak(utt);
}

// ─────────────────────────────────────────────────────────────
// 3 Dimensi NK
// ─────────────────────────────────────────────────────────────
const NK_DIMENSI = [
  {
    key: 'sosial_emosional',
    icon: '💚',
    label: 'Perasaanku di Sekolah',
    pertanyaan: 'Secara umum, bagaimana perasaanmu saat berangkat ke sekolah?',
    pilihan: [
      { value: 'Antusias',    emoji: '😄', label: 'Antusias & Senang' },
      { value: 'Biasa saja',  emoji: '😐', label: 'Biasa Saja' },
      { value: 'Cemas/Takut', emoji: '😟', label: 'Cemas / Tidak Suka' },
    ],
  },
  {
    key: 'dukungan_belajar',
    icon: '🏠',
    label: 'Belajar di Rumah',
    pertanyaan: 'Saat belajar atau mengerjakan tugas di rumah, biasanya kamu…',
    pilihan: [
      { value: 'Didampingi',       emoji: '👨‍👩‍👧', label: 'Ditemani ortu / kakak' },
      { value: 'Mandiri',          emoji: '📖',   label: 'Sendiri / Mandiri' },
      { value: 'Sering kesulitan', emoji: '😓',   label: 'Sering kesulitan tanpa bantuan' },
    ],
  },
  {
    key: 'minat_dominan',
    icon: '⭐',
    label: 'Kegiatan Favoritku',
    pertanyaan: 'Di waktu luang, kegiatan apa yang paling kamu sukai?',
    pilihan: [
      { value: 'Seni',      emoji: '🎨', label: 'Seni / Menggambar' },
      { value: 'Olahraga',  emoji: '⚽', label: 'Olahraga / Fisik' },
      { value: 'Teknologi', emoji: '📱', label: 'Teknologi / Gadget' },
      { value: 'Membaca',   emoji: '📖', label: 'Cerita / Membaca' },
      { value: 'Lainnya',   emoji: '✏️', label: 'Lainnya...' },
    ],
  },
];

// ─────────────────────────────────────────────────────────────
// Disclaimer Modal Anti-Bias
// ─────────────────────────────────────────────────────────────
function DisclaimerNKModal({ onMulai }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-md w-full p-7">
        <div className="text-center mb-5">
          <div className="w-16 h-16 bg-violet-100 dark:bg-violet-500/20 rounded-2xl flex items-center justify-center mx-auto mb-3 text-3xl">
            🛡️
          </div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">Pesan untuk Orang Tua</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Sebelum anak mulai mengisi</p>
        </div>

        <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300 mb-6">
          <div className="flex gap-3 items-start p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
            <span className="text-lg shrink-0">👧</span>
            <p>Biarkan anak menjawab <strong>sesuai perasaan dan pengalamannya sendiri</strong>. Tidak ada jawaban yang benar atau salah.</p>
          </div>
          <div className="flex gap-3 items-start p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
            <span className="text-lg shrink-0">📋</span>
            <p><strong>Hasil ini TIDAK berpengaruh pada nilai rapor.</strong> Hanya digunakan guru untuk memahami kondisi dan minat anak.</p>
          </div>
          <div className="flex gap-3 items-start p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20">
            <span className="text-lg shrink-0">🔊</span>
            <p>Tekan ikon <strong>🔊</strong> untuk mendengarkan pertanyaan jika anak belum lancar membaca.</p>
          </div>
        </div>

        <button
          id="btn-mulai-nk"
          onClick={onMulai}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-500 text-white font-bold text-base shadow-lg hover:shadow-violet-300 dark:hover:shadow-violet-900 hover:scale-[1.02] transition-all"
        >
          ✅ Saya Mengerti — Anak Siap Mengisi
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Kartu Pertanyaan per Dimensi
// ─────────────────────────────────────────────────────────────
function KartuPilihanNK({ dimensi, jawabanDipilih, minatKustom, onPilih, onKustom }) {
  const [speaking, setSpeaking] = useState(false);

  const handleAudio = () => {
    setSpeaking(true);
    speakText(dimensi.pertanyaan);
    const dur = Math.max(2500, dimensi.pertanyaan.length * 65);
    setTimeout(() => setSpeaking(false), dur);
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm p-5 sm:p-6">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <button
          onClick={handleAudio}
          className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all ${
            speaking
              ? 'bg-violet-500 text-white animate-pulse'
              : 'bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-500/20'
          }`}
          title="Dengarkan pertanyaan"
        >
          {speaking ? '🔊' : '🔈'}
        </button>
        <div className="flex-1">
          <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wide mb-1">
            {dimensi.icon} {dimensi.label}
          </p>
          <p className="text-base sm:text-lg font-semibold text-slate-700 dark:text-slate-100 leading-snug">
            {dimensi.pertanyaan}
          </p>
        </div>
      </div>

      {/* Pilihan */}
      <div className="grid grid-cols-1 gap-2.5">
        {dimensi.pilihan.map((p) => {
          const dipilih = jawabanDipilih === p.value;
          return (
            <button
              key={p.value}
              onClick={() => onPilih(dimensi.key, p.value)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all select-none ${
                dipilih
                  ? 'border-violet-500 bg-violet-50 dark:bg-violet-500/15 text-violet-800 dark:text-violet-200'
                  : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 hover:border-violet-300 hover:bg-violet-50/50'
              }`}
            >
              <span className="text-2xl">{p.emoji}</span>
              <span className="font-medium text-sm sm:text-base flex-1">{p.label}</span>
              {dipilih && <span className="text-violet-500 text-lg ml-auto">✓</span>}
            </button>
          );
        })}
      </div>

      {/* Input teks kustom untuk "Lainnya" */}
      {jawabanDipilih === 'Lainnya' && (
        <div className="mt-3">
          <input
            type="text"
            placeholder="Tulis kegiatan favoritmu..."
            value={minatKustom || ''}
            onChange={e => onKustom(e.target.value)}
            autoFocus
            className="w-full px-4 py-3 rounded-xl border-2 border-violet-300 dark:border-violet-500/40 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:border-violet-500 transition-colors"
          />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Layar Hasil / Sudah Diisi
// ─────────────────────────────────────────────────────────────
function LayarHasilNK({ profil, namaMurid }) {
  const labelMap = {};
  for (const d of NK_DIMENSI) {
    for (const p of d.pilihan) {
      labelMap[p.value] = `${p.emoji} ${p.label}`;
    }
  }

  return (
    <div className="max-w-lg mx-auto text-center py-6 px-2">
      <div className="text-5xl mb-3">🎉</div>
      <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-1">Profil Tersimpan!</h2>
      <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
        Terima kasih, <strong>{namaMurid}</strong>. Guru kamu sudah menerima informasinya.
      </p>

      <div className="space-y-3 text-left">
        {NK_DIMENSI.map(d => {
          const val   = profil?.[d.key];
          const label = val ? (labelMap[val] || `✏️ ${val}`) : '—';
          return (
            <div key={d.key} className="flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-400 flex items-center justify-center text-2xl shrink-0">
                {d.icon}
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-0.5">{d.label}</p>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</p>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-slate-400 dark:text-slate-500 mt-5">
        Data ini hanya digunakan guru untuk merencanakan pembelajaran yang sesuai. 💪
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Komponen Utama
// ─────────────────────────────────────────────────────────────
export default function AsesmenNKInteraktif({ user, tahunAjaran }) {
  const [tahap, setTahap]           = useState('disclaimer');
  const [jawaban, setJawaban]       = useState({});
  const [minatKustom, setMinatKustom] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [hasilAkhir, setHasilAkhir] = useState(null);

  const handleMulai = async () => {
    // Cek apakah sudah pernah mengisi tahun ini
    const { data } = await supabase
      .from('profil_non_kognitif')
      .select('id_murid, sosial_emosional, dukungan_belajar, minat_dominan, diisi_oleh')
      .eq('id_murid', user.id_user)
      .eq('tahun_ajaran', tahunAjaran || '')
      .maybeSingle();

    if (data) {
      setHasilAkhir(data);
      setTahap('hasil');
      return;
    }
    setTahap('form');
  };

  const handlePilih = (key, value) => {
    setJawaban(prev => ({ ...prev, [key]: value }));
  };

  const allFilled = NK_DIMENSI.every(d => {
    const val = jawaban[d.key];
    if (!val) return false;
    if (val === 'Lainnya') return minatKustom.trim().length > 0;
    return true;
  });

  const handleSubmit = async () => {
    if (!allFilled) return;
    setSubmitting(true);
    setTahap('submitting');
    try {
      const minatFinal = jawaban.minat_dominan === 'Lainnya'
        ? minatKustom.trim()
        : jawaban.minat_dominan;

      const res = await fetch('/api/asesmen/profil-nk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_murid:         user.id_user,
          id_wali_kelas:    user.id_user,   // murid mengisi sendiri
          rombel:           user.rombel,
          tahun_ajaran:     tahunAjaran || '',
          sosial_emosional: jawaban.sosial_emosional,
          dukungan_belajar: jawaban.dukungan_belajar,
          minat_dominan:    minatFinal,
          diisi_oleh:       'murid',
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Gagal menyimpan.');

      setHasilAkhir({
        sosial_emosional: jawaban.sosial_emosional,
        dukungan_belajar: jawaban.dukungan_belajar,
        minat_dominan:    minatFinal,
      });
      setTahap('hasil');
    } catch (err) {
      console.error(err);
      setTahap('form');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Disclaimer
  if (tahap === 'disclaimer') {
    return <DisclaimerNKModal onMulai={handleMulai} />;
  }

  // ── Submitting
  if (tahap === 'submitting') {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin" />
        <p className="text-slate-500 dark:text-slate-400 text-sm">Menyimpan profil...</p>
      </div>
    );
  }

  // ── Hasil
  if (tahap === 'hasil') {
    return <LayarHasilNK profil={hasilAkhir} namaMurid={user.nama} />;
  }

  // ── Form
  const progress = NK_DIMENSI.filter(d => jawaban[d.key]).length;

  return (
    <div className="max-w-lg mx-auto pb-6">
      {/* Progress */}
      <div className="mb-5">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
          <span className="font-medium">🧠 Profil Belajarku</span>
          <span>{progress} / {NK_DIMENSI.length} pertanyaan</span>
        </div>
        <div className="h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-400 transition-all duration-500"
            style={{ width: `${(progress / NK_DIMENSI.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Kartu per dimensi (semua tampil sekaligus — bukan satu per satu) */}
      <div className="space-y-4">
        {NK_DIMENSI.map(d => (
          <KartuPilihanNK
            key={d.key}
            dimensi={d}
            jawabanDipilih={jawaban[d.key] || ''}
            minatKustom={minatKustom}
            onPilih={handlePilih}
            onKustom={setMinatKustom}
          />
        ))}
      </div>

      {/* Tombol Simpan */}
      <div className="mt-6 flex justify-end">
        <button
          id="btn-simpan-nk"
          onClick={handleSubmit}
          disabled={!allFilled || submitting}
          className={`px-8 py-3 rounded-xl font-semibold text-sm transition-all ${
            allFilled
              ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-md hover:shadow-lg hover:scale-[1.02]'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
          }`}
        >
          {submitting ? '⏳ Menyimpan...' : '✅ Kirim Profil Saya'}
        </button>
      </div>
    </div>
  );
}
