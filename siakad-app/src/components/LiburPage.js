'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export default function LiburPage() {
  const [libur, setLibur] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tanggal, setTanggal] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const loadLibur = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('master_libur')
      .select('*')
      .order('tanggal', { ascending: false });
    setLibur(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadLibur(); }, [loadLibur]);

  const handleAdd = async () => {
    if (!tanggal || !keterangan) {
      setMessage({ type: 'error', text: 'Tanggal dan keterangan wajib diisi.' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('master_libur').upsert(
      { tanggal, keterangan },
      { onConflict: 'tanggal' }
    );
    setSaving(false);
    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ type: 'success', text: 'Hari libur berhasil ditambahkan!' });
      setTanggal('');
      setKeterangan('');
      loadLibur();
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Hapus hari libur ini?')) return;
    const { error } = await supabase.from('master_libur').delete().eq('id', id);
    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      loadLibur();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Kelola Hari Libur</h2>
        <p className="text-white/40 text-sm mt-1">Tambah atau hapus hari libur khusus</p>
      </div>

      {/* Add Form */}
      <div className="bg-white/5 border border-white/5 rounded-2xl p-6">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-2 flex-1 min-w-48">
            <label className="text-xs text-white/50 uppercase tracking-wider font-medium">Tanggal</label>
            <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-blue-400/50" />
          </div>
          <div className="space-y-2 flex-[2] min-w-48">
            <label className="text-xs text-white/50 uppercase tracking-wider font-medium">Keterangan</label>
            <input type="text" value={keterangan} onChange={e => setKeterangan(e.target.value)} placeholder="Contoh: Maulid Nabi Muhammad SAW"
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-blue-400/50" />
          </div>
          <button onClick={handleAdd} disabled={saving}
            className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-sm rounded-xl shadow-lg transition-all disabled:opacity-50">
            {saving ? 'Menyimpan...' : '+ Tambah'}
          </button>
        </div>
        {message && (
          <div className={`mt-3 px-4 py-2 rounded-xl text-sm ${
            message.type === 'success' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'
          }`}>{message.text}</div>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : libur.length === 0 ? (
        <div className="text-center py-8 text-white/30 text-sm">Belum ada hari libur yang ditambahkan</div>
      ) : (
        <div className="space-y-2">
          {libur.map(l => (
            <div key={l.id} className="bg-white/5 border border-white/5 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-white/60 font-mono text-sm">{l.tanggal}</span>
                <span className="text-white font-medium text-sm">{l.keterangan}</span>
              </div>
              <button onClick={() => handleDelete(l.id)}
                className="px-3 py-1.5 text-red-400/60 hover:text-red-400 hover:bg-red-500/10 rounded-lg text-xs transition-all">
                Hapus
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
