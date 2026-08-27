'use client';
import { useState, useEffect } from 'react';
import useSWR from 'swr';

const FASE_OPTIONS    = ['A', 'B', 'C'];
const DIMENSI_OPTIONS = ['literasi', 'numerasi', 'reasoning'];
const TIPE_OPTIONS    = ['emoji', 'dropdown', 'fill'];

const FASE_LABEL = { A: 'Fase A (Kelas 1–2)', B: 'Fase B (Kelas 3–4)', C: 'Fase C (Kelas 5–6)' };
const DIMENSI_ICON = { literasi: '📖', numerasi: '🔢', reasoning: '🧩' };

const EMPTY_FORM = {
  fase: 'A', dimensi: 'literasi', tipe_jawaban: 'emoji',
  teks_pertanyaan: '', opsi_jawaban: [], jawaban_benar: '', urutan: 0,
};

function OpsiEmojiBuilder({ opsi, onChange }) {
  const tambah = () => onChange([...opsi, { label: '', emoji: '', is_correct: false }]);
  const ubah   = (i, field, val) => {
    const baru = [...opsi];
    baru[i] = { ...baru[i], [field]: val };
    // Hanya 1 yang bisa benar
    if (field === 'is_correct' && val === true) baru.forEach((o, j) => { if (j !== i) baru[j].is_correct = false; });
    onChange(baru);
  };
  const hapus  = (i) => onChange(opsi.filter((_, j) => j !== i));

  return (
    <div className="space-y-2">
      {opsi.map((o, i) => (
        <div key={i} className="flex items-center gap-2">
          <input placeholder="🍎" value={o.emoji} onChange={e => ubah(i, 'emoji', e.target.value)}
            className="w-16 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-center text-xl" />
          <input placeholder="Label (misal: Apel)" value={o.label} onChange={e => ubah(i, 'label', e.target.value)}
            className="flex-1 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-sm" />
          <label className="flex items-center gap-1 text-xs text-slate-500 whitespace-nowrap cursor-pointer">
            <input type="checkbox" checked={o.is_correct} onChange={e => ubah(i, 'is_correct', e.target.checked)} />
            Benar
          </label>
          <button type="button" onClick={() => hapus(i)} className="text-red-400 hover:text-red-600 text-sm">✕</button>
        </div>
      ))}
      <button type="button" onClick={tambah}
        className="w-full py-2 rounded-lg border-2 border-dashed border-slate-300 dark:border-white/20 text-slate-400 hover:text-slate-600 hover:border-slate-400 text-sm transition-colors">
        + Tambah Opsi
      </button>
    </div>
  );
}

function OpsiDropdownBuilder({ opsi, onChange }) {
  const tambah = () => onChange([...opsi, { label: '', is_correct: false }]);
  const ubah   = (i, field, val) => {
    const baru = [...opsi];
    baru[i] = { ...baru[i], [field]: val };
    if (field === 'is_correct' && val === true) baru.forEach((o, j) => { if (j !== i) baru[j].is_correct = false; });
    onChange(baru);
  };
  const hapus  = (i) => onChange(opsi.filter((_, j) => j !== i));

  return (
    <div className="space-y-2">
      {opsi.map((o, i) => (
        <div key={i} className="flex items-center gap-2">
          <input placeholder="Opsi jawaban..." value={o.label} onChange={e => ubah(i, 'label', e.target.value)}
            className="flex-1 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-sm" />
          <label className="flex items-center gap-1 text-xs text-slate-500 whitespace-nowrap cursor-pointer">
            <input type="radio" name="dropdown-benar" checked={o.is_correct} onChange={() => ubah(i, 'is_correct', true)} />
            Benar
          </label>
          <button type="button" onClick={() => hapus(i)} className="text-red-400 hover:text-red-600 text-sm">✕</button>
        </div>
      ))}
      <button type="button" onClick={tambah}
        className="w-full py-2 rounded-lg border-2 border-dashed border-slate-300 dark:border-white/20 text-slate-400 hover:text-slate-600 hover:border-slate-400 text-sm transition-colors">
        + Tambah Opsi
      </button>
    </div>
  );
}

function PreviewSoal({ form }) {
  const speak = () => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(form.teks_pertanyaan);
    utt.lang = 'id-ID'; utt.rate = 0.85; utt.pitch = 1.15;
    window.speechSynthesis.speak(utt);
  };

  return (
    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10">
      <p className="text-xs font-semibold text-slate-400 uppercase mb-3">Preview Murid</p>
      <div className="flex items-start gap-3 mb-3">
        <button onClick={speak}
          className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-lg hover:bg-emerald-200 transition-colors shrink-0">
          🔊
        </button>
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200 flex-1 pt-1">
          {form.teks_pertanyaan || <span className="italic text-slate-400">Pertanyaan belum diisi...</span>}
        </p>
      </div>
      {form.tipe_jawaban === 'emoji' && (
        <div className="flex flex-wrap gap-2">
          {(form.opsi_jawaban || []).map((o, i) => (
            <div key={i} className="flex flex-col items-center gap-1 p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 min-w-[72px]">
              <span className="text-3xl">{o.emoji}</span>
              <span className="text-xs text-slate-500">{o.label}</span>
            </div>
          ))}
        </div>
      )}
      {form.tipe_jawaban === 'dropdown' && (
        <select className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-sm text-slate-500">
          <option>-- Pilih jawaban --</option>
          {(form.opsi_jawaban || []).map(o => <option key={o.label}>{o.label}</option>)}
        </select>
      )}
      {form.tipe_jawaban === 'fill' && (
        <input className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-sm text-slate-500"
          placeholder="Tulis jawaban kamu di sini..." disabled />
      )}
    </div>
  );
}

export default function BankSoalPage() {
  const [filterFase, setFilterFase]       = useState('A');
  const [filterDimensi, setFilterDimensi] = useState('');
  const [form, setForm]                   = useState(EMPTY_FORM);
  const [showForm, setShowForm]           = useState(false);
  const [editId, setEditId]               = useState(null);
  const [saving, setSaving]               = useState(false);
  const [toast, setToast]                 = useState(null);

  const swrKey = `bank-soal-${filterFase}-${filterDimensi}`;
  const { data: soalList = [], mutate } = useSWR(swrKey, async () => {
    let url = `/api/asesmen/bank-soal?fase=${filterFase}`;
    if (filterDimensi) url += `&dimensi=${filterDimensi}`;
    const res = await fetch(url);
    return res.json();
  });

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.teks_pertanyaan.trim()) return showToast('Pertanyaan wajib diisi.', 'error');
    setSaving(true);
    try {
      const payload = {
        ...form,
        opsi_jawaban: ['emoji', 'dropdown'].includes(form.tipe_jawaban) ? form.opsi_jawaban : null,
        jawaban_benar: form.tipe_jawaban === 'fill' ? form.jawaban_benar : null,
      };

      if (editId) {
        const res = await fetch(`/api/asesmen/bank-soal?id=${editId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        showToast('Soal berhasil diperbarui.');
      } else {
        const res = await fetch('/api/asesmen/bank-soal', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        showToast('Soal berhasil ditambahkan.');
      }
      setForm(EMPTY_FORM); setEditId(null); setShowForm(false);
      mutate();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleAktif = async (soal) => {
    const res = await fetch(`/api/asesmen/bank-soal?id=${soal.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aktif: !soal.aktif }),
    });
    if (res.ok) mutate();
  };

  const hapus = async (id) => {
    if (!confirm('Yakin hapus soal ini?')) return;
    const res = await fetch(`/api/asesmen/bank-soal?id=${id}`, { method: 'DELETE' });
    if (res.ok) { showToast('Soal dihapus.'); mutate(); }
  };

  const edit = (soal) => {
    setForm({ ...soal, opsi_jawaban: soal.opsi_jawaban || [] });
    setEditId(soal.id); setShowForm(true);
    setTimeout(() => document.getElementById('form-bank-soal')?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white">🗃️ Bank Soal Kognitif</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Kelola soal asesmen Literasi, Numerasi, dan Penalaran per Fase</p>
        </div>
        <button onClick={() => { setForm(EMPTY_FORM); setEditId(null); setShowForm(!showForm); }}
          className="btn-primary self-start sm:self-auto">
          {showForm ? '✕ Tutup Form' : '+ Tambah Soal Baru'}
        </button>
      </div>

      {toast && (
        <div className={`p-3 rounded-xl text-sm font-medium ${toast.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
          {toast.msg}
        </div>
      )}

      {/* Form Tambah/Edit */}
      {showForm && (
        <div id="form-bank-soal" className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 shadow-sm">
          <h2 className="font-semibold text-slate-700 dark:text-slate-200 mb-4">{editId ? '✏️ Edit Soal' : '➕ Tambah Soal Baru'}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label-field">Fase</label>
                <select value={form.fase} onChange={e => setForm(f => ({ ...f, fase: e.target.value }))}
                  className="select-field w-full mt-1">
                  {FASE_OPTIONS.map(f => <option key={f} value={f}>{f} — {f === 'A' ? 'Kls 1–2' : f === 'B' ? 'Kls 3–4' : 'Kls 5–6'}</option>)}
                </select>
              </div>
              <div>
                <label className="label-field">Dimensi</label>
                <select value={form.dimensi} onChange={e => setForm(f => ({ ...f, dimensi: e.target.value }))}
                  className="select-field w-full mt-1">
                  {DIMENSI_OPTIONS.map(d => <option key={d} value={d}>{DIMENSI_ICON[d]} {d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="label-field">Tipe Jawaban</label>
                <select value={form.tipe_jawaban} onChange={e => setForm(f => ({ ...f, tipe_jawaban: e.target.value, opsi_jawaban: [], jawaban_benar: '' }))}
                  className="select-field w-full mt-1">
                  <option value="emoji">🎨 Emoji (Fase A)</option>
                  <option value="dropdown">📋 Dropdown</option>
                  <option value="fill">✏️ Isian Teks</option>
                </select>
              </div>
            </div>

            <div>
              <label className="label-field">Teks Pertanyaan</label>
              <textarea rows={2} value={form.teks_pertanyaan}
                onChange={e => setForm(f => ({ ...f, teks_pertanyaan: e.target.value }))}
                placeholder="Tulis pertanyaan di sini... (akan dibacakan oleh audio)"
                className="textarea-field w-full mt-1" />
            </div>

            {form.tipe_jawaban === 'emoji' && (
              <div>
                <label className="label-field mb-2 block">Opsi Jawaban (Emoji)</label>
                <OpsiEmojiBuilder opsi={form.opsi_jawaban} onChange={opsi => setForm(f => ({ ...f, opsi_jawaban: opsi }))} />
              </div>
            )}
            {form.tipe_jawaban === 'dropdown' && (
              <div>
                <label className="label-field mb-2 block">Opsi Jawaban (Dropdown)</label>
                <OpsiDropdownBuilder opsi={form.opsi_jawaban} onChange={opsi => setForm(f => ({ ...f, opsi_jawaban: opsi }))} />
              </div>
            )}
            {form.tipe_jawaban === 'fill' && (
              <div>
                <label className="label-field">Jawaban Benar</label>
                <input type="text" value={form.jawaban_benar}
                  onChange={e => setForm(f => ({ ...f, jawaban_benar: e.target.value }))}
                  placeholder="Ketik jawaban yang benar..."
                  className="select-field w-full mt-1" />
              </div>
            )}

            <PreviewSoal form={form} />

            <div className="flex gap-3 justify-end pt-2">
              <button type="button" onClick={() => { setShowForm(false); setEditId(null); setForm(EMPTY_FORM); }}
                className="btn-sm-secondary">Batal</button>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? '...' : editId ? '💾 Simpan Perubahan' : '➕ Tambahkan Soal'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
          {FASE_OPTIONS.map(f => (
            <button key={f} onClick={() => setFilterFase(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${filterFase === f ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              Fase {f}
            </button>
          ))}
        </div>
        <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
          <button onClick={() => setFilterDimensi('')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${!filterDimensi ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            Semua
          </button>
          {DIMENSI_OPTIONS.map(d => (
            <button key={d} onClick={() => setFilterDimensi(d)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${filterDimensi === d ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {DIMENSI_ICON[d]} {d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-400 ml-auto">{soalList.length} soal</span>
      </div>

      {/* Tabel Soal */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/80">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 w-8">#</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Pertanyaan</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 hidden sm:table-cell">Dimensi</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 hidden sm:table-cell">Tipe</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Status</th>
              <th className="text-right px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {soalList.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400 text-sm">Belum ada soal untuk filter ini.</td></tr>
            )}
            {soalList.map((s, i) => (
              <tr key={s.id} className={`hover:bg-slate-50 dark:hover:bg-white/5 transition-colors ${!s.aktif ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3 text-slate-400">{i + 1}</td>
                <td className="px-4 py-3 text-slate-700 dark:text-slate-200 max-w-xs">
                  <p className="truncate">{s.teks_pertanyaan}</p>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                    {DIMENSI_ICON[s.dimensi]} {s.dimensi}
                  </span>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell text-slate-500 text-xs capitalize">{s.tipe_jawaban}</td>
                <td className="px-4 py-3">
                  <button onClick={() => toggleAktif(s)}
                    className={`px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer ${s.aktif ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>
                    {s.aktif ? '✓ Aktif' : 'Nonaktif'}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => edit(s)} className="btn-sm-secondary text-xs px-2 py-1">✏️</button>
                    <button onClick={() => hapus(s.id)} className="text-xs px-2 py-1 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">🗑️</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
