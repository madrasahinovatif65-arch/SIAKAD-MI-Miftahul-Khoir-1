'use client';

import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import useSWR from 'swr';

const HARI_OPTIONS = [
  { value: 1, label: 'Senin' },
  { value: 2, label: 'Selasa' },
  { value: 3, label: 'Rabu' },
  { value: 4, label: 'Kamis' },
  { value: 5, label: 'Jumat' },
  { value: 6, label: 'Sabtu' },
];

const HARI_LABEL = { 1: 'Senin', 2: 'Selasa', 3: 'Rabu', 4: 'Kamis', 5: 'Jumat', 6: 'Sabtu' };
const HARI_MAP  = { senin: 1, selasa: 2, rabu: 3, kamis: 4, jumat: 5, sabtu: 6 };

const HARI_COLOR = {
  1: 'from-emerald-500 to-teal-500',
  2: 'from-blue-500 to-indigo-500',
  3: 'from-violet-500 to-purple-500',
  4: 'from-amber-500 to-orange-500',
  5: 'from-rose-500 to-pink-500',
  6: 'from-cyan-500 to-sky-500',
};

// ─── XLSX helper ───────────────────────────────────────────────────────────────
function downloadXLSX(filename, headers, rows, sheetName = 'Jadwal') {
  const wb = XLSX.utils.book_new();
  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Bold header row
  const headerRange = XLSX.utils.decode_range(ws['!ref']);
  for (let c = headerRange.s.c; c <= headerRange.e.c; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
    if (cell) cell.s = { font: { bold: true } };
  }

  // Auto column width
  ws['!cols'] = headers.map((h, i) => ({
    wch: Math.max(
      h.length,
      ...rows.map(r => String(r[i] ?? '').length)
    ) + 4,
  }));

  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}
// ───────────────────────────────────────────────────────────────────────────────

export default function JadwalPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const isWaliKelas = user?.role === 'Wali Kelas';
  const isGuruMapel = user?.role === 'Guru Mapel';

  const defaultMode = isWaliKelas ? 'kelas' : 'guru';

  // ── form state ──
  const [selectedGuru, setSelectedGuru] = useState('');
  const [hari, setHari] = useState('');
  const [rombel, setRombel] = useState('');
  const [mapel, setMapel] = useState('');
  const [jamMulai, setJamMulai] = useState('');
  const [jamSelesai, setJamSelesai] = useState('');
  const [viewMode, setViewMode] = useState(defaultMode);
  const [selectedRombel, setSelectedRombel] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // ── import state ──
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);

  // ── master data ──
  const { data: masterData } = useSWR('jadwal_master', async () => {
    const [guruRes, mapelRes, rombelRes, jamRes] = await Promise.all([
      supabase
        .from('master_user')
        .select('id_user, nama, rombel, role')
        .in('role', ['Wali Kelas', 'Guru Mapel'])
        .eq('status_aktif', 'Aktif')
        .order('nama'),
      supabase.from('master_mapel').select('id_mapel, nama_mapel').order('nama_mapel'),
      supabase.from('master_user').select('rombel').eq('role', 'Murid'),
      supabase.from('master_jam_pelajaran').select('id_jam, nama_jam, waktu_mulai, waktu_selesai').order('id_jam'),
    ]);
    const uniqueRombel = [...new Set((rombelRes.data || []).map(d => d.rombel).filter(Boolean))].sort();
    return {
      guru: guruRes.data || [],
      mapel: mapelRes.data || [],
      rombel: uniqueRombel,
      jam: jamRes.data || [],
    };
  });

  const mapelOptions = masterData?.mapel || [];
  const rombelOptions = masterData?.rombel || [];
  const jamOptions = masterData?.jam || [];

  const getJamLabel = (mulaiId, selesaiId) => {
    if (!mulaiId) return '-';
    const jamObjMulai = jamOptions.find(j => j.id_jam === mulaiId);
    const jamObjSelesai = jamOptions.find(j => j.id_jam === selesaiId);
    if (!jamObjMulai) return mulaiId;
    if (!jamObjSelesai || mulaiId === selesaiId) {
      return `${jamObjMulai.nama_jam} (${jamObjMulai.waktu_mulai}-${jamObjMulai.waktu_selesai})`;
    }
    return `${jamObjMulai.nama_jam} s/d ${jamObjSelesai.nama_jam} (${jamObjMulai.waktu_mulai}-${jamObjMulai.waktu_selesai})`;
  };

  const getJamOrder = (id_jam) => {
    if (!id_jam) return 9999;
    const idx = jamOptions.findIndex(j => j.id_jam === id_jam);
    return idx === -1 ? 9999 : idx;
  };

  // activeGuruId hanya untuk mode 'guru' (Admin pilih guru, atau Guru Mapel lihat diri sendiri)
  const activeGuruId = isAdmin ? selectedGuru : (isGuruMapel ? user?.id_user : '');
  const waliRombel = user?.rombel?.replace(/^Kelas\s+/i, '') || '';
  const activeRombel = isWaliKelas ? waliRombel : selectedRombel;
  const effectiveMode = isAdmin ? viewMode : defaultMode;

  // jadwalKey: Wali Kelas → pakai activeRombel, Guru Mapel → pakai activeGuruId
  const jadwalKey =
    effectiveMode === 'guru' && activeGuruId
      ? `jadwal_guru_${activeGuruId}`
      : effectiveMode === 'kelas' && activeRombel
      ? `jadwal_kelas_${activeRombel}`
      : null;

  const { data: jadwalData, mutate: mutateJadwal } = useSWR(jadwalKey, async () => {
    let query = supabase.from('jadwal_pelajaran').select('*').order('hari');
    if (effectiveMode === 'guru') {
      query = query.eq('id_guru', activeGuruId);
    } else {
      query = query.eq('rombel', activeRombel);
    }
    const { data } = await query;
    return data || [];
  });

  const jadwal = jadwalData || [];

  const jadwalByHari = HARI_OPTIONS.reduce((acc, h) => {
    const slots = jadwal
      .filter(j => j.hari === h.value)
      .sort((a, b) => getJamOrder(a.jam_mulai) - getJamOrder(b.jam_mulai));
    acc[h.value] = slots;
    return acc;
  }, {});

  const handleAdd = async () => {
    if (!activeGuruId || !hari || !rombel || !mapel || !jamMulai) {
      setMessage({ type: 'error', text: 'Semua field wajib diisi termasuk Jam Mulai.' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('jadwal_pelajaran').insert({
      id_guru: activeGuruId,
      hari: parseInt(hari),
      rombel,
      mata_pelajaran: mapel,
      jam_mulai: jamMulai || null,
      jam_selesai: (jamSelesai || jamMulai) || null,
    });
    setSaving(false);
    if (error) setMessage({ type: 'error', text: error.code === '23505' ? 'Jadwal ini sudah ada.' : error.message });
    else {
      setMessage({ type: 'success', text: 'Jadwal berhasil ditambahkan!' });
      mutateJadwal();
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Hapus jadwal ini?')) return;
    setDeletingId(id);
    const { error } = await supabase.from('jadwal_pelajaran').delete().eq('id', id);
    setDeletingId(null);
    if (error) setMessage({ type: 'error', text: error.message });
    else mutateJadwal();
  };

  const handleExport = () => {
    if (jadwal.length === 0) return;
    const suffix = effectiveMode === 'guru'
      ? masterData?.guru?.find(g => g.id_user === activeGuruId)?.nama?.replace(/\s+/g, '_') || activeGuruId
      : activeRombel;
    downloadXLSX(
      `jadwal_${effectiveMode}_${suffix}.xlsx`,
      ['Nama Guru', 'Hari', 'Jam Mulai', 'Jam Selesai', 'Rombel', 'Mata Pelajaran'],
      jadwal.map(j => {
        const namaGuruMap = masterData?.guru?.find(g => g.id_user === j.id_guru)?.nama || j.id_guru;
        return [namaGuruMap, HARI_LABEL[j.hari] || j.hari, j.jam_mulai || '-', j.jam_selesai || '-', j.rombel, j.mata_pelajaran];
      })
    );
  };

  const handleDownloadTemplate = () => {
    downloadXLSX('template_jadwal.xlsx', ['Nama Guru', 'Hari', 'Jam Mulai', 'Jam Selesai', 'Rombel', 'Mata Pelajaran'], [
      ['Ahmad Fauzi', 'Senin', 'J01', 'J02', '5A', 'Matematika'],
    ]);
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const wb = XLSX.read(arrayBuffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rawData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      if (rawData.length < 2) return;
      const headers = (rawData[0] || []).map(h => String(h).toLowerCase().trim().replace(/\s+/g, '_'));
      const namaGuruIdx = headers.findIndex(h => h.includes('nama_guru') || h.includes('guru'));
      const hariIdx = headers.findIndex(h => h === 'hari');
      const jamMulaiIdx = headers.findIndex(h => h.includes('jam_mulai') || h === 'mulai');
      const jamSelesaiIdx = headers.findIndex(h => h.includes('jam_selesai') || h === 'selesai');
      const rombelIdx = headers.findIndex(h => h.includes('rombel') || h.includes('kelas'));
      const mapelIdx = headers.findIndex(h => h.includes('mata_pelajaran') || h.includes('mapel'));

      const guruList = masterData?.guru || [];
      let success = 0, failed = 0;
      const failedRows = [];

      for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (row.every(c => String(c).trim() === '')) continue;
        const namaGuru = String(row[namaGuruIdx] ?? '').trim();
        const hariRaw = String(row[hariIdx] ?? '').trim();
        const hariNum = HARI_MAP[hariRaw.toLowerCase()] ?? parseInt(hariRaw);
        const guru = guruList.find(g => g.nama?.toLowerCase() === namaGuru.toLowerCase());
        if (!guru) { failed++; failedRows.push(`Baris ${i + 1}: Guru tidak ditemukan.`); continue; }
        
        const { error } = await supabase.from('jadwal_pelajaran').insert({
          id_guru: guru.id_user,
          hari: hariNum,
          jam_mulai: String(row[jamMulaiIdx] ?? '').trim() || null,
          jam_selesai: String(row[jamSelesaiIdx] ?? '').trim() || null,
          rombel: String(row[rombelIdx] ?? '').trim(),
          mata_pelajaran: String(row[mapelIdx] ?? '').trim(),
        });
        if (!error) success++; else { failed++; failedRows.push(`Baris ${i + 1}: ${error.message}`); }
      }
      setImportResult({ success, failed, failedRows });
      mutateJadwal();
    } finally { setImporting(false); }
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-white tracking-tight">Jadwal Pelajaran</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            {isAdmin ? 'Kelola jadwal mengajar guru — acuan persentase jurnal di dashboard' : isWaliKelas ? `Jadwal Kelas ${waliRombel || 'Anda'}` : 'Jadwal mengajar Anda — acuan kelengkapan jurnal'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {jadwal.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-emerald-700 dark:text-emerald-400 text-sm font-semibold">{jadwal.length} slot terjadwal</span>
            </div>
          )}
          {isAdmin && (
            <>
              <button onClick={handleDownloadTemplate} className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold rounded-xl transition-all border border-slate-200 dark:border-white/10">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m.75 12 3 3m0 0 3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>
                Template
              </button>
              <label className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-semibold rounded-xl transition-all border border-indigo-200 dark:border-indigo-500/20 cursor-pointer select-none">
                {importing ? <><div className="w-3.5 h-3.5 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />Mengimpor…</> : <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" /></svg>Impor XLSX</>}
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} disabled={importing} />
              </label>
              {jadwal.length > 0 && (
                <button onClick={handleExport} className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold rounded-xl transition-all border border-emerald-200 dark:border-emerald-500/20">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                  Ekspor XLSX
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Hasil Impor ── */}
      {importResult && (
        <div className={`rounded-2xl p-4 border flex items-start gap-3 ${importResult.failed === 0 ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20' : 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20'}`}>
          <div className="flex-1 min-w-0">
            <p className={`font-semibold text-sm ${importResult.failed === 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>
              Impor selesai — <span className="font-bold">{importResult.success} baris berhasil</span>{importResult.failed > 0 && `, ${importResult.failed} gagal`}
            </p>
            {importResult.failedRows.length > 0 && (
              <ul className="mt-1 space-y-0.5">{importResult.failedRows.map((r, i) => <li key={i} className="text-xs text-amber-600 dark:text-amber-400">• {r}</li>)}</ul>
            )}
          </div>
          <button onClick={() => setImportResult(null)} className="text-slate-400 hover:text-slate-600 shrink-0">✕</button>
        </div>
      )}

      {/* ── Toggle Mode — HANYA ADMIN ── */}
      {isAdmin && (
        <div className="flex bg-slate-100/70 dark:bg-slate-800/70 p-1 rounded-xl w-fit">
          {['guru', 'kelas'].map(m => (
            <button key={m} onClick={() => setViewMode(m)} className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${viewMode === m ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}>
              Per {m === 'guru' ? 'Guru' : 'Kelas'}
            </button>
          ))}
        </div>
      )}

      {/* ── Pilih Guru — Admin mode guru ── */}
      {isAdmin && effectiveMode === 'guru' && (
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-white/60 dark:border-white/10 rounded-[1.5rem] p-5 shadow-sm">
          <label className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold block mb-2">Pilih Guru</label>
          <div className="relative">
            <select value={selectedGuru} onChange={e => setSelectedGuru(e.target.value)} style={{ backgroundImage: 'none' }} className="appearance-none w-full pl-4 pr-10 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all">
              <option value="">-- Pilih Guru --</option>
              {(masterData?.guru || []).map(g => <option key={g.id_user} value={g.id_user}>{g.nama} ({g.role})</option>)}
            </select>
            <svg className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
          </div>
        </div>
      )}

      {/* ── Pilih Kelas — Admin mode kelas ── */}
      {isAdmin && effectiveMode === 'kelas' && (
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-white/60 dark:border-white/10 rounded-[1.5rem] p-5 shadow-sm">
          <label className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold block mb-2">Pilih Kelas / Rombel</label>
          <div className="relative">
            <select value={selectedRombel} onChange={e => setSelectedRombel(e.target.value)} style={{ backgroundImage: 'none' }} className="appearance-none w-full pl-4 pr-10 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all">
              <option value="">-- Pilih Kelas --</option>
              {rombelOptions.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <svg className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
          </div>
        </div>
      )}

      {/* ── Info kelas Wali Kelas ── */}
      {isWaliKelas && waliRombel && (
        <div className="flex items-center gap-3 px-4 py-3 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 rounded-2xl">
          <svg className="w-5 h-5 text-indigo-500 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 3.741-1.342m-7.482 0a50.74 50.74 0 0 0-7.482 0" /></svg>
          <p className="text-indigo-700 dark:text-indigo-300 text-sm font-semibold">Menampilkan jadwal Kelas <span className="font-bold">{waliRombel}</span></p>
        </div>
      )}

      {/* ── Form Tambah Slot — HANYA ADMIN ── */}
      {isAdmin && (effectiveMode === 'guru' ? activeGuruId : true) && (
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-white/60 dark:border-white/10 rounded-[1.5rem] p-6 shadow-sm space-y-4">
          <h3 className="text-slate-800 dark:text-white font-bold text-sm flex items-center gap-2">
            <div className="w-7 h-7 bg-emerald-100 dark:bg-emerald-500/20 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            </div>
            Tambah Slot Jadwal
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {/* Hari */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Hari</label>
              <div className="relative">
                <select value={hari} onChange={e => setHari(e.target.value)} style={{ backgroundImage: 'none' }} className="appearance-none w-full pl-4 pr-8 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all">
                  <option value="">Pilih Hari</option>
                  {HARI_OPTIONS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
                </select>
                <svg className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
              </div>
            </div>
            {/* Jam Mulai */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>Mulai
              </label>
              <div className="relative">
                <select value={jamMulai} onChange={e => setJamMulai(e.target.value)} style={{ backgroundImage: 'none' }} className="appearance-none w-full pl-3 pr-8 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all">
                  <option value="">Mulai...</option>
                  {jamOptions.map(j => <option key={j.id_jam} value={j.id_jam}>{j.nama_jam} ({j.waktu_mulai} - {j.waktu_selesai})</option>)}
                </select>
                <svg className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
              </div>
            </div>
            {/* Jam Selesai */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>Selesai
              </label>
              <div className="relative">
                <select value={jamSelesai} onChange={e => setJamSelesai(e.target.value)} style={{ backgroundImage: 'none' }} className="appearance-none w-full pl-3 pr-8 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all">
                  <option value="">Selesai...</option>
                  {jamOptions.map(j => <option key={j.id_jam} value={j.id_jam}>{j.nama_jam} ({j.waktu_mulai} - {j.waktu_selesai})</option>)}
                </select>
                <svg className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
              </div>
            </div>
            {/* Rombel */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Rombel</label>
              <div className="relative">
                <select value={rombel} onChange={e => setRombel(e.target.value)} style={{ backgroundImage: 'none' }} className="appearance-none w-full pl-4 pr-8 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all">
                  <option value="">Pilih Rombel</option>
                  {rombelOptions.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <svg className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
              </div>
            </div>
            {/* Mapel */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Mata Pelajaran</label>
              <div className="relative">
                <select value={mapel} onChange={e => setMapel(e.target.value)} style={{ backgroundImage: 'none' }} className="appearance-none w-full pl-4 pr-8 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all">
                  <option value="">Pilih Mapel</option>
                  {mapelOptions.map(m => <option key={m.id_mapel} value={m.nama_mapel}>{m.nama_mapel}</option>)}
                </select>
                <svg className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
              </div>
            </div>
          </div>
          {message && (
            <div className={`px-4 py-3 rounded-xl text-sm font-medium ${message.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-300' : 'bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-300'}`}>
              {message.text}
            </div>
          )}
          <button onClick={handleAdd} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold text-sm rounded-xl shadow-[0_4px_15px_rgba(16,185,129,0.3)] transition-all disabled:opacity-50">
            {saving ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Menyimpan…</> : <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>Tambah Jadwal</>}
          </button>
        </div>
      )}

      {/* ── Jadwal Mingguan ── */}
      {jadwalKey && (
        <div className="space-y-3">
          <h3 className="text-slate-800 dark:text-white font-bold flex items-center gap-2 text-sm uppercase tracking-wide">
            <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>
            Jadwal Mingguan
            {effectiveMode === 'kelas' && activeRombel && <span className="ml-1 text-indigo-500 dark:text-indigo-400 normal-case">— Kelas {activeRombel}</span>}
          </h3>

          {jadwal.length === 0 ? (
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-white/60 dark:border-white/10 rounded-[1.5rem] p-12 text-center">
              <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>
              </div>
              <p className="text-slate-500 dark:text-slate-400 font-medium">Belum ada jadwal</p>
              <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">{isAdmin ? 'Tambahkan slot jadwal di atas atau impor dari file XLSX' : 'Jadwal belum diatur oleh Admin'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {HARI_OPTIONS.map(h => {
                const slots = jadwalByHari[h.value] || [];
                if (slots.length === 0) return null;
                return (
                  <div key={h.value} className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-white/60 dark:border-white/10 rounded-[1.5rem] overflow-hidden shadow-sm">
                    <div className={`bg-gradient-to-r ${HARI_COLOR[h.value]} px-5 py-3 flex items-center justify-between`}>
                      <span className="text-white font-bold text-sm">{h.label}</span>
                      <span className="text-white/80 text-xs bg-white/20 px-2.5 py-0.5 rounded-full font-semibold">{slots.length} slot</span>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-white/5">
                      {slots.map(slot => (
                        <div key={slot.id} className="px-5 py-3.5 flex items-center justify-between group hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                          <div className="flex-1 min-w-0">
                            <p className="text-slate-800 dark:text-white font-semibold text-sm truncate">{slot.mata_pelajaran}</p>
                            {effectiveMode === 'guru'
                              ? <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">{slot.rombel}</p>
                              : <p className="text-indigo-600 dark:text-indigo-400 text-xs mt-0.5 font-medium">{masterData?.guru?.find(g => g.id_user === slot.id_guru)?.nama || slot.id_guru}</p>
                            }
                            {(slot.jam_mulai || slot.jam_selesai) && (
                              <p className="text-slate-400 dark:text-slate-500 text-xs mt-0.5 flex items-center gap-1">
                                <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                                {getJamLabel(slot.jam_mulai, slot.jam_selesai)}
                              </p>
                            )}
                          </div>
                          {isAdmin && (
                            <button onClick={() => handleDelete(slot.id)} disabled={deletingId === slot.id} className="ml-3 w-8 h-8 flex items-center justify-center rounded-xl text-slate-300 dark:text-slate-600 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50 shrink-0">
                              {deletingId === slot.id
                                ? <div className="w-3.5 h-3.5 border-2 border-rose-300 border-t-rose-500 rounded-full animate-spin" />
                                : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                              }
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Info box ── */}
      <div className="rounded-2xl bg-blue-50 dark:bg-blue-500/5 border border-blue-200 dark:border-blue-500/20 p-5 flex items-start gap-4">
        <div className="w-9 h-9 bg-blue-100 dark:bg-blue-500/20 rounded-xl flex items-center justify-center shrink-0">
          <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" /></svg>
        </div>
        <div>
          <p className="text-blue-800 dark:text-blue-300 font-semibold text-sm">Jadwal sebagai Acuan Jurnal</p>
          <p className="text-blue-600 dark:text-blue-400/70 text-xs mt-1 leading-relaxed">
            Jadwal yang diset di sini menjadi <strong>tolok ukur persentase jurnal</strong> di dashboard guru.
            Setiap pasangan <strong>Hari × Rombel</strong> dihitung kemunculannya sejak awal tahun ajaran.
          </p>
        </div>
      </div>
    </div>
  );
}

