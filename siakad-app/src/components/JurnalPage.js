'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export default function JurnalPage() {
  const { user } = useAuth();
  const [tanggal, setTanggal] = useState(() => new Date().toISOString().split('T')[0]);
  const [jamPelajaran, setJamPelajaran] = useState('');
  const [rombel, setRombel] = useState(user?.rombel !== '-' ? user?.rombel : '');
  const [mapel, setMapel] = useState('');
  const [materi, setMateri] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [jamOptions, setJamOptions] = useState([]);
  const [mapelOptions, setMapelOptions] = useState([]);
  const [rombelOptions, setRombelOptions] = useState([]);
  const [riwayat, setRiwayat] = useState([]);
  const [loadingRiwayat, setLoadingRiwayat] = useState(false);
  const [isHoliday, setIsHoliday] = useState(false);
  const [holidayName, setHolidayName] = useState('');
  const [editId, setEditId] = useState(null);

  useEffect(() => {
    async function fetchMaster() {
      const [jamRes, mapelRes, rombelRes] = await Promise.all([
        supabase.from('master_jam_pelajaran').select('*').order('id_jam'),
        supabase.from('master_mapel').select('*').order('nama_mapel'),
        supabase.from('master_murid').select('rombel'),
      ]);
      setJamOptions(jamRes.data || []);
      setMapelOptions(mapelRes.data || []);
      const unique = [...new Set((rombelRes.data || []).map(d => d.rombel).filter(Boolean))].sort();
      setRombelOptions(unique);
      if (jamRes.data?.length) setJamPelajaran(jamRes.data[0].id_jam);
    }
    fetchMaster();
  }, []);

  const loadRiwayat = useCallback(async () => {
    setLoadingRiwayat(true);
    let query = supabase.from('jurnal_guru').select('*').order('tanggal', { ascending: false }).order('jam_pelajaran').limit(20);
    if (user.role !== 'Admin') {
      query = query.eq('id_guru', user.id_user);
    }
    const { data } = await query;
    setRiwayat(data || []);
    setLoadingRiwayat(false);
  }, [user]);

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

  useEffect(() => { loadRiwayat(); }, [loadRiwayat]);
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
      nama_guru: user.nama,
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
      loadRiwayat();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-white">Jurnal Mengajar</h2>
          <p className="text-white/40 text-sm mt-1">Catat aktivitas belajar mengajar</p>
        </div>
        <button onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 rounded-xl text-sm font-medium transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0v3.396c0 .63.508 1.141 1.141 1.141h8.218c.633 0 1.141-.51 1.141-1.141V8.25Z" />
          </svg>
          Print Laporan
        </button>
      </div>

      {user.role !== 'Admin' && (
        <div className="bg-white/5 border border-white/5 rounded-2xl p-6 space-y-6 print:hidden relative">
          {isHoliday && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-amber-300 text-sm flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>Peringatan: Tanggal ini adalah hari libur (<strong>{holidayName}</strong>).</span>
            </div>
          )}
          {editId && (
            <div className="flex items-center justify-between bg-blue-500/10 border border-blue-500/30 rounded-xl px-4 py-3 text-blue-300 text-sm">
              <span>Sedang mengedit jurnal.</span>
              <button onClick={() => { setEditId(null); setMateri(''); }} className="text-blue-200 hover:text-white underline text-xs">Batal Edit</button>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs text-white/50 uppercase tracking-wider font-medium">Tanggal</label>
              <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-blue-400/50" />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-white/50 uppercase tracking-wider font-medium">Jam Pelajaran</label>
              <select value={jamPelajaran} onChange={e => setJamPelajaran(e.target.value)}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-blue-400/50">
                {jamOptions.map(j => (
                  <option key={j.id_jam} value={j.id_jam} className="bg-slate-900">
                    {j.nama_jam} ({j.waktu_mulai}-{j.waktu_selesai})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-white/50 uppercase tracking-wider font-medium">Rombel</label>
              <select value={rombel} onChange={e => setRombel(e.target.value)}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-blue-400/50">
                <option value="" className="bg-slate-900">Pilih Rombel</option>
                {rombelOptions.map(r => (
                  <option key={r} value={r} className="bg-slate-900">{r}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-white/50 uppercase tracking-wider font-medium">Mata Pelajaran</label>
              <select value={mapel} onChange={e => setMapel(e.target.value)}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-blue-400/50">
                <option value="" className="bg-slate-900">Pilih Mapel</option>
                {mapelOptions.map(m => (
                  <option key={m.id_mapel} value={m.nama_mapel} className="bg-slate-900">{m.nama_mapel}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-white/50 uppercase tracking-wider font-medium">Materi / Catatan</label>
            <textarea value={materi} onChange={e => setMateri(e.target.value)} rows={3} placeholder="Tuliskan materi yang diajarkan..."
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-blue-400/50 resize-none" />
          </div>

          {message && (
            <div className={`px-4 py-3 rounded-xl text-sm ${
              message.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' : 'bg-red-500/10 border border-red-500/30 text-red-300'
            }`}>{message.text}</div>
          )}

          <button onClick={handleSave} disabled={saving}
            className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 transition-all disabled:opacity-50">
            {saving ? 'Menyimpan...' : (editId ? 'Perbarui Jurnal' : 'Simpan Jurnal')}
          </button>
        </div>
      )}

      {/* Riwayat */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Riwayat Jurnal Terbaru</h3>
        {loadingRiwayat ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : riwayat.length === 0 ? (
          <div className="text-center py-8 text-white/30 text-sm">Belum ada jurnal</div>
        ) : (
          <div className="space-y-3">
            {riwayat.map(j => (
              <div key={j.id} className="bg-white/5 border border-white/5 rounded-xl p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-white font-medium text-sm">{j.tanggal}</span>
                    <span className="text-white/40 text-xs ml-2">{j.jam_pelajaran}</span>
                  </div>
                  {user.role !== 'Admin' && (
                    <button onClick={() => handleEdit(j)} className="text-blue-400 hover:text-blue-300 text-xs font-medium">Edit</button>
                  )}
                </div>
                <div className="flex gap-2 text-xs">
                  <span className="px-2 py-1 bg-blue-500/10 text-blue-300 rounded-md">{j.rombel}</span>
                  <span className="px-2 py-1 bg-indigo-500/10 text-indigo-300 rounded-md">{j.mata_pelajaran}</span>
                </div>
                {j.materi_catatan && j.materi_catatan !== '-' && (
                  <p className="text-white/50 text-xs">{j.materi_catatan}</p>
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
