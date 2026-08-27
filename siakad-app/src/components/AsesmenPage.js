'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import useSWR from 'swr';
import { supabase } from '@/lib/supabase';

// ──────────────────────────────────────────────────────────────────────────────
// Sub-komponen & Helpers
// ──────────────────────────────────────────────────────────────────────────────

const KOGNITIF_OPTIONS = ['Mahir', 'Berkembang', 'Butuh Pendampingan'];

// ──────────────────────────────────────────────────────────────────────────────
// Dimensi Asesmen Diagnostik Non-Kognitif
// ──────────────────────────────────────────────────────────────────────────────
const NK_DIMENSI = [
  {
    key: 'sosial_emosional',
    label: 'Sosial-Emosional',
    icon: '💚',
    pertanyaan: 'Secara umum, bagaimana perasaanmu saat berangkat ke sekolah?',
    pilihan: [
      { value: 'Antusias',      label: 'Antusias',        emoji: '🟢', badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' },
      { value: 'Biasa saja',    label: 'Biasa saja',      emoji: '🟡', badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' },
      { value: 'Cemas/Takut',   label: 'Cemas / Takut',   emoji: '🔴', badgeClass: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300' },
    ],
  },
  {
    key: 'dukungan_belajar',
    label: 'Dukungan Belajar',
    icon: '🏠',
    pertanyaan: 'Saat belajar atau mengerjakan tugas di rumah, biasanya kamu…',
    pilihan: [
      { value: 'Didampingi',        label: 'Didampingi ortu/kakak',       emoji: '🟢', badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' },
      { value: 'Mandiri',           label: 'Mandiri / Sendiri',            emoji: '🟡', badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' },
      { value: 'Sering kesulitan',  label: 'Sering kesulitan tanpa bantuan', emoji: '🔴', badgeClass: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300' },
    ],
  },
  {
    key: 'minat_dominan',
    label: 'Minat Dominan',
    icon: '⭐',
    pertanyaan: 'Di waktu luang, kegiatan apa yang paling kamu sukai?',
    pilihan: [
      { value: 'Seni',       label: 'Seni / Menggambar',    emoji: '🎨', badgeClass: 'bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300' },
      { value: 'Olahraga',  label: 'Olahraga / Fisik',     emoji: '⚽', badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300' },
      { value: 'Teknologi', label: 'Teknologi / Gadget',   emoji: '📱', badgeClass: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300' },
      { value: 'Membaca',   label: 'Cerita / Membaca',     emoji: '📖', badgeClass: 'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300' },
      { value: 'Lainnya',   label: 'Lainnya...',           emoji: '✏️', badgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300' },
    ],
  },
];

// Nilai minat yang sudah ditetapkan (di luar ini = kustom / Lainnya)
const MINAT_PREDEFINED = ['Seni', 'Olahraga', 'Teknologi', 'Membaca', 'Lainnya'];

const STATUS_BADGE = {
  Belum: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400',
  Generating: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 animate-pulse',
  Draft: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300',
  Tersimpan: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
};

function SectionHeader({ title, subtitle }) {
  return (
    <div className="mb-4 sm:mb-6">
      <h2 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-white leading-snug">{title}</h2>
      {subtitle && <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{subtitle}</p>}
    </div>
  );
}

function FilterBar({ filters, onChange, mapelOptions = [], rombelOptions = [] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap gap-2 sm:gap-3 mb-4 sm:mb-6 p-3 sm:p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-white/10">
      <select
        id="filter-tahun-ajaran"
        value={filters.tahun_ajaran}
        onChange={e => onChange('tahun_ajaran', e.target.value)}
        className="select-field w-full lg:w-auto"
      >
        <option value="2026/2027">2026/2027</option>
        <option value="2025/2026">2025/2026</option>
      </select>
      <select
        id="filter-semester"
        value={filters.semester}
        onChange={e => onChange('semester', e.target.value)}
        className="select-field w-full lg:w-auto"
      >
        <option value="Ganjil">Ganjil</option>
        <option value="Genap">Genap</option>
      </select>
      {filters.rombel !== undefined && (
        <select
          id="filter-rombel"
          value={filters.rombel}
          onChange={e => onChange('rombel', e.target.value)}
          className="select-field w-full lg:w-auto"
        >
          <option value="">-- Pilih Rombel --</option>
          {rombelOptions.map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      )}
      {filters.mata_pelajaran !== undefined && (
        <select
          id="filter-mapel"
          value={filters.mata_pelajaran}
          onChange={e => onChange('mata_pelajaran', e.target.value)}
          className="select-field w-full lg:w-auto"
        >
          <option value="">-- Pilih Mata Pelajaran --</option>
          {mapelOptions.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      )}
    </div>
  );
}

function TabDiagnostik({ user, filters }) {
  const [rows, setRows] = useState({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [mode, setMode] = useState('umum');
  const [selectedTP, setSelectedTP] = useState('');

  // ── SWR: Daftar murid & Hasil Kognitif
  const swrKeyMurid = filters.rombel && filters.semester && filters.tahun_ajaran
    ? `enrollment_${filters.rombel}_${filters.semester}_${filters.tahun_ajaran}_${filters.mata_pelajaran}_${mode}_${selectedTP}`
    : null;

  const { data: muridList = [], isLoading: loadingMurid, mutate: mutateMurid } = useSWR(swrKeyMurid, async () => {
    const { data: enrolled } = await supabase
      .from('enrollment_murid')
      .select('id_murid, nama_murid')
      .eq('rombel', filters.rombel)
      .eq('semester', filters.semester)
      .eq('tahun_ajaran', filters.tahun_ajaran)
      .order('nama_murid', { ascending: true });

    const enrolledArr = Array.isArray(enrolled) ? enrolled : [];

    if (mode === 'umum') {
      const res = await fetch(`/api/asesmen/kognitif-interaktif?rombel=${encodeURIComponent(filters.rombel)}&tahun_ajaran=${encodeURIComponent(filters.tahun_ajaran)}&semester=${encodeURIComponent(filters.semester)}`);
      const existingArr = await res.json();
      return enrolledArr.map(m => ({
        ...m,
        hasil_umum: (Array.isArray(existingArr) ? existingArr : []).find(e => e.id_murid === m.id_murid)
      }));
    } else {
      const tpParam = selectedTP ? `&id_tp=${selectedTP}` : '';
      const res = await fetch(
        `/api/asesmen?rombel=${encodeURIComponent(filters.rombel || '')}&semester=${encodeURIComponent(filters.semester || '')}&tahun_ajaran=${encodeURIComponent(filters.tahun_ajaran || '')}&jenis=awal&mapel=${encodeURIComponent(filters.mata_pelajaran || '')}&id_guru=${user.id_user}${tpParam}`
      );
      const existing = await res.json();
      const existingArr = Array.isArray(existing) ? existing : [];
      return enrolledArr.map(m => ({
        ...m,
        existing: existingArr.find(e => e.id_murid === m.id_murid),
      }));
    }
  });

  // ── SWR: Profil non-kognitif
  const swrKeyProfil = filters.rombel && filters.tahun_ajaran
    ? `profil_nk_${filters.rombel}_${filters.tahun_ajaran}`
    : null;
  const { data: profilMap = {} } = useSWR(swrKeyProfil, async () => {
    const res = await fetch(`/api/asesmen/profil-nk?rombel=${encodeURIComponent(filters.rombel || '')}&tahun_ajaran=${encodeURIComponent(filters.tahun_ajaran || '')}`);
    const data = await res.json();
    return Object.fromEntries((Array.isArray(data) ? data : []).map(p => [p.id_murid, p]));
  });

  // ── SWR: Daftar TP dari master
  const tingkat = filters.rombel ? filters.rombel.replace(/[A-Z]$/, '').trim() : '';
  const swrKeyTP = mode === 'per_materi' && filters.mata_pelajaran && tingkat
    ? `tp_${filters.mata_pelajaran}_${tingkat}_${filters.tahun_ajaran}`
    : null;
  const { data: tpList = [], isLoading: loadingTP } = useSWR(swrKeyTP, async () => {
    const res = await fetch(`/api/asesmen/tp?mapel=${encodeURIComponent(filters.mata_pelajaran || '')}&tingkat_kelas=${encodeURIComponent(tingkat)}&tahun_ajaran=${encodeURIComponent(filters.tahun_ajaran || '')}`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  });

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSavePerMateri = async () => {
    if (!filters.rombel || !filters.mata_pelajaran) return showToast('Isi Rombel dan Mata Pelajaran.', 'error');
    if (!selectedTP) return showToast('Pilih Tujuan Pembelajaran.', 'error');
    setSaving(true);
    try {
      const records = muridList
        .filter(m => rows[m.id_murid]?.hasil_kognitif)
        .map(m => ({
          id_guru: user.id_user,
          id_murid: m.id_murid,
          nama_murid: m.nama_murid,
          rombel: filters.rombel,
          tahun_ajaran: filters.tahun_ajaran,
          semester: filters.semester,
          mata_pelajaran: filters.mata_pelajaran,
          hasil_kognitif: rows[m.id_murid].hasil_kognitif,
          id_tp: selectedTP,
          tujuan_pembelajaran: tpList.find(t => t.id === selectedTP)?.tujuan || null,
        }));
      if (records.length === 0) { setSaving(false); return showToast('Belum ada data diisi.', 'error'); }
      const res = await fetch('/api/asesmen/bulk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ records }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast(`✅ Data per materi disimpan!`);
      setRows({}); mutateMurid();
    } catch (err) {
      showToast(err.message, 'error');
    } finally { setSaving(false); }
  };

  // ── State Modal Editor Jawaban ──
  const [editorModal, setEditorModal] = useState(null);
  // editorModal = { murid, hasil, soalList, jawaban }
  const [editorJawaban, setEditorJawaban] = useState({});
  const [savingEditor, setSavingEditor] = useState(false);
  const [editorNote, setEditorNote] = useState('');

  const openEditor = async (murid, hasil) => {
    if (!hasil?.raw_jawaban) return showToast('Belum ada data jawaban murid.', 'error');
    const soalList = Object.entries(hasil.raw_jawaban).map(([id, s]) => ({ id, ...s }));
    const prefill = {};
    for (const s of soalList) prefill[s.id] = s.jawaban_murid || '';
    setEditorJawaban(prefill);
    setEditorNote(hasil.catatan_guru || '');
    setEditorModal({ murid, hasil, soalList });
  };

  const handleSaveKoreksi = async () => {
    if (!editorModal) return;
    setSavingEditor(true);
    try {
      const res = await fetch(
        `/api/asesmen/kognitif-interaktif?id_murid=${editorModal.murid.id_murid}&tahun_ajaran=${encodeURIComponent(filters.tahun_ajaran)}&semester=${encodeURIComponent(filters.semester)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jawaban_koreksi: editorJawaban,
            catatan_guru: editorNote,
            divalidasi_oleh: user.id_user,
          }),
        }
      );
      if (!res.ok) throw new Error((await res.json()).error);
      showToast('✅ Jawaban tersimpan & skor dihitung ulang.');
      setEditorModal(null);
      mutateMurid();
    } catch (err) {
      showToast(err.message, 'error');
    } finally { setSavingEditor(false); }
  };

  const needsFilter = mode === 'per_materi' ? (!filters.rombel || !filters.mata_pelajaran) : !filters.rombel;
  const needsTP = mode === 'per_materi' && !selectedTP;

  return (
    <div>
      <SectionHeader
        title="📋 Diagnostik Kognitif"
        subtitle="Pemetaan kemampuan awal murid. Kognitif Umum diisi mandiri oleh murid via Tes Interaktif, Kognitif Per Materi diisi oleh guru."
      />

      {/* ── Mode Toggle ── */}
      <div className="mb-4 flex flex-col sm:flex-row gap-2">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 self-center whitespace-nowrap">Jenis Asesmen:</p>
        <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
          {[
            { key: 'umum', label: '🔵 Kognitif Umum', sub: 'Lintas Mapel (Sistem)' },
            { key: 'per_materi', label: '📌 Kognitif Per Materi', sub: 'Input Manual Guru' },
          ].map(m => (
            <button key={m.key} onClick={() => { setMode(m.key); setSelectedTP(''); setRows({}); }}
              className={`flex flex-col items-start px-3 sm:px-4 py-2 rounded-lg text-left transition-all ${
                mode === m.key ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}>
              <span className="text-xs sm:text-sm font-semibold whitespace-nowrap">{m.label}</span>
              <span className="text-xs text-slate-400 hidden sm:block">{m.sub}</span>
            </button>
          ))}
        </div>
      </div>

      {mode === 'per_materi' && (
        <div className="mb-4 p-3 sm:p-4 bg-blue-50 rounded-xl border border-blue-200">
          <label className="label-field text-blue-700">📌 Pilih Tujuan Pembelajaran</label>
          <select value={selectedTP} onChange={e => { setSelectedTP(e.target.value); setRows({}); }} className="select-field w-full mt-1">
            <option value="">-- Pilih Tujuan Pembelajaran --</option>
            {tpList.map(tp => <option key={tp.id} value={tp.id}>{tp.tujuan}</option>)}
          </select>
        </div>
      )}

      {mode === 'umum' && (
        <div className="mb-4 flex items-center gap-2 text-xs text-slate-500 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200">
          <span>🤖</span>
          <span><strong>Dashboard Validasi AI:</strong> Skor dihitung otomatis dari tes mandiri murid. Untuk soal isian, jawaban dinilai oleh AI (Gemini) secara semantik. Guru dapat menekan <strong>"👁️ Lihat & Koreksi"</strong> untuk melihat jawaban murid dan mengeditnya jika perlu — sistem akan menghitung ulang skor secara otomatis.</span>
        </div>
      )}

      {toast && (
        <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${toast.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
          {toast.msg}
        </div>
      )}

      {needsFilter ? (
        <div className="text-center py-12 text-slate-400"><p>Isi filter Rombel (dan Mapel) untuk memuat daftar murid.</p></div>
      ) : needsTP ? (
        <div className="text-center py-12 text-slate-400"><p>Pilih Tujuan Pembelajaran di atas.</p></div>
      ) : loadingMurid ? (
        <div className="text-center py-8 text-slate-400">Memuat data...</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-3 py-3 font-semibold text-slate-600 w-8">#</th>
                <th className="text-left px-3 py-3 font-semibold text-slate-600">Nama Murid</th>
                {mode === 'umum' ? (
                  <>
                    <th className="text-left px-3 py-3 font-semibold text-slate-600">Literasi</th>
                    <th className="text-left px-3 py-3 font-semibold text-slate-600">Numerasi</th>
                    <th className="text-left px-3 py-3 font-semibold text-slate-600">Penalaran</th>
                    <th className="text-left px-3 py-3 font-semibold text-slate-600">Catatan & Aksi</th>
                  </>
                ) : (
                  <>
                    <th className="text-left px-3 py-3 font-semibold text-slate-600">Profil Belajar</th>
                    <th className="text-left px-3 py-3 font-semibold text-slate-600">Hasil Kognitif</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {muridList.map((m, i) => {
                if (mode === 'umum') {
                  const h = m.hasil_umum;

                  // Badge helper
                  const BADGE_COLOR = {
                    'Sangat Cakap':   'bg-emerald-100 text-emerald-700',
                    'Cakap':          'bg-blue-100 text-blue-700',
                    'Berkembang':     'bg-amber-100 text-amber-700',
                    'Perlu Bimbingan':'bg-red-100 text-red-700',
                  };
                  const KategoriBadge = ({ skor, kategori }) => {
                    if (!kategori) return <span className="text-xs text-slate-400">—</span>;
                    return (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs text-slate-500">{skor}%</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full w-fit ${BADGE_COLOR[kategori] || 'bg-slate-100 text-slate-600'}`}>{kategori}</span>
                      </div>
                    );
                  };

                  return (
                    <tr key={m.id_murid} className="hover:bg-slate-50">
                      <td className="px-3 py-3 text-slate-400">{i + 1}</td>
                      <td className="px-3 py-3 font-medium text-slate-700">
                        {m.nama_murid}
                        {!h
                          ? <span className="block text-xs text-red-400 font-normal mt-0.5">Belum Mengerjakan Tes</span>
                          : h.divalidasi_at
                            ? <span className="block text-xs text-emerald-500 font-normal mt-0.5">✓ Sudah dikoreksi guru</span>
                            : null
                        }
                      </td>
                      <td className="px-3 py-3">
                        <KategoriBadge skor={h?.skor_literasi} kategori={h?.kategori_literasi} />
                      </td>
                      <td className="px-3 py-3">
                        <KategoriBadge skor={h?.skor_numerasi} kategori={h?.kategori_numerasi} />
                      </td>
                      <td className="px-3 py-3">
                        <KategoriBadge skor={h?.skor_reasoning} kategori={h?.kategori_reasoning} />
                      </td>
                      <td className="px-3 py-3 min-w-[160px]">
                        {h?.catatan_guru && (
                          <p className="text-xs text-slate-500 italic mb-1 line-clamp-1">💬 {h.catatan_guru}</p>
                        )}
                        {h?.raw_jawaban ? (
                          <button
                            onClick={() => openEditor(m, h)}
                            className="text-xs px-3 py-1.5 bg-violet-50 border border-violet-200 text-violet-700 rounded-lg hover:bg-violet-100 transition-colors w-full font-medium"
                          >
                            👁️ Lihat & Koreksi
                          </button>
                        ) : h ? (
                          <span className="text-xs text-slate-400 italic">Jawaban tidak tersedia</span>
                        ) : null}
                      </td>
                    </tr>
                  );
                } else {
                  // Mode Per Materi
                  const profil = profilMap[m.id_murid];
                  const current = rows[m.id_murid]?.hasil_kognitif || m.existing?.hasil_kognitif || '';
                  return (
                    <tr key={m.id_murid} className="hover:bg-slate-50">
                      <td className="px-3 py-3 text-slate-400">{i + 1}</td>
                      <td className="px-3 py-3 font-medium text-slate-700">{m.nama_murid} {m.existing?.hasil_kognitif && <span className="text-emerald-500">✓</span>}</td>
                      <td className="px-3 py-3">
                        <div className="flex gap-1 text-xs">
                          {profil?.sosial_emosional && <span className="bg-emerald-100 text-emerald-700 px-2 rounded-full">{profil.sosial_emosional}</span>}
                          {profil?.minat_dominan && <span className="bg-violet-100 text-violet-700 px-2 rounded-full">⭐ {profil.minat_dominan}</span>}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <select value={current} onChange={e => setRows(p => ({ ...p, [m.id_murid]: { hasil_kognitif: e.target.value } }))} className="select-field text-sm w-full">
                          <option value="">-- Pilih --</option>
                          {KOGNITIF_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </td>
                    </tr>
                  );
                }
              })}
            </tbody>
          </table>
          {mode === 'per_materi' && (
            <div className="p-4 border-t border-slate-200 flex justify-end">
              <button onClick={handleSavePerMateri} disabled={saving} className="btn-primary">{saving ? 'Menyimpan...' : '💾 Simpan Semua'}</button>
            </div>
          )}
        </div>
      )}

      {/* ── Modal Editor Jawaban ── */}
      {editorModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-slate-800 text-lg">👁️ Koreksi Jawaban</h3>
                <p className="text-sm text-slate-500">{editorModal.murid.nama_murid} — {filters.rombel}</p>
              </div>
              <button onClick={() => setEditorModal(null)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
            </div>

            {/* Body: daftar soal */}
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
              {editorModal.soalList.map((soal, idx) => {
                const BADGE_COLOR = {
                  literasi: 'bg-blue-50 text-blue-700 border-blue-200',
                  numerasi: 'bg-amber-50 text-amber-700 border-amber-200',
                  reasoning: 'bg-violet-50 text-violet-700 border-violet-200',
                };
                return (
                  <div key={soal.id} className="border border-slate-200 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <span className="text-slate-400 text-sm font-medium mt-0.5">{idx + 1}.</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${BADGE_COLOR[soal.dimensi] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                            {soal.dimensi}
                          </span>
                          {soal.tipe_jawaban === 'fill' && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 border border-orange-200 font-medium">✏️ Isian (AI)</span>
                          )}
                          {soal.is_benar
                            ? <span className="text-xs text-emerald-600 font-semibold">✅ Benar</span>
                            : <span className="text-xs text-red-500 font-semibold">❌ Salah</span>
                          }
                        </div>
                        <p className="text-sm font-medium text-slate-800 mb-3">{soal.teks_pertanyaan}</p>

                        {soal.tipe_jawaban === 'fill' ? (
                          <div className="space-y-1">
                            <label className="text-xs text-slate-500">Jawaban murid (edit jika perlu):</label>
                            <input
                              type="text"
                              value={editorJawaban[soal.id] || ''}
                              onChange={e => setEditorJawaban(p => ({ ...p, [soal.id]: e.target.value }))}
                              className="input-field text-sm w-full"
                              placeholder="Ketik jawaban murid..."
                            />
                            <p className="text-xs text-slate-400">Kunci: <em>{soal.jawaban_benar}</em></p>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {(soal.opsi_jawaban || []).map(opsi => {
                              const dipilih = editorJawaban[soal.id] === opsi.label;
                              return (
                                <label key={opsi.label} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors ${
                                  dipilih
                                    ? opsi.is_correct ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-red-50 border-red-300 text-red-800'
                                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                }`}>
                                  <input
                                    type="radio"
                                    name={`soal-${soal.id}`}
                                    value={opsi.label}
                                    checked={dipilih}
                                    onChange={() => setEditorJawaban(p => ({ ...p, [soal.id]: opsi.label }))}
                                    className="accent-emerald-600"
                                  />
                                  {soal.tipe_jawaban === 'emoji' && <span className="text-xl">{opsi.emoji}</span>}
                                  <span>{opsi.label}</span>
                                  {opsi.is_correct && <span className="ml-auto text-xs text-emerald-600">✓ Kunci</span>}
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Catatan Guru */}
              <div className="border border-slate-200 rounded-xl p-4">
                <label className="text-sm font-medium text-slate-700 mb-2 block">💬 Catatan Guru (opsional)</label>
                <textarea
                  value={editorNote}
                  onChange={e => setEditorNote(e.target.value)}
                  rows={2}
                  placeholder="Tambahkan catatan observasi guru..."
                  className="input-field text-sm w-full resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button onClick={() => setEditorModal(null)} className="btn-secondary text-sm">Batal</button>
              <button onClick={handleSaveKoreksi} disabled={savingEditor} className="btn-primary text-sm">
                {savingEditor ? '⏳ Menyimpan...' : '🔄 Simpan & Hitung Ulang Nilai'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ──────────────────────────────────────────────────────────────────────────────
// TAB 2: Profil Non-Kognitif (Wali Kelas Eksklusif)
// ──────────────────────────────────────────────────────────────────────────────

function TabProfilNK({ user, filters }) {
  const [rows, setRows] = useState({});
  const [saving, setSaving] = useState({});
  const [toast, setToast] = useState(null);

  const swrKey = filters.rombel && filters.tahun_ajaran
    ? `profil_nk_${filters.rombel}_${filters.tahun_ajaran}`
    : null;

  const { data: muridList = [], isLoading, mutate } = useSWR(swrKey, async () => {
    const { data: enrolled } = await supabase
      .from('enrollment_murid')
      .select('id_murid, nama_murid')
      .eq('rombel', filters.rombel)
      .eq('tahun_ajaran', filters.tahun_ajaran)
      .eq('semester', filters.semester)
      .order('nama_murid', { ascending: true });

    const res = await fetch(`/api/asesmen/profil-nk?rombel=${encodeURIComponent(filters.rombel || '')}&tahun_ajaran=${encodeURIComponent(filters.tahun_ajaran || '')}`);
    const profilData = await res.json();
    const profilArr = Array.isArray(profilData) ? profilData : [];
    const profilMap = Object.fromEntries(profilArr.map(p => [p.id_murid, p]));

    return (Array.isArray(enrolled) ? enrolled : []).map(m => ({ ...m, profil: profilMap[m.id_murid] }));
  });

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Ambil nilai dimensi: prioritaskan state lokal, fallback ke data tersimpan
  const getVal = (id_murid, key) => {
    if (rows[id_murid]?.[key] !== undefined) return rows[id_murid][key];
    const m = muridList.find(x => x.id_murid === id_murid);
    return m?.profil?.[key] ?? '';
  };

  const setVal = (id_murid, key, value) => {
    setRows(prev => ({ ...prev, [id_murid]: { ...prev[id_murid], [key]: value } }));
  };

  const handleSaveRow = async (murid) => {
    setSaving(prev => ({ ...prev, [murid.id_murid]: true }));
    const payload = {
      id_murid: murid.id_murid,
      id_wali_kelas: user.id_user,
      rombel: filters.rombel,
      tahun_ajaran: filters.tahun_ajaran,
      sosial_emosional: getVal(murid.id_murid, 'sosial_emosional') || null,
      dukungan_belajar: getVal(murid.id_murid, 'dukungan_belajar') || null,
      minat_dominan:    (() => {
        const raw = getVal(murid.id_murid, 'minat_dominan');
        if (raw === 'Lainnya') {
          // Simpan teks kustom; jika kosong → null
          return rows[murid.id_murid]?.minat_kustom?.trim() || null;
        }
        return raw || null;
      })(),
      catatan_khusus:   getVal(murid.id_murid, 'catatan_khusus') || '',
    };
    try {
      const res = await fetch('/api/asesmen/profil-nk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast(`✅ Profil ${murid.nama_murid} berhasil disimpan.`);
      mutate(); // refresh SWR cache
    } catch (err) {
      showToast(`❌ ${err.message}`, 'error');
    } finally {
      setSaving(prev => ({ ...prev, [murid.id_murid]: false }));
    }
  };

  // Hitung kelengkapan profil per murid
  const completenessOf = (m) => {
    // minat dianggap terisi jika ada nilai (termasuk teks kustom)
    const minatVal = getVal(m.id_murid, 'minat_dominan');
    const minatFilled = minatVal === 'Lainnya'
      ? !!(rows[m.id_murid]?.minat_kustom?.trim())
      : !!minatVal;
    const lainFilled = NK_DIMENSI
      .filter(d => d.key !== 'minat_dominan')
      .filter(d => getVal(m.id_murid, d.key)).length;
    return { filled: lainFilled + (minatFilled ? 1 : 0), total: NK_DIMENSI.length };
  };

  // Cek apakah nilai minat dari DB adalah teks kustom (bukan pilihan baku)
  const isMinatKustom = (id_murid) => {
    const stored = muridList.find(x => x.id_murid === id_murid)?.profil?.minat_dominan;
    return stored && !MINAT_PREDEFINED.includes(stored);
  };

  // Teks yang ditampilkan di input Lainnya
  const getMinatKustomText = (id_murid) => {
    if (rows[id_murid]?.minat_kustom !== undefined) return rows[id_murid].minat_kustom;
    if (isMinatKustom(id_murid)) return muridList.find(x => x.id_murid === id_murid)?.profil?.minat_dominan || '';
    return '';
  };

  // Apakah tombol Lainnya aktif?
  const isLainnyaActive = (id_murid) => {
    const val = getVal(id_murid, 'minat_dominan');
    return val === 'Lainnya' || isMinatKustom(id_murid);
  };

  // Smooth scroll ke kartu murid berdasarkan id
  const jumpToMurid = (id_murid) => {
    if (!id_murid) return;
    const el = document.getElementById(`nk-card-${id_murid}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div>
      <SectionHeader
        title="🧠 Asesmen Diagnostik Non-Kognitif"
        subtitle="Isi profil murid sekali di awal tahun ajaran. Data ini membantu guru memahami kondisi sosial-emosional, dukungan keluarga, dan minat belajar setiap murid."
      />

      {/* Legend dimensi */}
      <div className="flex flex-wrap gap-2 mb-6">
        {NK_DIMENSI.map(d => (
          <span key={d.key} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10">
            <span>{d.icon}</span> {d.label}
          </span>
        ))}
      </div>

      {toast && (
        <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${toast.type === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'}`}>
          {toast.msg}
        </div>
      )}

      {!filters.rombel ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-3xl mb-2">📋</p>
          <p className="text-sm">Pilih Rombel di filter untuk memuat daftar murid.</p>
        </div>
      ) : isLoading ? (
        <div className="flex items-center gap-2 text-slate-400 py-8">
          <div className="w-5 h-5 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
          <span>Memuat data murid...</span>
        </div>
      ) : muridList.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-3xl mb-2">🔍</p>
          <p className="text-sm">Tidak ada murid ditemukan di rombel ini.</p>
        </div>
      ) : (
        <div className="space-y-5">

          {/* ── Sticky jump bar ── */}
          <div className="sticky top-0 z-10 -mx-1 px-1 py-2 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-sm border-b border-slate-200 dark:border-white/10 mb-2">
            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                🎯 Loncat ke:
              </label>
              <select
                id="jump-to-murid"
                defaultValue=""
                onChange={e => { jumpToMurid(e.target.value); e.target.value = ''; }}
                className="flex-1 select-field text-sm py-1.5"
              >
                <option value="">— Pilih nama murid —</option>
                {(Array.isArray(muridList) ? muridList : []).map((m, i) => {
                  const { filled, total } = completenessOf(m);
                  const isComplete = filled === total;
                  return (
                    <option key={m.id_murid} value={m.id_murid}>
                      {isComplete ? '✓' : `${i + 1}.`} {m.nama_murid} {isComplete ? '(Lengkap)' : `(${filled}/${total})`}
                    </option>
                  );
                })}
              </select>
              {/* Progress ringkas */}
              <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                {(Array.isArray(muridList) ? muridList : []).filter(m => completenessOf(m).filled === NK_DIMENSI.length).length}
                /{muridList.length} selesai
              </span>
            </div>
          </div>


          {(Array.isArray(muridList) ? muridList : []).map((m, i) => {
            const { filled, total } = completenessOf(m);
            const isComplete = filled === total;
            const isSaving = saving[m?.id_murid];

            return (
              <div
                id={`nk-card-${m.id_murid}`}
                key={m.id_murid}
                className={`rounded-xl border transition-all scroll-mt-16 ${
                  isComplete
                    ? 'border-emerald-300 dark:border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-500/5'
                    : 'border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800/50'
                }`}
              >
                {/* Header murid */}
                <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-slate-100 dark:border-white/5">
                  <div className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${isComplete ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                      {isComplete ? '✓' : i + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{m.nama_murid}</p>
                      <p className="text-xs text-slate-400">
                        {filled}/{total} dimensi terisi
                        {isComplete && <span className="ml-1 text-emerald-500 font-medium">· Lengkap</span>}
                      </p>
                    </div>
                  </div>

                  {/* Badge ringkasan dimensi */}
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    {NK_DIMENSI.map(d => {
                      const val = getVal(m.id_murid, d.key);
                      const opt = d.pilihan.find(p => p.value === val);
                      return val ? (
                        <span key={d.key} className={`px-2 py-0.5 rounded-full text-xs font-medium ${opt?.badgeClass || 'bg-slate-100 text-slate-500'}`}>
                          {opt?.emoji} {val}
                        </span>
                      ) : (
                        <span key={d.key} className="px-2 py-0.5 rounded-full text-xs bg-slate-100 dark:bg-slate-700 text-slate-400">
                          {d.icon} —
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Dimensi asesmen */}
                <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  {NK_DIMENSI.map(d => {
                    const currentVal = getVal(m.id_murid, d.key);
                    return (
                      <div key={d.key} className="space-y-2">
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                          {d.icon} {d.label}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 italic leading-snug">
                          "{d.pertanyaan}"
                        </p>
                        <div className="flex flex-col gap-1.5">
                          {d.pilihan.map(opt => {
                            // Logika seleksi khusus untuk dimensi minat_dominan
                            let isSelected;
                            if (d.key === 'minat_dominan' && opt.value === 'Lainnya') {
                              isSelected = isLainnyaActive(m.id_murid);
                            } else if (d.key === 'minat_dominan') {
                              // Pilihan baku: hanya aktif jika nilainya persis sama
                              const cur = rows[m.id_murid]?.minat_dominan !== undefined
                                ? rows[m.id_murid].minat_dominan
                                : (isMinatKustom(m.id_murid) ? 'Lainnya' : getVal(m.id_murid, d.key));
                              isSelected = cur === opt.value;
                            } else {
                              isSelected = getVal(m.id_murid, d.key) === opt.value;
                            }

                            return (
                              <button
                                key={opt.value}
                                id={`btn-nk-${d.key}-${opt.value}-${m.id_murid}`}
                                type="button"
                                onClick={() => {
                                  if (d.key === 'minat_dominan' && opt.value === 'Lainnya') {
                                    // Toggle Lainnya
                                    if (isLainnyaActive(m.id_murid)) {
                                      setVal(m.id_murid, 'minat_dominan', '');
                                    } else {
                                      setVal(m.id_murid, 'minat_dominan', 'Lainnya');
                                    }
                                  } else {
                                    setVal(m.id_murid, d.key, isSelected ? '' : opt.value);
                                  }
                                }}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-all border ${
                                  isSelected
                                    ? `${opt.badgeClass} border-current font-medium shadow-sm`
                                    : 'bg-white dark:bg-slate-700/50 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-white/20 hover:bg-slate-50 dark:hover:bg-slate-700'
                                }`}
                              >
                                <span className="text-base leading-none">{opt.emoji}</span>
                                <span>{opt.label}</span>
                                {isSelected && <span className="ml-auto text-xs">✓</span>}
                              </button>
                            );
                          })}

                          {/* Input teks kustom — muncul hanya saat Lainnya aktif di dimensi minat */}
                          {d.key === 'minat_dominan' && isLainnyaActive(m.id_murid) && (
                            <div className="mt-1">
                              <input
                                id={`minat-kustom-${m.id_murid}`}
                                type="text"
                                maxLength={50}
                                placeholder="Tulis minat spesifik... (mis. Memasak, Musik, Berkebun)"
                                value={getMinatKustomText(m.id_murid)}
                                onChange={e => setRows(prev => ({
                                  ...prev,
                                  [m.id_murid]: { ...prev[m.id_murid], minat_kustom: e.target.value },
                                }))}
                                autoFocus
                                className="w-full px-3 py-2 rounded-lg text-sm border border-slate-300 dark:border-white/20 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400 transition"
                              />
                              <p className="text-xs text-slate-400 mt-0.5 text-right">{getMinatKustomText(m.id_murid).length}/50</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Catatan khusus + tombol simpan */}
                <div className="px-4 pb-4 flex flex-col sm:flex-row gap-3 items-start">
                  <div className="flex-1">
                    <label className="label-field text-xs">📝 Catatan Khusus (opsional)</label>
                    <textarea
                      id={`catatan-khusus-${m.id_murid}`}
                      rows={2}
                      placeholder="Kebutuhan belajar khusus, kondisi keluarga, atau hal penting lainnya..."
                      value={getVal(m.id_murid, 'catatan_khusus')}
                      onChange={e => setVal(m.id_murid, 'catatan_khusus', e.target.value)}
                      className="textarea-field text-sm mt-1"
                    />
                  </div>
                  <div className="self-end">
                    <button
                      id={`btn-save-nk-${m.id_murid}`}
                      onClick={() => handleSaveRow(m)}
                      disabled={isSaving}
                      className={`btn-sm-primary whitespace-nowrap ${isSaving ? 'opacity-60 cursor-wait' : ''}`}
                    >
                      {isSaving ? '⏳ Menyimpan...' : '💾 Simpan'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// TAB 3: Jurnal Formatif
// ──────────────────────────────────────────────────────────────────────────────

function TabFormatif({ user, filters }) {
  const [rows, setRows] = useState({});
  const [saving, setSaving] = useState({});
  const [toast, setToast] = useState(null);
  const [selectedTP, setSelectedTP] = useState('');
  const [newTP, setNewTP] = useState('');
  const [addingTP, setAddingTP] = useState(false);

  const tingkat = filters.rombel ? filters.rombel.replace(/[A-Z]$/, '').trim() : '';

  const swrKeyMurid = filters.rombel && filters.semester && filters.tahun_ajaran
    ? `enrollment_${filters.rombel}_${filters.semester}_${filters.tahun_ajaran}`
    : null;

  const { data: muridList = [] } = useSWR(swrKeyMurid, async () => {
    const { data } = await supabase
      .from('enrollment_murid')
      .select('id_murid, nama_murid')
      .eq('rombel', filters.rombel)
      .eq('semester', filters.semester)
      .eq('tahun_ajaran', filters.tahun_ajaran)
      .order('nama_murid', { ascending: true });
    return data || [];
  });

  const swrKeyTP = filters.mata_pelajaran && tingkat && filters.tahun_ajaran
    ? `tp_${filters.mata_pelajaran}_${tingkat}_${filters.tahun_ajaran}`
    : null;

  const { data: tpList = [], mutate: mutateTP } = useSWR(swrKeyTP, async () => {
    const res = await fetch(`/api/asesmen/tp?mapel=${encodeURIComponent(filters.mata_pelajaran)}&tingkat_kelas=${encodeURIComponent(tingkat)}&tahun_ajaran=${filters.tahun_ajaran}`);
    return res.json();
  });

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAddTP = async () => {
    if (!newTP.trim()) return;
    setAddingTP(true);
    try {
      const res = await fetch('/api/asesmen/tp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mata_pelajaran: filters.mata_pelajaran,
          tingkat_kelas: tingkat,
          tujuan: newTP,
          tahun_ajaran: filters.tahun_ajaran,
          dibuat_oleh: user.id_user,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNewTP('');
      setSelectedTP(data.tujuan);
      await mutateTP();
      showToast('Tujuan Pembelajaran baru ditambahkan.');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setAddingTP(false);
    }
  };

  const handleSaveFormatif = async (murid) => {
    const catatan = rows[murid.id_murid]?.catatan || '';
    if (!catatan.trim()) {
      showToast('Catatan observasi tidak boleh kosong.', 'error');
      return;
    }
    setSaving(prev => ({ ...prev, [murid.id_murid]: true }));
    try {
      const res = await fetch('/api/asesmen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_guru: user.id_user,
          id_murid: murid.id_murid,
          nama_murid: murid.nama_murid,
          rombel: filters.rombel,
          tahun_ajaran: filters.tahun_ajaran,
          semester: filters.semester,
          jenis: 'formatif',
          mata_pelajaran: filters.mata_pelajaran,
          tujuan_pembelajaran: selectedTP || null,
          catatan_guru: catatan,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setRows(prev => ({ ...prev, [murid.id_murid]: { catatan: '' } }));
      showToast(`Catatan ${murid.nama_murid} berhasil disimpan.`);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(prev => ({ ...prev, [murid.id_murid]: false }));
    }
  };

  return (
    <div>
      <SectionHeader
        title="Jurnal Formatif"
        subtitle="Catatan observasi harian untuk setiap murid. Tambahkan kapan saja selama semester berjalan."
      />
      {toast && (
        <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${toast.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
          {toast.msg}
        </div>
      )}

      {/* TP Selector */}
      <div className="mb-5 p-4 bg-amber-50 dark:bg-amber-500/10 rounded-xl border border-amber-200 dark:border-amber-500/20">
        <label className="label-field text-amber-700 dark:text-amber-300">Tujuan Pembelajaran (TP) — opsional</label>
        <div className="flex gap-2 flex-wrap">
          <select
            id="select-tp-formatif"
            value={selectedTP}
            onChange={e => setSelectedTP(e.target.value)}
            className="select-field flex-1 min-w-[200px]"
          >
            <option value="">-- Pilih TP yang relevan --</option>
            {tpList.map(tp => <option key={tp.id} value={tp.tujuan}>{tp.tujuan}</option>)}
          </select>
          <input
            id="input-tp-baru"
            type="text"
            placeholder="＋ Tambah TP baru..."
            value={newTP}
            onChange={e => setNewTP(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddTP()}
            className="select-field flex-1 min-w-[200px]"
          />
          <button
            id="btn-add-tp"
            onClick={handleAddTP}
            disabled={addingTP || !newTP.trim()}
            className="btn-sm-primary"
          >
            {addingTP ? '...' : '＋ Simpan TP'}
          </button>
        </div>
      </div>

      {/* Tabel Murid */}
      <div className="space-y-3">
        {muridList.map((m, i) => (
          <div key={m.id_murid} className="flex gap-3 items-start p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800/50">
            <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center text-xs font-bold text-emerald-700 dark:text-emerald-300 shrink-0 mt-1">
              {i + 1}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1.5 text-sm">{m.nama_murid}</p>
              <textarea
                id={`catatan-formatif-${m.id_murid}`}
                rows={2}
                placeholder="Tulis catatan observasi di sini..."
                value={rows[m.id_murid]?.catatan || ''}
                onChange={e => setRows(prev => ({ ...prev, [m.id_murid]: { catatan: e.target.value } }))}
                className="textarea-field w-full"
              />
            </div>
            <button
              id={`btn-save-formatif-${m.id_murid}`}
              onClick={() => handleSaveFormatif(m)}
              disabled={saving[m.id_murid]}
              className="btn-sm-primary shrink-0 mt-1"
            >
              {saving[m.id_murid] ? '...' : '💾'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
function TabSumatif({ user, filters }) {
  const [rows, setRows] = useState({});
  const [saving, setSaving] = useState({});
  const [toast, setToast] = useState(null);
  const [selectedTP, setSelectedTP] = useState('');

  const swrKeyMurid = filters.rombel && filters.semester && filters.tahun_ajaran
    ? `enrollment_${filters.rombel}_${filters.semester}_${filters.tahun_ajaran}`
    : null;

  const { data: muridList = [] } = useSWR(swrKeyMurid, async () => {
    const { data } = await supabase
      .from('enrollment_murid')
      .select('id_murid, nama_murid')
      .eq('rombel', filters.rombel)
      .eq('semester', filters.semester)
      .eq('tahun_ajaran', filters.tahun_ajaran)
      .order('nama_murid', { ascending: true });
    return data || [];
  });

  const tingkat = filters.rombel ? filters.rombel.replace(/[A-Z]$/, '').trim() : '';
  const swrKeyTP = filters.mata_pelajaran && tingkat && filters.tahun_ajaran
    ? `tp_${filters.mata_pelajaran}_${tingkat}_${filters.tahun_ajaran}`
    : null;

  const { data: tpList = [], isLoading: loadingTP } = useSWR(swrKeyTP, async () => {
    const res = await fetch(`/api/asesmen/tp?mapel=${encodeURIComponent(filters.mata_pelajaran)}&tingkat_kelas=${encodeURIComponent(tingkat)}&tahun_ajaran=${filters.tahun_ajaran}`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  });

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleSaveSkor = async (murid) => {
    const skor = rows[murid.id_murid]?.skor;
    if (skor === undefined || skor === '') {
      showToast('Isi skor terlebih dahulu.', 'error');
      return;
    }
    if (!selectedTP) {
      showToast('Pilih Tujuan Pembelajaran (TP) terlebih dahulu.', 'error');
      return;
    }
    
    setSaving(prev => ({ ...prev, [murid.id_murid]: true }));
    try {
      const selectedTPObj = tpList.find(t => t.id === selectedTP);
      const res = await fetch('/api/asesmen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_guru: user.id_user,
          id_murid: murid.id_murid,
          nama_murid: murid.nama_murid,
          rombel: filters.rombel,
          tahun_ajaran: filters.tahun_ajaran,
          semester: filters.semester,
          jenis: 'sumatif',
          mata_pelajaran: filters.mata_pelajaran,
          skor: parseFloat(skor),
          id_tp: selectedTP,
          tujuan_pembelajaran: selectedTPObj?.tujuan || null
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast(`Skor ${murid.nama_murid} berhasil disimpan.`);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(prev => ({ ...prev, [murid.id_murid]: false }));
    }
  };

  const needsFilter = !filters.rombel || !filters.mata_pelajaran;

  return (
    <div>
      <SectionHeader
        title="Nilai Sumatif"
        subtitle="Input nilai akhir sumatif per murid berdasarkan Tujuan Pembelajaran yang diujikan."
      />
      {toast && (
        <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${toast.type === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'}`}>
          {toast.msg}
        </div>
      )}

      {/* TP Selector */}
      <div className="mb-5 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-500/30">
        <label className="label-field text-blue-700 dark:text-blue-300">📌 Pilih Tujuan Pembelajaran (Wajib)</label>
        {loadingTP ? (
          <div className="flex items-center gap-2 text-blue-500 text-sm mt-1">
            <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
            <span>Memuat daftar TP...</span>
          </div>
        ) : tpList.length === 0 ? (
          <p className="text-sm text-slate-400 mt-1">
            {filters.mata_pelajaran
              ? 'Belum ada Tujuan Pembelajaran untuk mapel ini. Tambahkan via tab Formatif.'
              : 'Pilih Mata Pelajaran di filter terlebih dahulu.'}
          </p>
        ) : (
          <select
            id="select-tp-sumatif"
            value={selectedTP}
            onChange={e => setSelectedTP(e.target.value)}
            className="select-field w-full mt-1"
          >
            <option value="">-- Pilih Tujuan Pembelajaran --</option>
            {tpList.map(tp => <option key={tp.id} value={tp.id}>{tp.tujuan}</option>)}
          </select>
        )}
      </div>

      {needsFilter ? (
        <div className="text-center py-12 text-slate-400 dark:text-slate-500">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
          <p>Isi Rombel dan Mata Pelajaran di filter untuk memuat daftar murid.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {muridList.map((m, i) => (
            <div key={m.id_murid} className="p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800/50 hover:shadow-sm transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">{i + 1}.</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{m.nama_murid}</span>
                </div>
                <div className="flex gap-2">
                  <input
                    id={`skor-${m.id_murid}`}
                    type="number"
                    min="0"
                    max="100"
                    placeholder="Skor"
                    value={rows[m.id_murid]?.skor ?? ''}
                    onChange={e => setRows(prev => ({ ...prev, [m.id_murid]: { ...prev[m.id_murid], skor: e.target.value } }))}
                    className="w-20 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-700 text-sm text-center focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                  <button
                    id={`btn-save-skor-${m.id_murid}`}
                    onClick={() => handleSaveSkor(m)}
                    disabled={saving[m.id_murid] || !selectedTP}
                    className="btn-sm-primary"
                  >
                    {saving[m.id_murid] ? '...' : '💾 Simpan'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// TAB 5: Perkembangan Saya (Murid — Read-Only)
// ──────────────────────────────────────────────────────────────────────────────

function TabPerkembanganMurid({ user }) {
  const { data: asesmenList = [], isLoading } = useSWR(
    user ? `asesmen_murid_${user.id_user}` : null,
    async () => {
      const res = await fetch(`/api/asesmen?id_murid=${user.id_user}`);
      return res.json();
    }
  );

  // Kelompokkan per semester
  const grouped = asesmenList.reduce((acc, item) => {
    const key = `${item.tahun_ajaran} — Semester ${item.semester}`;
    if (!acc[key]) acc[key] = { sumatif: [], formatif: [] };
    if (item.jenis === 'sumatif' && item.narasi_rapor) acc[key].sumatif.push(item);
    if (item.jenis === 'formatif' && item.catatan_guru) acc[key].formatif.push(item);
    return acc;
  }, {});

  return (
    <div>
      <SectionHeader
        title="📈 Perkembangan Belajarku"
        subtitle="Rekam jejak perkembangan akademikmu dari setiap semester. Hanya kamu yang bisa melihat ini."
      />
      {isLoading ? (
        <div className="flex items-center gap-2 text-slate-400 py-8"><div className="w-5 h-5 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" /></div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-4xl mb-3">📚</p>
          <p>Belum ada data perkembangan untuk ditampilkan.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([period, data]) => (
            <div key={period}>
              <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                {period}
              </h3>
              {data.sumatif.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Narasi Rapor</p>
                  {data.sumatif.map(s => (
                    <div key={s.id} className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-500/10 dark:to-teal-500/10 rounded-xl border border-emerald-200 dark:border-emerald-500/20 mb-2">
                      <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1">{s.mata_pelajaran}</p>
                      <p className="text-slate-700 dark:text-slate-200 text-sm leading-relaxed">{s.narasi_rapor}</p>
                    </div>
                  ))}
                </div>
              )}
              {data.formatif.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Catatan Guru</p>
                  <div className="space-y-2">
                    {data.formatif.slice(0, 5).map(f => (
                      <div key={f.id} className="flex gap-3 p-3 bg-white dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-white/10">
                        <div className="w-1 rounded-full bg-sky-400 shrink-0" />
                        <div>
                          <p className="text-xs text-slate-400 mb-0.5">{f.mata_pelajaran} · {f.tanggal}</p>
                          <p className="text-sm text-slate-600 dark:text-slate-300">{f.catatan_guru}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// KOMPONEN UTAMA: AsesmenPage
// ──────────────────────────────────────────────────────────────────────────────

export default function AsesmenPage() {
  const { user } = useAuth();
  const isMurid = user?.role === 'Murid';
  const isWaliKelas = user?.role === 'Wali Kelas';
  const isGuru = user?.role === 'Guru Mapel' || isWaliKelas;

  // Tab aktif: default ke tab pertama yang sesuai role
  const [activeTab, setActiveTab] = useState(isMurid ? 'perkembangan' : 'diagnostik');

  const [filters, setFilters] = useState({
    tahun_ajaran: '',
    semester: '',
    rombel: '',
    mata_pelajaran: '',
    init: false
  });

  // Fetch Pengaturan Sekolah untuk default tahun dan semester
  const { data: pengaturan } = useSWR('pengaturan_sekolah', async () => {
    const { data } = await supabase.from('pengaturan_sekolah').select('tahun_ajaran, semester').limit(1).maybeSingle();
    return data;
  });

  // Fetch Master Data untuk dropdown rombel dan mata pelajaran
  const { data: masterData } = useSWR('master_asesmen', async () => {
    const [mapelRes, rombelRes] = await Promise.all([
      supabase.from('master_mapel').select('nama_mapel').order('nama_mapel'),
      supabase.from('master_user').select('rombel').eq('role', 'Murid'),
    ]);
    const uniqueRombel = [...new Set((rombelRes.data || []).map(d => d.rombel).filter(Boolean))].sort();
    return { 
      mapel: (mapelRes.data || []).map(m => m.nama_mapel), 
      rombel: uniqueRombel 
    };
  });

  // Fetch jadwal guru mapel untuk filter rombel dan mapel yang diajar
  const { data: jadwalGuru } = useSWR(user?.role === 'Guru Mapel' ? `jadwal_guru_asesmen_${user.id_user}` : null, async () => {
    const { data } = await supabase.from('jadwal_pelajaran').select('rombel, mata_pelajaran').eq('id_guru', user.id_user);
    const uniqueRombel = [...new Set((data || []).map(d => d.rombel).filter(Boolean))].sort();
    const uniqueMapel = [...new Set((data || []).map(d => d.mata_pelajaran).filter(Boolean))].sort();
    return { rombel: uniqueRombel, mapel: uniqueMapel };
  });

  useEffect(() => {
    if (pengaturan && !filters.init) {
      setFilters(prev => ({
        ...prev,
        tahun_ajaran: pengaturan.tahun_ajaran || '2026/2027',
        semester: pengaturan.semester || 'Ganjil',
        init: true
      }));
    }
  }, [pengaturan, filters.init]);

  // Siapkan options dropdown
  let mapelOptions = masterData?.mapel || [];
  let rombelOptions = masterData?.rombel || [];

  // Filter mapel dan rombel untuk guru mapel berdasarkan jadwal_pelajaran
  if (user?.role === 'Guru Mapel') {
    if (jadwalGuru) {
      // Filter Rombel
      const guruRombelStripped = jadwalGuru.rombel.map(r => r.replace(/^Kelas\s+/i, ''));
      const filteredRombel = (masterData?.rombel || []).filter(opt => guruRombelStripped.includes(opt.replace(/^Kelas\s+/i, '')));
      rombelOptions = filteredRombel.length > 0 ? filteredRombel : jadwalGuru.rombel.map(r => r.toLowerCase().startsWith('kelas') ? r : `Kelas ${r}`);
      
      // Filter Mapel
      mapelOptions = jadwalGuru.mapel;
    } else {
      rombelOptions = [];
      mapelOptions = [];
    }
  }
  
  // Filter rombel untuk wali kelas
  if (isWaliKelas && user?.rombel && user.rombel !== '-') {
    rombelOptions = [user.rombel];
  }

  const handleFilterChange = useCallback((key, val) => {
    setFilters(prev => ({ ...prev, [key]: val }));
  }, []);

  if (!user) return null;

  // Tab config berdasarkan role
  const tabs = [
    ...(isGuru ? [
      { id: 'diagnostik', label: '📋 Diagnostik' },
      ...(isWaliKelas ? [{ id: 'profil-nk', label: '🧠 Profil Murid' }] : []),
      { id: 'formatif', label: '📝 Jurnal Formatif' },
      { id: 'sumatif', label: 'Sumatif' },
    ] : []),
    ...(isMurid ? [{ id: 'perkembangan', label: '📈 Perkembangan Saya' }] : []),
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white leading-tight">
            {isMurid ? '📈 Perkembangan Belajarku' : 'Modul Asesmen'}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1">
            {isMurid
              ? 'Lihat rekam jejak perkembanganmu dari catatan gurumu.'
              : 'Kelola asesmen Kurikulum Merdeka: diagnostik, formatif, dan sumatif.'}
          </p>
        </div>
      </div>

      {/* Filter Bar (hanya untuk guru) */}
      {isGuru && (
        <FilterBar 
          filters={filters} 
          onChange={handleFilterChange} 
          mapelOptions={mapelOptions}
          rombelOptions={rombelOptions}
        />
      )}

      {/* Tab Navigation */}
      {tabs.length > 1 && (
        <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-x-auto scrollbar-none -mx-1 px-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-max px-2.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Tab Content */}
      <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-white/10 p-3 sm:p-5 shadow-sm">
        {activeTab === 'diagnostik' && isGuru && <TabDiagnostik user={user} filters={filters} />}
        {activeTab === 'profil-nk' && isWaliKelas && <TabProfilNK user={user} filters={filters} />}
        {activeTab === 'formatif' && isGuru && <TabFormatif user={user} filters={filters} />}
        {activeTab === 'sumatif' && isGuru && <TabSumatif user={user} filters={filters} />}
        {activeTab === 'perkembangan' && isMurid && <TabPerkembanganMurid user={user} />}
      </div>

      {/* CSS Inline untuk class utilitas lokal */}
      <style jsx global>{`
        .select-field {
          @apply px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-400 transition-all;
        }
        .textarea-field {
          @apply w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-400 transition-all;
        }
        .label-field {
          @apply block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1;
        }
        .btn-primary {
          @apply flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-emerald-500/40;
        }
        .btn-sm-primary {
          @apply flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed;
        }
        .btn-sm-secondary {
          @apply flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 text-xs font-medium transition-all;
        }
        .scrollbar-none {
          scrollbar-width: none;
        }
        .scrollbar-none::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
