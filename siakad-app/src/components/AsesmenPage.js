'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import useSWR from 'swr';
import { supabase } from '@/lib/supabase';

// ──────────────────────────────────────────────────────────────────────────────
// Sub-komponen & Helpers
// ──────────────────────────────────────────────────────────────────────────────

const KOGNITIF_OPTIONS = ['Mahir', 'Berkembang', 'Butuh Pendampingan'];
const GAYA_BELAJAR_OPTIONS = ['Visual', 'Auditori', 'Kinestetik', 'Campuran'];
const BADGE_GAYA = {
  Visual: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
  Auditori: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300',
  Kinestetik: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300',
  Campuran: 'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300',
};
const STATUS_BADGE = {
  Belum: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400',
  Generating: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 animate-pulse',
  Draft: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300',
  Tersimpan: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
};

function SectionHeader({ title, subtitle }) {
  return (
    <div className="mb-6">
      <h2 className="text-xl font-bold text-slate-800 dark:text-white">{title}</h2>
      {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
  );
}

function FilterBar({ filters, onChange, mapelOptions = [], rombelOptions = [] }) {
  return (
    <div className="flex flex-wrap gap-3 mb-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-white/10">
      <select
        id="filter-tahun-ajaran"
        value={filters.tahun_ajaran}
        onChange={e => onChange('tahun_ajaran', e.target.value)}
        className="select-field"
      >
        <option value="2026/2027">2026/2027</option>
        <option value="2025/2026">2025/2026</option>
      </select>
      <select
        id="filter-semester"
        value={filters.semester}
        onChange={e => onChange('semester', e.target.value)}
        className="select-field"
      >
        <option value="Ganjil">Ganjil</option>
        <option value="Genap">Genap</option>
      </select>
      {filters.rombel !== undefined && (
        <select
          id="filter-rombel"
          value={filters.rombel}
          onChange={e => onChange('rombel', e.target.value)}
          className="select-field"
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
          className="select-field"
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

// ──────────────────────────────────────────────────────────────────────────────
// TAB 1: Diagnostik Kognitif (Guru Mapel)
// ──────────────────────────────────────────────────────────────────────────────

function TabDiagnostik({ user, filters }) {
  const [rows, setRows] = useState({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  // SWR: cache murid per rombel+semester+tahun_ajaran
  const swrKeyMurid = filters.rombel && filters.semester && filters.tahun_ajaran
    ? `enrollment_${filters.rombel}_${filters.semester}_${filters.tahun_ajaran}`
    : null;

  const { data: muridList = [], isLoading: loadingMurid } = useSWR(swrKeyMurid, async () => {
    const res = await fetch(
      `/api/asesmen?rombel=${filters.rombel}&semester=${filters.semester}&tahun_ajaran=${filters.tahun_ajaran}&jenis=awal&mapel=${encodeURIComponent(filters.mata_pelajaran || '')}&id_guru=${user.id_user}`
    );
    const existing = await res.json();

    // Ambil enrollment murid
    const { data: enrolled } = await supabase
      .from('enrollment_murid')
      .select('id_murid, nama_murid')
      .eq('rombel', filters.rombel)
      .eq('semester', filters.semester)
      .eq('tahun_ajaran', filters.tahun_ajaran);

    return (enrolled || []).map(m => ({
      ...m,
      existing: existing.find(e => e.id_murid === m.id_murid),
    }));
  });

  // SWR: cache profil non-kognitif per rombel+tahun_ajaran
  const swrKeyProfil = filters.rombel && filters.tahun_ajaran
    ? `profil_nk_${filters.rombel}_${filters.tahun_ajaran}`
    : null;

  const { data: profilMap = {} } = useSWR(swrKeyProfil, async () => {
    const res = await fetch(`/api/asesmen/profil-nk?rombel=${filters.rombel}&tahun_ajaran=${filters.tahun_ajaran}`);
    const data = await res.json();
    return Object.fromEntries((data || []).map(p => [p.id_murid, p]));
  });

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSaveAll = async () => {
    if (!filters.rombel || !filters.mata_pelajaran) {
      showToast('Isi Rombel dan Mata Pelajaran terlebih dahulu.', 'error');
      return;
    }
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
        }));

      if (records.length === 0) {
        showToast('Belum ada data kognitif yang diisi.', 'error');
        setSaving(false);
        return;
      }

      const res = await fetch('/api/asesmen/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast(`${data.inserted} data diagnostik berhasil disimpan!`);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <SectionHeader
        title="Diagnostik Kognitif"
        subtitle="Pemetaan kemampuan awal murid di awal semester. Input sekali per murid per mata pelajaran."
      />
      {toast && (
        <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${toast.type === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'}`}>
          {toast.msg}
        </div>
      )}
      {!filters.rombel ? (
        <div className="text-center py-12 text-slate-400 dark:text-slate-500">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
          <p>Isi Rombel dan Mata Pelajaran di filter untuk memuat daftar murid.</p>
        </div>
      ) : loadingMurid ? (
        <div className="flex items-center gap-2 text-slate-400 py-8"><div className="w-5 h-5 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" /><span>Memuat daftar murid...</span></div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/80">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 w-8">#</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Nama Murid</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Profil Belajar</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Hasil Kognitif</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {muridList.map((m, i) => {
                  const profil = profilMap[m.id_murid];
                  const current = rows[m.id_murid]?.hasil_kognitif || m.existing?.hasil_kognitif || '';
                  return (
                    <tr key={m.id_murid} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 text-slate-400">{i + 1}</td>
                      <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-200">{m.nama_murid}</td>
                      <td className="px-4 py-3">
                        {profil?.gaya_belajar ? (
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${BADGE_GAYA[profil.gaya_belajar] || 'bg-slate-100 text-slate-600'}`}>
                            {profil.gaya_belajar}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Belum diisi</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          id={`kognitif-${m.id_murid}`}
                          value={current}
                          onChange={e => setRows(prev => ({ ...prev, [m.id_murid]: { ...prev[m.id_murid], hasil_kognitif: e.target.value } }))}
                          className="select-field text-sm w-full max-w-[220px]"
                        >
                          <option value="">-- Pilih --</option>
                          {KOGNITIF_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              id="btn-simpan-diagnostik"
              onClick={handleSaveAll}
              disabled={saving}
              className="btn-primary"
            >
              {saving ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>Menyimpan...</span></> : '💾 Simpan Semua'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// TAB 2: Profil Non-Kognitif (Wali Kelas Eksklusif)
// ──────────────────────────────────────────────────────────────────────────────

function TabProfilNK({ user, filters }) {
  const [rows, setRows] = useState({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const swrKey = filters.rombel && filters.tahun_ajaran
    ? `profil_nk_${filters.rombel}_${filters.tahun_ajaran}`
    : null;

  const { data: muridList = [], isLoading } = useSWR(swrKey, async () => {
    const { data: enrolled } = await supabase
      .from('enrollment_murid')
      .select('id_murid, nama_murid')
      .eq('rombel', filters.rombel)
      .eq('tahun_ajaran', filters.tahun_ajaran)
      .eq('semester', filters.semester);

    const res = await fetch(`/api/asesmen/profil-nk?rombel=${filters.rombel}&tahun_ajaran=${filters.tahun_ajaran}`);
    const profilData = await res.json();
    const profilMap = Object.fromEntries((profilData || []).map(p => [p.id_murid, p]));

    return (enrolled || []).map(m => ({ ...m, profil: profilMap[m.id_murid] }));
  });

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSaveRow = async (murid) => {
    const rowData = rows[murid.id_murid] || {};
    const payload = {
      id_murid: murid.id_murid,
      id_wali_kelas: user.id_user,
      rombel: filters.rombel,
      tahun_ajaran: filters.tahun_ajaran,
      gaya_belajar: rowData.gaya_belajar || murid.profil?.gaya_belajar || null,
      catatan_emosional: rowData.catatan_emosional ?? murid.profil?.catatan_emosional ?? '',
      catatan_khusus: rowData.catatan_khusus ?? murid.profil?.catatan_khusus ?? '',
    };
    try {
      const res = await fetch('/api/asesmen/profil-nk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast(`Profil ${murid.nama_murid} berhasil disimpan.`);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div>
      <SectionHeader
        title="Profil Non-Kognitif Murid"
        subtitle="Diisi SEKALI per tahun di awal tahun ajaran. Guru mapel hanya melihat hasilnya sebagai badge."
      />
      {toast && (
        <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${toast.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
          {toast.msg}
        </div>
      )}
      {!filters.rombel ? (
        <p className="text-slate-400 text-sm">Isi Rombel di filter untuk memuat daftar murid.</p>
      ) : isLoading ? (
        <div className="flex items-center gap-2 text-slate-400 py-8"><div className="w-5 h-5 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" /><span>Memuat...</span></div>
      ) : (
        <div className="space-y-4">
          {muridList.map((m, i) => {
            const r = rows[m.id_murid] || {};
            return (
              <div key={m.id_murid} className="p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800/50 hover:shadow-sm transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-xs text-slate-400 mr-2">{i + 1}.</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{m.nama_murid}</span>
                    {m.profil?.gaya_belajar && (
                      <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${BADGE_GAYA[m.profil.gaya_belajar]}`}>
                        {m.profil.gaya_belajar}
                      </span>
                    )}
                  </div>
                  <button
                    id={`btn-save-nk-${m.id_murid}`}
                    onClick={() => handleSaveRow(m)}
                    className="btn-sm-primary"
                  >
                    💾 Simpan
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="label-field">Gaya Belajar</label>
                    <select
                      id={`gaya-${m.id_murid}`}
                      value={r.gaya_belajar ?? m.profil?.gaya_belajar ?? ''}
                      onChange={e => setRows(prev => ({ ...prev, [m.id_murid]: { ...prev[m.id_murid], gaya_belajar: e.target.value } }))}
                      className="select-field"
                    >
                      <option value="">-- Pilih --</option>
                      {GAYA_BELAJAR_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label-field">Catatan Emosional</label>
                    <textarea
                      id={`emosi-${m.id_murid}`}
                      rows={2}
                      placeholder="Observasi sosial-emosional..."
                      value={r.catatan_emosional ?? m.profil?.catatan_emosional ?? ''}
                      onChange={e => setRows(prev => ({ ...prev, [m.id_murid]: { ...prev[m.id_murid], catatan_emosional: e.target.value } }))}
                      className="textarea-field"
                    />
                  </div>
                  <div>
                    <label className="label-field">Catatan Khusus</label>
                    <textarea
                      id={`khusus-${m.id_murid}`}
                      rows={2}
                      placeholder="Kebutuhan belajar khusus..."
                      value={r.catatan_khusus ?? m.profil?.catatan_khusus ?? ''}
                      onChange={e => setRows(prev => ({ ...prev, [m.id_murid]: { ...prev[m.id_murid], catatan_khusus: e.target.value } }))}
                      className="textarea-field"
                    />
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
      .eq('tahun_ajaran', filters.tahun_ajaran);
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
// TAB 4: Sumatif + Generator AI
// ──────────────────────────────────────────────────────────────────────────────

function TabSumatif({ user, filters }) {
  const [rows, setRows] = useState({});
  const [narasi, setNarasi] = useState({});
  const [status, setStatus] = useState({}); // 'Belum'|'Generating'|'Draft'|'Tersimpan'
  const [saving, setSaving] = useState({});
  const [generateAllRunning, setGenerateAllRunning] = useState(false);
  const [generateProgress, setGenerateProgress] = useState({ current: 0, total: 0 });
  const [toast, setToast] = useState(null);

  const swrKeyMurid = filters.rombel && filters.semester && filters.tahun_ajaran
    ? `enrollment_${filters.rombel}_${filters.semester}_${filters.tahun_ajaran}`
    : null;

  const { data: muridList = [] } = useSWR(swrKeyMurid, async () => {
    const { data } = await supabase
      .from('enrollment_murid')
      .select('id_murid, nama_murid')
      .eq('rombel', filters.rombel)
      .eq('semester', filters.semester)
      .eq('tahun_ajaran', filters.tahun_ajaran);
    return data || [];
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
          jenis: 'sumatif',
          mata_pelajaran: filters.mata_pelajaran,
          skor: parseFloat(skor),
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

  /** Generate narasi untuk 1 murid */
  const generateSatu = async (murid) => {
    setStatus(prev => ({ ...prev, [murid.id_murid]: 'Generating' }));
    try {
      const res = await fetch('/api/asesmen/generate-rapor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_murid: murid.id_murid,
          nama_murid: murid.nama_murid,
          rombel: filters.rombel,
          mata_pelajaran: filters.mata_pelajaran,
          semester: filters.semester,
          tahun_ajaran: filters.tahun_ajaran,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNarasi(prev => ({ ...prev, [murid.id_murid]: data.narasi }));
      setStatus(prev => ({ ...prev, [murid.id_murid]: 'Draft' }));
    } catch (err) {
      showToast(`${murid.nama_murid}: ${err.message}`, 'error');
      setStatus(prev => ({ ...prev, [murid.id_murid]: 'Belum' }));
    }
  };

  /**
   * Generate semua murid secara SEKUENSIAL (for...of + await)
   * BUKAN Promise.all() — untuk menghindari timeout Vercel 15 detik
   */
  const handleGenerateAll = async () => {
    setGenerateAllRunning(true);
    setGenerateProgress({ current: 0, total: muridList.length });
    for (let i = 0; i < muridList.length; i++) {
      setGenerateProgress({ current: i + 1, total: muridList.length });
      await generateSatu(muridList[i]);
    }
    setGenerateAllRunning(false);
    showToast(`Narasi untuk ${muridList.length} murid berhasil di-generate!`);
  };

  const handleSaveNarasi = async (murid) => {
    const narasiText = narasi[murid.id_murid];
    if (!narasiText) return;
    setSaving(prev => ({ ...prev, [`narasi_${murid.id_murid}`]: true }));
    try {
      // Ambil ID asesmen sumatif murid ini (ambil yang terbaru)
      const { data: existing } = await supabase
        .from('asesmen')
        .select('id')
        .eq('id_murid', murid.id_murid)
        .eq('jenis', 'sumatif')
        .eq('semester', filters.semester)
        .eq('mata_pelajaran', filters.mata_pelajaran)
        .eq('tahun_ajaran', filters.tahun_ajaran)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (existing) {
        const res = await fetch(`/api/asesmen?id=${existing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ narasi_rapor: narasiText }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
      }
      setStatus(prev => ({ ...prev, [murid.id_murid]: 'Tersimpan' }));
      showToast(`Narasi ${murid.nama_murid} berhasil disimpan ke database.`);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(prev => ({ ...prev, [`narasi_${murid.id_murid}`]: false }));
    }
  };

  const handleCopy = (murid) => {
    navigator.clipboard.writeText(narasi[murid.id_murid] || '');
    showToast(`Narasi ${murid.nama_murid} disalin ke clipboard!`);
  };

  return (
    <div>
      <SectionHeader
        title="Nilai Sumatif & Narasi Rapor AI ✨"
        subtitle="Input nilai akhir per murid. Generate narasi rapor berbasis AI dari semua TP yang dipelajari semester ini."
      />
      {toast && (
        <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${toast.type === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'}`}>
          {toast.msg}
        </div>
      )}

      {/* Tombol Generate Semua */}
      {muridList.length > 0 && (
        <div className="mb-5 flex items-center justify-between p-4 bg-gradient-to-r from-violet-50 to-fuchsia-50 dark:from-violet-500/10 dark:to-fuchsia-500/10 rounded-xl border border-violet-200 dark:border-violet-500/20">
          <div>
            <p className="font-semibold text-violet-800 dark:text-violet-200 text-sm">⚡ Generate Semua Sekaligus</p>
            {generateAllRunning && (
              <p className="text-xs text-violet-600 dark:text-violet-400 mt-0.5">
                Memproses {generateProgress.current}/{generateProgress.total} murid...
              </p>
            )}
          </div>
          <button
            id="btn-generate-all"
            onClick={handleGenerateAll}
            disabled={generateAllRunning}
            className="btn-primary bg-violet-600 hover:bg-violet-700 focus:ring-violet-500"
          >
            {generateAllRunning ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>{generateProgress.current}/{generateProgress.total}</span></>
            ) : `✨ Generate ${muridList.length} Murid`}
          </button>
        </div>
      )}

      <div className="space-y-4">
        {muridList.map((m, i) => {
          const st = status[m.id_murid] || 'Belum';
          const narasiText = narasi[m.id_murid] || '';
          return (
            <div key={m.id_murid} className="p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800/50 hover:shadow-sm transition-shadow">
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">{i + 1}.</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{m.nama_murid}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[st === 'Generating' ? 'Generating' : st]}`}>
                    {st === 'Generating' ? '⏳ Generating...' : st}
                  </span>
                </div>
                <div className="flex gap-2">
                  {/* Input Skor */}
                  <input
                    id={`skor-${m.id_murid}`}
                    type="number"
                    min="0"
                    max="100"
                    placeholder="Skor"
                    value={rows[m.id_murid]?.skor ?? ''}
                    onChange={e => setRows(prev => ({ ...prev, [m.id_murid]: { ...prev[m.id_murid], skor: e.target.value } }))}
                    className="w-20 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-700 text-sm text-center"
                  />
                  <button
                    id={`btn-save-skor-${m.id_murid}`}
                    onClick={() => handleSaveSkor(m)}
                    disabled={saving[m.id_murid]}
                    className="btn-sm-primary"
                  >
                    {saving[m.id_murid] ? '...' : '💾'}
                  </button>
                  <button
                    id={`btn-generate-${m.id_murid}`}
                    onClick={() => generateSatu(m)}
                    disabled={st === 'Generating'}
                    className="btn-sm-primary bg-violet-600 hover:bg-violet-700"
                  >
                    ✨ Generate
                  </button>
                </div>
              </div>

              {/* Narasi Area */}
              {(narasiText || st === 'Generating') && (
                <div className="mt-3">
                  <textarea
                    id={`narasi-${m.id_murid}`}
                    rows={4}
                    placeholder="Narasi akan muncul di sini setelah generate..."
                    value={narasiText}
                    onChange={e => {
                      setNarasi(prev => ({ ...prev, [m.id_murid]: e.target.value }));
                      setStatus(prev => ({ ...prev, [m.id_murid]: 'Draft' }));
                    }}
                    className="textarea-field w-full"
                  />
                  <div className="flex gap-2 mt-2 justify-end">
                    <button
                      id={`btn-copy-${m.id_murid}`}
                      onClick={() => handleCopy(m)}
                      className="btn-sm-secondary"
                    >
                      📋 Salin
                    </button>
                    <button
                      id={`btn-save-narasi-${m.id_murid}`}
                      onClick={() => handleSaveNarasi(m)}
                      disabled={saving[`narasi_${m.id_murid}`]}
                      className="btn-sm-primary"
                    >
                      {saving[`narasi_${m.id_murid}`] ? '...' : '💾 Simpan Narasi'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
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
      { id: 'sumatif', label: '✨ Sumatif & Rapor AI' },
    ] : []),
    ...(isMurid ? [{ id: 'perkembangan', label: '📈 Perkembangan Saya' }] : []),
  ];

  return (
    <div className="space-y-6">
      {/* Header Halaman */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
            {isMurid ? '📈 Perkembangan Belajarku' : '📋 Modul Asesmen'}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            {isMurid
              ? 'Lihat rekam jejak perkembanganmu dari catatan gurumu.'
              : 'Kelola asesmen Kurikulum Merdeka: diagnostik, formatif, sumatif, dan narasi rapor AI.'}
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
        <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-max px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
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
      <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-white/10 p-5 shadow-sm">
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
          @apply px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-400 transition-all;
        }
        .label-field {
          @apply block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1;
        }
        .btn-primary {
          @apply flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-emerald-500/40;
        }
        .btn-sm-primary {
          @apply flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed;
        }
        .btn-sm-secondary {
          @apply flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 text-xs font-medium transition-all;
        }
      `}</style>
    </div>
  );
}
