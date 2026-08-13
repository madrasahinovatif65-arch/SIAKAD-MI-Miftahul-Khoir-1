'use client';

import { useState } from 'react';
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

const HARI_COLOR = {
  1: 'from-emerald-500 to-teal-500',
  2: 'from-blue-500 to-indigo-500',
  3: 'from-violet-500 to-purple-500',
  4: 'from-amber-500 to-orange-500',
  5: 'from-rose-500 to-pink-500',
  6: 'from-cyan-500 to-sky-500',
};

export default function JadwalPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';

  const [selectedGuru, setSelectedGuru] = useState(isAdmin ? '' : user?.id_user || '');
  const [hari, setHari] = useState('');
  const [rombel, setRombel] = useState('');
  const [mapel, setMapel] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const { data: masterData } = useSWR('jadwal_master', async () => {
    const [guruRes, mapelRes, rombelRes] = await Promise.all([
      supabase.from('master_user').select('id_user, nama').in('role', ['Wali Kelas', 'Guru Mapel']).eq('status_aktif', 'Aktif').order('nama'),
      supabase.from('master_mapel').select('id_mapel, nama_mapel').order('nama_mapel'),
      supabase.from('master_user').select('rombel').eq('role', 'Murid'),
    ]);
    const uniqueRombel = [...new Set((rombelRes.data || []).map(d => d.rombel).filter(Boolean))].sort();
    return {
      guru: guruRes.data || [],
      mapel: mapelRes.data || [],
      rombel: uniqueRombel,
    };
  });

  const mapelOptions = masterData?.mapel || [];
  const rombelOptions = masterData?.rombel || [];

  const activeGuruId = isAdmin ? selectedGuru : user?.id_user;
  const jadwalKey = activeGuruId ? `jadwal_${activeGuruId}` : null;

  const { data: jadwalData, mutate: mutateJadwal } = useSWR(jadwalKey, async () => {
    const { data } = await supabase
      .from('jadwal_pelajaran')
      .select('*')
      .eq('id_guru', activeGuruId)
      .order('hari')
      .order('rombel');
    return data || [];
  });

  const jadwal = jadwalData || [];

  const jadwalByHari = HARI_OPTIONS.reduce((acc, h) => {
    acc[h.value] = jadwal.filter(j => j.hari === h.value);
    return acc;
  }, {});

  const handleAdd = async () => {
    const guruId = activeGuruId;
    if (!guruId || !hari || !rombel || !mapel) {
      setMessage({ type: 'error', text: 'Semua field wajib diisi.' });
      return;
    }
    setSaving(true);
    setMessage(null);
    const { error } = await supabase.from('jadwal_pelajaran').insert({
      id_guru: guruId,
      hari: parseInt(hari),
      rombel,
      mata_pelajaran: mapel,
    });
    setSaving(false);
    if (error) {
      if (error.code === '23505') {
        setMessage({ type: 'error', text: 'Jadwal ini sudah ada (duplikat).' });
      } else {
        setMessage({ type: 'error', text: error.message });
      }
    } else {
      setMessage({ type: 'success', text: 'Jadwal berhasil ditambahkan!' });
      setHari('');
      setRombel('');
      setMapel('');
      mutateJadwal();
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Hapus jadwal ini?')) return;
    setDeletingId(id);
    const { error } = await supabase.from('jadwal_pelajaran').delete().eq('id', id);
    setDeletingId(null);
    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      mutateJadwal();
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-white tracking-tight">Jadwal Pelajaran</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            {isAdmin ? 'Kelola jadwal mengajar guru — acuan persentase jurnal di dashboard' : 'Jadwal mengajar Anda — acuan kelengkapan jurnal'}
          </p>
        </div>
        {jadwal.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-emerald-700 dark:text-emerald-400 text-sm font-semibold">{jadwal.length} slot terjadwal</span>
          </div>
        )}
      </div>

      {/* Pilih Guru (Admin only) */}
      {isAdmin && (
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-white/60 dark:border-white/10 rounded-[1.5rem] p-5 shadow-sm">
          <label className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold block mb-2">Pilih Guru</label>
          <div className="relative">
            <select value={selectedGuru} onChange={e => setSelectedGuru(e.target.value)}
              style={{ backgroundImage: 'none' }}
              className="appearance-none w-full pl-4 pr-10 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all">
              <option value="">-- Pilih Guru --</option>
              {(masterData?.guru || []).map(g => <option key={g.id_user} value={g.id_user}>{g.nama}</option>)}
            </select>
            <svg className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          </div>
        </div>
      )}

      {/* Form Tambah */}
      {activeGuruId && (
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-white/60 dark:border-white/10 rounded-[1.5rem] p-6 shadow-sm space-y-4">
          <h3 className="text-slate-800 dark:text-white font-bold text-sm flex items-center gap-2">
            <div className="w-7 h-7 bg-emerald-100 dark:bg-emerald-500/20 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            Tambah Slot Jadwal
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Hari */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Hari</label>
              <div className="relative">
                <select value={hari} onChange={e => setHari(e.target.value)} style={{ backgroundImage: 'none' }}
                  className="appearance-none w-full pl-4 pr-8 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all">
                  <option value="">Pilih Hari</option>
                  {HARI_OPTIONS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
                </select>
                <svg className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
              </div>
            </div>
            {/* Rombel */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Rombel</label>
              <div className="relative">
                <select value={rombel} onChange={e => setRombel(e.target.value)} style={{ backgroundImage: 'none' }}
                  className="appearance-none w-full pl-4 pr-8 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all">
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
                <select value={mapel} onChange={e => setMapel(e.target.value)} style={{ backgroundImage: 'none' }}
                  className="appearance-none w-full pl-4 pr-8 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all">
                  <option value="">Pilih Mapel</option>
                  {mapelOptions.map(m => <option key={m.id_mapel} value={m.nama_mapel}>{m.nama_mapel}</option>)}
                </select>
                <svg className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
              </div>
            </div>
          </div>
          {message && (
            <div className={`px-4 py-3 rounded-xl text-sm font-medium ${message.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-300'
            }`}>{message.text}</div>
          )}
          <button onClick={handleAdd} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold text-sm rounded-xl shadow-[0_4px_15px_rgba(16,185,129,0.3)] transition-all disabled:opacity-50">
            {saving
              ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Menyimpan...</>
              : <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg> Tambah Jadwal</>}
          </button>
        </div>
      )}

      {/* Grid Jadwal Mingguan */}
      {activeGuruId && (
        <div className="space-y-3">
          <h3 className="text-slate-800 dark:text-white font-bold flex items-center gap-2 text-sm uppercase tracking-wide">
            <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
            </svg>
            Jadwal Mingguan
          </h3>

          {jadwal.length === 0 ? (
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-white/60 dark:border-white/10 rounded-[1.5rem] p-12 text-center">
              <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                </svg>
              </div>
              <p className="text-slate-500 dark:text-slate-400 font-medium">Belum ada jadwal</p>
              <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">Tambahkan slot jadwal di atas</p>
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
                            <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">{slot.rombel}</p>
                          </div>
                          {isAdmin && (
                            <button onClick={() => handleDelete(slot.id)} disabled={deletingId === slot.id}
                              className="ml-3 w-8 h-8 flex items-center justify-center rounded-xl text-slate-300 dark:text-slate-600 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50 shrink-0">
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

      {/* Info box */}
      <div className="rounded-2xl bg-blue-50 dark:bg-blue-500/5 border border-blue-200 dark:border-blue-500/20 p-5 flex items-start gap-4">
        <div className="w-9 h-9 bg-blue-100 dark:bg-blue-500/20 rounded-xl flex items-center justify-center shrink-0">
          <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
          </svg>
        </div>
        <div>
          <p className="text-blue-800 dark:text-blue-300 font-semibold text-sm">Jadwal sebagai Acuan Jurnal</p>
          <p className="text-blue-600 dark:text-blue-400/70 text-xs mt-1 leading-relaxed">
            Jadwal yang diset di sini menjadi <strong>tolok ukur persentase jurnal</strong> di dashboard guru.
            Setiap pasangan <strong>Hari × Rombel</strong> dihitung kemunculannya sejak awal tahun ajaran.
            Jika belum ada jadwal, sistem otomatis menggunakan riwayat jurnal sebagai referensi.
          </p>
        </div>
      </div>
    </div>
  );
}
