'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import useSWR from 'swr';

export default function JurnalPage() {
  const { user } = useAuth();
  const [tanggal, setTanggal] = useState(() => new Date().toISOString().split('T')[0]);
  const [jamPelajaran, setJamPelajaran] = useState('');
  const [rombel, setRombel] = useState(user?.rombel !== '-' ? user?.rombel : '');
  const [mapel, setMapel] = useState('');
  const [materi, setMateri] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [isHoliday, setIsHoliday] = useState(false);
  const [holidayName, setHolidayName] = useState('');
  const [editId, setEditId] = useState(null);

  const { data: masterData } = useSWR('master_jurnal', async () => {
    const [jamRes, mapelRes, rombelRes] = await Promise.all([
      supabase.from('master_jam_pelajaran').select('*').order('id_jam'),
      supabase.from('master_mapel').select('*').order('nama_mapel'),
      supabase.from('master_user').select('rombel').eq('role', 'Murid'),
    ]);
    const unique = [...new Set((rombelRes.data || []).map(d => d.rombel).filter(Boolean))].sort();
    return { jam: jamRes.data || [], mapel: mapelRes.data || [], rombel: unique };
  });

  const jamOptions = masterData?.jam || [];
  const mapelOptions = masterData?.mapel || [];
  const rombelOptions = masterData?.rombel || [];

  useEffect(() => {
    if (!jamPelajaran && jamOptions.length > 0) setJamPelajaran(jamOptions[0].id_jam);
  }, [jamOptions, jamPelajaran]);

  const { data: riwayatData, isLoading: loadingRiwayat, mutate: mutateRiwayat } = useSWR(user ? `jurnal_riwayat_${user.id_user}` : null, async () => {
    let query = supabase.from('jurnal_guru').select('*, master_user(nama)').order('tanggal', { ascending: false }).order('jam_pelajaran').limit(20);
    if (user.role !== 'Admin') {
      query = query.eq('id_guru', user.id_user);
    }
    const { data } = await query;
    return data || [];
  });

  const riwayat = riwayatData || [];

  const checkHoliday = useCallback(async (tgl) => {
    setIsHoliday(false);
    setHolidayName('');
    const d = new Date(tgl);
    if (d.getDay() === 0) {
      setIsHoliday(true);
      setHolidayName('Hari Minggu');
      return;
    }
    const { data: libur } = await supabase.from('master_libur').select('*').eq('tanggal', tgl).single();
    if (libur) {
      setIsHoliday(true);
      setHolidayName(libur.keterangan);
    }
  }, []);


  useEffect(() => { checkHoliday(tanggal); }, [tanggal, checkHoliday]);

  const handleEdit = (j) => {
    setEditId(j.id);
    setTanggal(j.tanggal);
    setRombel(j.rombel);
    setMapel(j.mata_pelajaran);
    setMateri(j.materi_catatan !== '-' ? j.materi_catatan : '');
    
    // Attempt to match jam_pelajaran ID by finding it in jamOptions
    const jamId = jamOptions.find(opt => j.jam_pelajaran.includes(opt.nama_jam))?.id_jam;
    if (jamId) setJamPelajaran(jamId);
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSave = async () => {
    if (!tanggal || !jamPelajaran || !rombel || !mapel) {
      setMessage({ type: 'error', text: 'Semua field wajib diisi.' });
      return;
    }
    setSaving(true);
    setMessage(null);

    const jamObj = jamOptions.find(j => j.id_jam === jamPelajaran);
    const payload = {
      tanggal,
      jam_pelajaran: jamObj ? `${jamObj.nama_jam} (${jamObj.waktu_mulai}-${jamObj.waktu_selesai})` : jamPelajaran,
      id_guru: user.id_user,
      rombel,
      mata_pelajaran: mapel,
      materi_catatan: materi || '-',
    };

    let error;
    if (editId) {
      const { error: updateError } = await supabase.from('jurnal_guru').update(payload).eq('id', editId);
      error = updateError;
    } else {
      const { error: insertError } = await supabase.from('jurnal_guru').insert(payload);
      error = insertError;
    }

    setSaving(false);
    if (error) {
      setMessage({ type: 'error', text: 'Gagal menyimpan: ' + error.message });
    } else {
      setMessage({ type: 'success', text: editId ? 'Jurnal berhasil diperbarui!' : 'Jurnal berhasil disimpan!' });
      setMateri('');
      setEditId(null);
      mutateRiwayat();
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-white tracking-tight">Jurnal Mengajar</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Catat aktivitas belajar mengajar harian</p>
        </div>
        <button onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 rounded-xl text-sm font-semibold transition-all shadow-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0v3.396c0 .63.508 1.141 1.141 1.141h8.218c.633 0 1.141-.51 1.141-1.141V8.25Z" />
          </svg>
          Print Laporan
        </button>
      </div>

      {user.role !== 'Admin' && (
        <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-3xl p-6 sm:p-8 space-y-6 print:hidden relative shadow-sm">
          {isHoliday && (
            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-2xl px-4 py-3.5 text-amber-600 dark:text-amber-300 text-sm flex items-center gap-3 font-medium shadow-sm">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>Peringatan: Tanggal ini adalah hari libur (<strong>{holidayName}</strong>).</span>
            </div>
          )}
          {editId && (
            <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-2xl px-4 py-3.5 text-emerald-700 dark:text-emerald-300 text-sm font-medium shadow-sm">
              <span className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" /></svg>
                Sedang mengedit jurnal
              </span>
              <button onClick={() => { setEditId(null); setMateri(''); }} className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-200 underline text-xs font-bold transition-colors">Batal Edit</button>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Tanggal</label>
              <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-sm" />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Jam Pelajaran</label>
              <select value={jamPelajaran} onChange={e => setJamPelajaran(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-sm">
                {jamOptions.map(j => (
                  <option key={j.id_jam} value={j.id_jam} className="bg-white dark:bg-slate-900">
                    {j.nama_jam} ({j.waktu_mulai}-{j.waktu_selesai})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Rombel</label>
              <select value={rombel} onChange={e => setRombel(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-sm">
                <option value="" className="bg-white dark:bg-slate-900 text-slate-400">Pilih Rombel</option>
                {rombelOptions.map(r => (
                  <option key={r} value={r} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{r}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Mata Pelajaran</label>
              <select value={mapel} onChange={e => setMapel(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-sm">
                <option value="" className="bg-white dark:bg-slate-900 text-slate-400">Pilih Mapel</option>
                {mapelOptions.map(m => (
                  <option key={m.id_mapel} value={m.nama_mapel} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{m.nama_mapel}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Materi / Catatan</label>
            <textarea value={materi} onChange={e => setMateri(e.target.value)} rows={3} placeholder="Tuliskan materi yang diajarkan dengan detail..."
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-sm resize-none" />
          </div>

          {message && (
            <div className={`px-4 py-3 rounded-2xl text-sm font-medium shadow-sm animate-in fade-in slide-in-from-top-2 ${
              message.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-300' : 'bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-300'
            }`}>{message.text}</div>
          )}

          <div className="pt-2 flex justify-end">
            <button onClick={handleSave} disabled={saving}
              className="w-full sm:w-auto px-8 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl shadow-lg shadow-emerald-600/25 hover:shadow-emerald-500/40 transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:transform-none disabled:shadow-none flex items-center justify-center gap-2">
              {saving ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Menyimpan...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" /></svg>
                  {editId ? 'Perbarui Jurnal' : 'Simpan Jurnal'}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Riwayat */}
      <div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 tracking-tight">Riwayat Jurnal Terbaru</h3>
        {loadingRiwayat ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
          </div>
        ) : riwayat.length === 0 ? (
          <div className="text-center py-12 bg-white/50 dark:bg-slate-900/40 backdrop-blur-sm border border-slate-200 dark:border-white/10 rounded-3xl text-slate-500 dark:text-slate-400 text-sm font-medium shadow-sm">
            Belum ada jurnal bulan ini.
          </div>
        ) : (
          <div className="space-y-4">
            {riwayat.map(j => (
              <div key={j.id} className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-5 space-y-3 shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500" />
                <div className="flex items-start justify-between pl-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-900 dark:text-white font-bold text-sm">{j.tanggal}</span>
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-md text-[10px] font-bold tracking-wider">{j.jam_pelajaran}</span>
                      {user.role === 'Admin' && j.master_user?.nama && (
                        <span className="px-2 py-0.5 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-md text-[10px] font-bold tracking-wider">
                          {j.master_user.nama}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2 text-xs font-semibold">
                      <span className="px-2 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 rounded-lg">{j.rombel}</span>
                      <span className="px-2 py-1 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 rounded-lg">{j.mata_pelajaran}</span>
                    </div>
                  </div>
                  {user.role !== 'Admin' && (
                    <button onClick={() => handleEdit(j)} className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-200 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 p-2 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" /></svg>
                    </button>
                  )}
                </div>
                {j.materi_catatan && j.materi_catatan !== '-' && (
                  <p className="text-slate-600 dark:text-slate-400 text-sm pl-2 pt-1 border-t border-slate-100 dark:border-white/5">{j.materi_catatan}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * { visibility: hidden; }
          .print\\:hidden { display: none !important; }
          .print\\:visible, .print\\:visible * { visibility: visible; }
          .print\\:visible { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}} />
    </div>
  );
}
