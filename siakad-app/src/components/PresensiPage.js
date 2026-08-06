'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export default function PresensiPage() {
  const { user } = useAuth();
  const [tanggal, setTanggal] = useState(() => new Date().toISOString().split('T')[0]);
  const [rombel, setRombel] = useState(user?.rombel || '');
  const [muridList, setMuridList] = useState([]);
  const [absensi, setAbsensi] = useState({});
  const [nfcData, setNfcData] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [rombelOptions, setRombelOptions] = useState([]);
  
  // New features
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('Semua');
  const [isHoliday, setIsHoliday] = useState(false);
  const [holidayName, setHolidayName] = useState('');

  // Ambil daftar rombel
  useEffect(() => {
    async function fetchRombel() {
      const { data } = await supabase.from('master_user').select('rombel').eq('role', 'Murid');
      if (data) {
        const unique = [...new Set(data.map(d => d.rombel).filter(Boolean))].sort();
        setRombelOptions(unique);
        if (!rombel && unique.length > 0) setRombel(user?.rombel && user.rombel !== '-' ? user.rombel : unique[0]);
      }
    }
    fetchRombel();
  }, [user, rombel]);

  // Ambil data murid + NFC + absensi existing
  const loadData = useCallback(async () => {
    if (!rombel || !tanggal) return;
    setLoading(true);
    setMessage(null);
    setIsHoliday(false);
    setHolidayName('');

    // Cek Hari Libur
    const d = new Date(tanggal);
    if (d.getDay() === 0) {
      setIsHoliday(true);
      setHolidayName('Hari Minggu');
      setLoading(false);
      return;
    }
    const { data: libur } = await supabase.from('master_libur').select('*').eq('tanggal', tanggal).single();
    if (libur) {
      setIsHoliday(true);
      setHolidayName(libur.keterangan);
      setLoading(false);
      return;
    }

    // Murid
    const { data: murid } = await supabase
      .from('master_user')
      .select('*')
      .eq('rombel', rombel)
      .eq('role', 'Murid')
      .eq('status_aktif', 'Aktif')
      .order('nama');

    // NFC data hari ini
    const { data: nfc } = await supabase
      .from('data_nfc_murid')
      .select('*')
      .eq('tanggal', tanggal)
      .eq('rombel', rombel);

    // Absensi existing
    const { data: existing } = await supabase
      .from('data_absensi')
      .select('*')
      .eq('tanggal', tanggal)
      .eq('rombel', rombel);

    const nfcMap = {};
    (nfc || []).forEach(n => { nfcMap[n.nisn] = n; });

    const absensiMap = {};
    (existing || []).forEach(a => {
      absensiMap[a.nisn] = { status: a.status, catatan: a.catatan || '' };
    });

    // Merge: NFC hadir otomatis, existing override, default Hadir
    const mergedAbsensi = {};
    (murid || []).forEach(m => {
      if (absensiMap[m.id_user]) {
        mergedAbsensi[m.id_user] = absensiMap[m.id_user];
      } else if (nfcMap[m.id_user]) {
        mergedAbsensi[m.id_user] = { status: 'Hadir', catatan: `NFC: ${nfcMap[m.id_user].jam_datang || '-'}` };
      } else {
        mergedAbsensi[m.id_user] = { status: 'Hadir', catatan: '' };
      }
    });

    setMuridList(murid || []);
    setNfcData(nfcMap);
    setAbsensi(mergedAbsensi);
    setLoading(false);
  }, [rombel, tanggal]);

  // eslint-disable-next-line
  useEffect(() => { loadData(); }, [loadData]);

  const handleStatusChange = (nisn, status) => {
    setAbsensi(prev => ({ ...prev, [nisn]: { ...prev[nisn], status } }));
  };

  const handleCatatanChange = (nisn, catatan) => {
    setAbsensi(prev => ({ ...prev, [nisn]: { ...prev[nisn], catatan } }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    const rows = muridList.map(m => ({
      tanggal,
      rombel,
      nisn: m.id_user,
      status: absensi[m.id_user]?.status || 'Hadir',
      catatan: absensi[m.id_user]?.catatan || '-',
      pencatat: user.nama,
      metode: nfcData[m.id_user] ? 'NFC' : 'Manual',
    }));

    const { error } = await supabase
      .from('data_absensi')
      .upsert(rows, { onConflict: 'tanggal,nisn' });

    setSaving(false);
    if (error) {
      setMessage({ type: 'error', text: 'Gagal menyimpan: ' + error.message });
    } else {
      setMessage({ type: 'success', text: `Presensi ${rombel} tanggal ${tanggal} berhasil disimpan!` });
    }
  };

  const statusOptions = ['Hadir', 'Sakit', 'Izin', 'Alfa', 'Dispen'];
  const statusColors = {
    Hadir: 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
    Sakit: 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
    Izin: 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20',
    Alfa: 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20',
    Dispen: 'bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20',
  };
  const activeStatusColors = {
    Semua: 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 border-transparent shadow-md',
    Hadir: 'bg-emerald-500 text-white border-transparent shadow-md shadow-emerald-500/20',
    Sakit: 'bg-amber-500 text-white border-transparent shadow-md shadow-amber-500/20',
    Izin: 'bg-blue-500 text-white border-transparent shadow-md shadow-blue-500/20',
    Alfa: 'bg-rose-500 text-white border-transparent shadow-md shadow-rose-500/20',
    Dispen: 'bg-purple-500 text-white border-transparent shadow-md shadow-purple-500/20',
  };

  const summary = statusOptions.reduce((acc, s) => {
    acc[s] = Object.values(absensi).filter(a => a.status === s).length;
    return acc;
  }, {});

  const filteredMurid = muridList.filter(m => {
    const matchSearch = m.nama.toLowerCase().includes(searchQuery.toLowerCase()) || m.id_user.includes(searchQuery);
    const matchStatus = filterStatus === 'Semua' || absensi[m.id_user]?.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-white tracking-tight">Presensi Murid</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Catat kehadiran harian murid secara efisien</p>
        </div>
      </div>

      <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-3xl p-4 sm:p-6 shadow-sm">
        {/* Filter Tanggal & Rombel */}
        <div className="flex flex-wrap gap-4 mb-4">
          <input
            type="date"
            value={tanggal}
            onChange={e => setTanggal(e.target.value)}
            className="px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-sm"
          />
          <select
            value={rombel}
            onChange={e => setRombel(e.target.value)}
            className="px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-sm"
          >
            {rombelOptions.map(r => (
              <option key={r} value={r} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{r}</option>
            ))}
          </select>
        </div>

        {/* Filter Search & Status */}
        {!isHoliday && muridList.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between pt-4 border-t border-slate-200 dark:border-white/10">
            <input
              type="text"
              placeholder="Cari nama / NISN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:max-w-xs px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-sm"
            />
            <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 hide-scrollbar">
              {['Semua', ...statusOptions].map(s => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                    filterStatus === s 
                      ? activeStatusColors[s]
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Summary Bar */}
      {muridList.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {statusOptions.map(s => (
            <span key={s} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border shadow-sm ${statusColors[s]}`}>
              {s}: {summary[s]}
            </span>
          ))}
        </div>
      )}

      {/* Message */}
      {message && (
        <div className={`px-4 py-3 rounded-xl text-sm font-medium shadow-sm animate-in fade-in slide-in-from-top-2 ${
          message.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-300' : 'bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-300'
        }`}>
          {message.text}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : isHoliday ? (
        <div className="text-center py-12 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
          <svg className="w-12 h-12 text-amber-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
          </svg>
          <h3 className="text-amber-400 font-semibold text-lg">{holidayName}</h3>
          <p className="text-amber-300/70 text-sm mt-1">Presensi ditutup pada hari libur.</p>
        </div>
      ) : muridList.length === 0 ? (
        <div className="text-center py-12 text-slate-600 dark:text-white/30">Tidak ada murid di rombel ini</div>
      ) : filteredMurid.length === 0 ? (
        <div className="text-center py-12 text-slate-600 dark:text-white/30">Tidak ada murid yang cocok dengan pencarian/filter</div>
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-slate-200 dark:border-white/10 bg-white/50 dark:bg-slate-900/40 backdrop-blur-md shadow-sm">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-white/5 border-b border-slate-200 dark:border-white/10">
                <th className="px-5 py-4 text-slate-500 dark:text-slate-400 font-semibold text-xs uppercase tracking-wider">No</th>
                <th className="px-5 py-4 text-slate-500 dark:text-slate-400 font-semibold text-xs uppercase tracking-wider">NISN</th>
                <th className="px-5 py-4 text-slate-500 dark:text-slate-400 font-semibold text-xs uppercase tracking-wider">Nama</th>
                <th className="px-5 py-4 text-slate-500 dark:text-slate-400 font-semibold text-xs uppercase tracking-wider">NFC</th>
                <th className="px-5 py-4 text-slate-500 dark:text-slate-400 font-semibold text-xs uppercase tracking-wider text-center">Status</th>
                <th className="px-5 py-4 text-slate-500 dark:text-slate-400 font-semibold text-xs uppercase tracking-wider">Catatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {filteredMurid.map((m, idx) => (
                <tr key={m.id_user} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors group">
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{idx + 1}</td>
                  <td className="px-5 py-3 text-slate-400 dark:text-slate-500 font-mono text-xs">{m.id_user}</td>
                  <td className="px-5 py-3 text-slate-800 dark:text-white font-medium">{m.nama}</td>
                  <td className="px-5 py-3">
                    {nfcData[m.id_user] ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold shadow-sm">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                        {nfcData[m.id_user].jam_datang || 'Tap'}
                      </span>
                    ) : (
                      <span className="text-slate-300 dark:text-slate-600 text-xs">-</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-1.5 justify-center">
                      {statusOptions.map(s => (
                        <button
                          key={s}
                          onClick={() => handleStatusChange(m.id_user, s)}
                          className={`w-8 h-8 rounded-lg text-xs font-bold border transition-all flex items-center justify-center ${
                            absensi[m.id_user]?.status === s
                              ? activeStatusColors[s]
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 text-slate-400 dark:text-slate-500 hover:border-emerald-300 dark:hover:border-emerald-500/50 hover:text-emerald-500 shadow-sm'
                          }`}
                          title={s}
                        >
                          {s.charAt(0)}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <input
                      type="text"
                      value={absensi[m.id_user]?.catatan || ''}
                      onChange={e => handleCatatanChange(m.id_user, e.target.value)}
                      placeholder="Tambahkan catatan..."
                      className="w-full bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-white/20 focus:border-emerald-500 dark:focus:border-emerald-500 text-slate-700 dark:text-white/80 text-xs py-1.5 px-1 focus:outline-none transition-colors"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Save Button */}
      {!isHoliday && muridList.length > 0 && (
        <div className="sticky bottom-4 z-20 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full sm:w-auto px-8 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl shadow-lg shadow-emerald-600/25 hover:shadow-emerald-500/40 transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:transform-none disabled:shadow-none flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                Menyimpan...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" /></svg>
                Simpan Presensi
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
