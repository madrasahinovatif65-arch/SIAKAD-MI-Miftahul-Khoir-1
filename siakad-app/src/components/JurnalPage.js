'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import useSWR from 'swr';
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { id } from 'date-fns/locale/id';

registerLocale('id', id);
export default function JurnalPage() {
  const { user } = useAuth();
  const [tanggal, setTanggal] = useState(() => new Date().toISOString().split('T')[0]);
  const [jamPelajaran, setJamPelajaran] = useState('');
  const [jamMulai, setJamMulai] = useState('');
  const [jamSelesai, setJamSelesai] = useState('');
  const [rombel, setRombel] = useState(user?.rombel !== '-' ? user?.rombel : '');
  const [mapel, setMapel] = useState('');
  const [materi, setMateri] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [isHoliday, setIsHoliday] = useState(false);
  const [holidayName, setHolidayName] = useState('');
  const [editId, setEditId] = useState(null);
  const [absensiMapel, setAbsensiMapel] = useState({});

  const { data: siswaData, isLoading: loadingSiswa } = useSWR(rombel && tanggal ? `siswa_absen_${rombel}_${tanggal}` : null, async () => {
    // Ambil murid
    const { data: murid } = await supabase.from('master_user').select('id_user, nama').eq('role', 'Murid').eq('rombel', rombel).order('nama');
    
    // Ambil absen harian pagi ini
    const { data: absenHarian } = await supabase.from('data_absensi').select('nisn, status').eq('tanggal', tanggal).eq('rombel', rombel);
    
    const absenMap = {};
    (absenHarian || []).forEach(a => absenMap[a.nisn] = a.status);

    return { murid: murid || [], absenMap };
  });

  const { data: editAbsensiMapel } = useSWR(editId ? `edit_absensi_mapel_${editId}` : null, async () => {
    const { data } = await supabase.from('data_absensi_mapel').select('nisn, status').eq('id_jurnal', editId);
    return data || [];
  });

  useEffect(() => {
    if (siswaData) {
      const draft = {};
      siswaData.murid.forEach(m => {
        draft[m.id_user] = 'Hadir'; // default
      });

      if (editId && editAbsensiMapel) {
         editAbsensiMapel.forEach(a => draft[a.nisn] = a.status);
         setAbsensiMapel(draft);
      } else if (!editId) {
         // Auto fill
         siswaData.murid.forEach(m => {
           draft[m.id_user] = siswaData.absenMap[m.id_user] || 'Hadir';
         });
         setAbsensiMapel(draft);
      }
    }
  }, [siswaData, editId, editAbsensiMapel]);

  const handleStatusChange = (id_user, status) => {
    setAbsensiMapel(prev => ({...prev, [id_user]: status}));
  };

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
    if (!jamPelajaran && jamOptions.length > 0) {
      setJamPelajaran(jamOptions[0].id_jam);
      setJamMulai(jamOptions[0].waktu_mulai);
      setJamSelesai(jamOptions[0].waktu_selesai);
    }
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
    if (jamId) {
      setJamPelajaran(jamId);
      const match = j.jam_pelajaran.match(/\((.*?)-(.*?)\)/);
      if (match) {
        setJamMulai(match[1]);
        setJamSelesai(match[2]);
      } else {
        const jamObj = jamOptions.find(opt => opt.id_jam === jamId);
        setJamMulai(jamObj?.waktu_mulai || '');
        setJamSelesai(jamObj?.waktu_selesai || '');
      }
    }
    
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
      jam_pelajaran: jamObj ? `${jamObj.nama_jam} (${jamMulai || jamObj.waktu_mulai}-${jamSelesai || jamObj.waktu_selesai})` : jamPelajaran,
      id_guru: user.id_user,
      rombel,
      mata_pelajaran: mapel,
      materi_catatan: materi || '-',
    };

    let error;
    let jurnalId = editId;

    if (editId) {
      const { error: updateError } = await supabase.from('jurnal_guru').update(payload).eq('id', editId);
      error = updateError;
    } else {
      const { data: insertedJurnal, error: insertError } = await supabase.from('jurnal_guru').insert(payload).select('id').single();
      error = insertError;
      jurnalId = insertedJurnal?.id;
    }

    if (!error && jurnalId) {
      if (editId) {
        await supabase.from('data_absensi_mapel').delete().eq('id_jurnal', editId);
      }
      
      const mapelPayload = [];
      Object.entries(absensiMapel).forEach(([nisn, status]) => {
         if (status !== 'Hadir') {
           mapelPayload.push({
             id_jurnal: jurnalId,
             nisn,
             status,
             catatan: '-'
           });
         }
      });
      if (mapelPayload.length > 0) {
         await supabase.from('data_absensi_mapel').insert(mapelPayload);
      }
    }

    setSaving(false);
    if (error) {
      setMessage({ type: 'error', text: 'Gagal menyimpan: ' + error.message });
    } else {
      setMessage({ type: 'success', text: editId ? 'Jurnal & Absensi Mapel berhasil diperbarui!' : 'Jurnal & Absensi Mapel berhasil disimpan!' });
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
              <div className="relative">
                <DatePicker
                  selected={new Date(tanggal)}
                  onChange={(date) => {
                    if (date) {
                      const y = date.getFullYear();
                      const m = String(date.getMonth() + 1).padStart(2, '0');
                      const d = String(date.getDate()).padStart(2, '0');
                      setTanggal(`${y}-${m}-${d}`);
                    }
                  }}
                  dateFormat="dd-MM-yyyy"
                  locale="id"
                  todayButton="Hari Ini"
                  wrapperClassName="w-full"
                  className="w-full pl-4 pr-10 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-white text-sm text-left font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-sm relative z-50"
                  portalId="root-portal"
                />
                <svg className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-50" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z" />
                </svg>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Jam Pelajaran</label>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <select value={jamPelajaran} onChange={e => {
                      setJamPelajaran(e.target.value);
                      const j = jamOptions.find(o => o.id_jam === e.target.value);
                      if (j) {
                        setJamMulai(j.waktu_mulai);
                        setJamSelesai(j.waktu_selesai);
                      }
                    }}
                    style={{ backgroundImage: 'none' }}
                    className="appearance-none w-full pl-4 pr-10 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-sm">
                    {jamOptions.map(j => (
                      <option key={j.id_jam} value={j.id_jam} className="bg-white dark:bg-slate-900">
                        {j.nama_jam}
                      </option>
                    ))}
                  </select>
                  <svg className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>
                <div className="flex gap-2">
                  <input type="time" value={jamMulai} onChange={e => setJamMulai(e.target.value)}
                    className="w-24 pl-3 pr-2 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-sm" />
                  <span className="self-center text-slate-400 font-bold">-</span>
                  <input type="time" value={jamSelesai} onChange={e => setJamSelesai(e.target.value)}
                    className="w-24 pl-3 pr-2 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-sm" />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Rombel</label>
              <div className="relative">
                <select value={rombel} onChange={e => setRombel(e.target.value)}
                  style={{ backgroundImage: 'none' }}
                  className="appearance-none w-full pl-4 pr-10 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-sm">
                  <option value="" className="bg-white dark:bg-slate-900 text-slate-400">Pilih Rombel</option>
                  {rombelOptions.map(r => (
                    <option key={r} value={r} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{r}</option>
                  ))}
                </select>
                <svg className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Mata Pelajaran</label>
              <div className="relative">
                <select value={mapel} onChange={e => setMapel(e.target.value)}
                  style={{ backgroundImage: 'none' }}
                  className="appearance-none w-full pl-4 pr-10 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-sm">
                  <option value="" className="bg-white dark:bg-slate-900 text-slate-400">Pilih Mapel</option>
                  {mapelOptions.map(m => (
                    <option key={m.id_mapel} value={m.nama_mapel} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{m.nama_mapel}</option>
                  ))}
                </select>
                <svg className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Materi / Catatan</label>
            <textarea value={materi} onChange={e => setMateri(e.target.value)} rows={3} placeholder="Tuliskan materi yang diajarkan dengan detail..."
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-sm resize-none" />
          </div>

          {/* Tabel Absen Mapel */}
          {rombel && siswaData && !isHoliday && (
            <div className="space-y-3 mt-6">
              <h3 className="text-sm text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Absensi Kelas (Mapel)</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Pilih absensi jika ada murid yang bolos pelajaran Anda (otomatis diisi sesuai absen harian pagi).</p>
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left block md:table">
                    <thead className="hidden md:table-header-group">
                      <tr className="bg-slate-100 dark:bg-white/5 border-b border-slate-200 dark:border-white/10">
                        <th className="px-5 py-4 font-bold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">No</th>
                        <th className="px-5 py-4 font-bold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Nama</th>
                        <th className="px-5 py-4 font-bold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="block md:table-row-group divide-y divide-transparent md:divide-slate-100 md:dark:divide-white/5">
                      {loadingSiswa ? (
                        <tr><td colSpan={3} className="px-5 py-4 text-center text-sm text-slate-500">Memuat data murid...</td></tr>
                      ) : siswaData.murid.length === 0 ? (
                        <tr><td colSpan={3} className="px-5 py-4 text-center text-sm text-slate-500">Belum ada data murid di rombel ini</td></tr>
                      ) : (
                        siswaData.murid.map((m, idx) => {
                           const currentStatus = absensiMapel[m.id_user] || 'Hadir';
                           return (
                             <tr key={m.id_user} className="block md:table-row bg-white md:bg-transparent dark:bg-slate-800/40 md:dark:bg-transparent mb-4 md:mb-0 rounded-2xl md:rounded-none border border-slate-100 dark:border-white/5 md:border-none shadow-sm md:shadow-none hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                               <td className="hidden md:table-cell px-5 py-3 text-slate-500 dark:text-slate-400">{idx + 1}</td>
                               <td className="block md:table-cell px-4 py-3 md:px-5 md:py-3 border-b border-slate-50 dark:border-white/5 md:border-none">
                                 <div>
                                   <div className="text-slate-800 dark:text-white font-medium">
                                     <span className="md:hidden mr-1.5 text-slate-400">{idx + 1}.</span>
                                     {m.nama}
                                   </div>
                                   <div className="text-slate-400 dark:text-slate-500 font-mono text-xs mt-0.5">{m.id_user}</div>
                                 </div>
                               </td>
                               <td className="block md:table-cell px-4 py-3 md:px-5 md:py-3 md:border-none">
                                 <div className="flex flex-col gap-2">
                                   <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider md:hidden">Status Presensi</span>
                                   <div className="flex gap-2 justify-between md:justify-center">
                                      {['Hadir', 'Sakit', 'Izin', 'Alfa'].map(s => (
                                        <button key={s} onClick={() => handleStatusChange(m.id_user, s)}
                                           className={`flex-1 md:flex-none md:w-auto md:px-3 h-8 md:h-8 rounded-lg text-xs font-bold border transition-all flex items-center justify-center ${currentStatus === s ? (s === 'Hadir' ? 'bg-emerald-500 border-emerald-500 text-white shadow-md' : s === 'Sakit' ? 'bg-amber-500 border-amber-500 text-white shadow-md' : s === 'Izin' ? 'bg-blue-500 border-blue-500 text-white shadow-md' : 'bg-rose-500 border-rose-500 text-white shadow-md') : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 text-slate-400 dark:text-slate-500 hover:border-emerald-300 dark:hover:border-emerald-500/50 hover:text-emerald-500 shadow-sm'}`}>
                                           <span className="md:hidden">{s}</span>
                                           <span className="hidden md:inline">{s}</span>
                                        </button>
                                      ))}
                                   </div>
                                 </div>
                               </td>
                             </tr>
                           );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {message && (
            <div className={`px-4 py-3 rounded-2xl text-sm font-medium shadow-sm animate-in fade-in slide-in-from-top-2 mb-6 ${
              message.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-300' : 'bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-300'
            }`}>{message.text}</div>
          )}

          {!isHoliday && (
            <div className="fixed md:sticky bottom-6 md:bottom-4 left-4 right-4 md:left-auto md:right-auto z-50 md:z-20 flex justify-end pointer-events-none mt-6 print:hidden">
              <button onClick={handleSave} disabled={saving}
                className="pointer-events-auto w-full sm:w-auto px-8 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl shadow-xl shadow-emerald-600/30 hover:shadow-emerald-500/40 transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:transform-none disabled:shadow-none flex items-center justify-center gap-2">
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
          )}
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
