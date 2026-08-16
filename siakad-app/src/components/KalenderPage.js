'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import useSWR from 'swr';

export default function KalenderPage() {
  const [tanggal, setTanggal] = useState('');
  const [tipeHari, setTipeHari] = useState('Libur');
  const [keterangan, setKeterangan] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  
  const { data: kalenderData, isLoading: loading, mutate: mutateKalender } = useSWR('master_kalender', async () => {
    const { data } = await supabase
      .from('master_kalender')
      .select('*')
      .order('tanggal', { ascending: false });
    return data || [];
  });

  const kalender = kalenderData || [];

  const handleAdd = async () => {
    if (!tanggal || !keterangan) {
      setMessage({ type: 'error', text: 'Tanggal dan keterangan wajib diisi.' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('master_kalender').upsert(
      { tanggal, tipe_hari: tipeHari, keterangan },
      { onConflict: 'tanggal' }
    );
    setSaving(false);
    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ type: 'success', text: 'Hari berhasil ditambahkan ke kalender!' });
      setTanggal('');
      setTipeHari('Libur');
      setKeterangan('');
      mutateKalender();
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Hapus tanggal ini dari kalender?')) return;
    const { error } = await supabase.from('master_kalender').delete().eq('id', id);
    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      mutateKalender();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Kelola Kalender Akademik</h2>
        <p className="text-slate-600 dark:text-white/40 text-sm mt-1">Tambah atau hapus tanggal libur dan kegiatan non-efektif</p>
      </div>

      {/* Add Form */}
      <div className="bg-white/50 dark:bg-white/5 border border-slate-300 dark:border-white/5 rounded-2xl p-6">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-2 flex-1 min-w-[12rem]">
            <label className="text-xs text-slate-600 dark:text-white/50 uppercase tracking-wider font-medium">Tanggal</label>
            <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)}
              className="w-full px-4 py-2.5 bg-white/50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-emerald-500/50" />
          </div>
          <div className="space-y-2 flex-1 min-w-[12rem]">
            <label className="text-xs text-slate-600 dark:text-white/50 uppercase tracking-wider font-medium">Tipe Hari</label>
            <select value={tipeHari} onChange={e => setTipeHari(e.target.value)}
              className="w-full px-4 py-2.5 bg-white/50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-emerald-500/50">
              <option value="Libur">Libur (Tanggal Merah)</option>
              <option value="Non-Efektif KBM">Non-Efektif KBM (Ujian/Lomba)</option>
            </select>
          </div>
          <div className="space-y-2 flex-[2] min-w-[12rem]">
            <label className="text-xs text-slate-600 dark:text-white/50 uppercase tracking-wider font-medium">Keterangan</label>
            <input type="text" value={keterangan} onChange={e => setKeterangan(e.target.value)} placeholder="Contoh: Class Meeting, PAS, Libur Semester"
              className="w-full px-4 py-2.5 bg-white/50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-emerald-500/50" />
          </div>
          <button onClick={handleAdd} disabled={saving}
            className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-900 dark:text-white font-medium text-sm rounded-xl shadow-lg transition-all disabled:opacity-50">
            {saving ? 'Menyimpan...' : '+ Tambah'}
          </button>
        </div>
        {message && (
          <div className={`mt-3 px-4 py-2 rounded-xl text-sm ${
            message.type === 'success' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300' : 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-300'
          }`}>{message.text}</div>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : kalender.length === 0 ? (
        <div className="text-center py-8 text-slate-600 dark:text-white/30 text-sm">Belum ada data kalender yang ditambahkan</div>
      ) : (
        <div className="space-y-2">
          {kalender.map(k => (
            <div key={k.id} className="bg-white/50 dark:bg-white/5 border border-slate-300 dark:border-white/5 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <span className="text-slate-600 dark:text-white/60 font-mono text-sm shrink-0">{k.tanggal}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold w-max ${k.tipe_hari === 'Libur' ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400'}`}>
                  {k.tipe_hari}
                </span>
                <span className="text-slate-900 dark:text-white font-medium text-sm">{k.keterangan}</span>
              </div>
              <button onClick={() => handleDelete(k.id)}
                className="px-3 py-1.5 text-red-600 dark:text-red-400/60 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg text-xs transition-all w-max self-end sm:self-auto">
                Hapus
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
