'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import useSWR from 'swr';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function MasterMapelPage() {
  const { user } = useAuth();
  const router = useRouter();
  
  const [idMapel, setIdMapel] = useState('');
  const [namaMapel, setNamaMapel] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [editingId, setEditingId] = useState(null);
  
  const { data: mapelData, isLoading: loading, mutate: mutateMapel } = useSWR(user?.role === 'Admin' ? 'master_mapel' : null, async () => {
    const { data } = await supabase
      .from('master_mapel')
      .select('*')
      .order('id_mapel', { ascending: true });
    return data || [];
  });

  const mapelList = mapelData || [];

  if (user && user.role !== 'Admin') {
    router.push('/dashboard');
    return null;
  }

  const handleSave = async () => {
    if (!idMapel || !namaMapel) {
      setMessage({ type: 'error', text: 'ID Mapel dan Nama Mapel wajib diisi.' });
      return;
    }
    setSaving(true);
    
    // We use upsert since id_mapel is UNIQUE
    const payload = { id_mapel: idMapel, nama_mapel: namaMapel };
    const { error } = await supabase.from('master_mapel').upsert(
      payload,
      { onConflict: 'id_mapel' }
    );
    
    setSaving(false);
    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ type: 'success', text: 'Mata pelajaran berhasil disimpan!' });
      setIdMapel('');
      setNamaMapel('');
      setEditingId(null);
      mutateMapel();
    }
  };

  const handleEdit = (m) => {
    setIdMapel(m.id_mapel);
    setNamaMapel(m.nama_mapel);
    setEditingId(m.id);
    window.scrollTo(0, 0);
  };

  const handleCancelEdit = () => {
    setIdMapel('');
    setNamaMapel('');
    setEditingId(null);
    setMessage(null);
  };

  const handleDelete = async (id) => {
    if (!confirm('Hapus mata pelajaran ini?')) return;
    const { error } = await supabase.from('master_mapel').delete().eq('id', id);
    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      mutateMapel();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Kelola Mata Pelajaran</h2>
        <p className="text-slate-600 dark:text-white/40 text-sm mt-1">Tambah, ubah, atau hapus daftar mata pelajaran</p>
      </div>

      {/* Add/Edit Form */}
      <div className="bg-white/50 dark:bg-white/5 border border-slate-300 dark:border-white/5 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-2 flex-1 min-w-[200px]">
            <label className="text-xs text-slate-600 dark:text-white/50 uppercase tracking-wider font-medium">Kode / ID Mapel</label>
            <input type="text" value={idMapel} onChange={e => setIdMapel(e.target.value)} placeholder="Contoh: MAT" disabled={!!editingId}
              className="w-full px-4 py-2.5 bg-white/50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-emerald-500/50 disabled:opacity-50" />
          </div>
          <div className="space-y-2 flex-[2] min-w-[200px]">
            <label className="text-xs text-slate-600 dark:text-white/50 uppercase tracking-wider font-medium">Nama Mata Pelajaran</label>
            <input type="text" value={namaMapel} onChange={e => setNamaMapel(e.target.value)} placeholder="Contoh: Matematika"
              className="w-full px-4 py-2.5 bg-white/50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-emerald-500/50" />
          </div>
          <div className="flex gap-2 w-full md:w-auto mt-2 md:mt-0">
            <button onClick={handleSave} disabled={saving}
              className="w-full md:w-auto px-6 py-2.5 bg-gradient-to-r from-blue-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-900 dark:text-white font-medium text-sm rounded-xl shadow-lg transition-all disabled:opacity-50">
              {saving ? 'Menyimpan...' : editingId ? 'Simpan' : '+ Tambah'}
            </button>
            {editingId && (
              <button onClick={handleCancelEdit} disabled={saving}
                className="w-full md:w-auto px-6 py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-900 dark:text-white font-medium text-sm rounded-xl shadow-lg transition-all disabled:opacity-50">
                Batal
              </button>
            )}
          </div>
        </div>
        {message && (
          <div className={`mt-4 px-4 py-3 rounded-xl text-sm border ${
            message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400' : 'bg-red-50 border-red-200 text-red-700 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400'
          }`}>
            {message.text}
          </div>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : mapelList.length === 0 ? (
        <div className="text-center py-12 bg-white/30 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-2xl">
          <p className="text-slate-500 dark:text-white/40">Belum ada mata pelajaran yang ditambahkan.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mapelList.map(m => (
            <div key={m.id} className="bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-xl p-5 flex flex-col justify-between h-full shadow-sm">
              <div className="mb-4">
                <span className="inline-block px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-mono rounded mb-2">
                  {m.id_mapel}
                </span>
                <h3 className="text-slate-900 dark:text-white font-bold text-lg leading-tight">{m.nama_mapel}</h3>
              </div>
              <div className="flex gap-2 justify-end mt-2 pt-4 border-t border-slate-100 dark:border-white/5">
                <button onClick={() => handleEdit(m)}
                  className="px-3 py-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg text-sm font-medium transition-all">
                  Edit
                </button>
                <button onClick={() => handleDelete(m.id)}
                  className="px-3 py-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg text-sm font-medium transition-all">
                  Hapus
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
