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
      const { data } = await supabase.from('master_murid').select('rombel');
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
      .from('master_murid')
      .select('*')
      .eq('rombel', rombel)
      .eq('status', 'Aktif')
      .order('nama_murid');

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
      if (absensiMap[m.nisn]) {
        mergedAbsensi[m.nisn] = absensiMap[m.nisn];
      } else if (nfcMap[m.nisn]) {
        mergedAbsensi[m.nisn] = { status: 'Hadir', catatan: `NFC: ${nfcMap[m.nisn].jam_datang || '-'}` };
      } else {
        mergedAbsensi[m.nisn] = { status: 'Hadir', catatan: '' };
      }
    });

    setMuridList(murid || []);
    setNfcData(nfcMap);
    setAbsensi(mergedAbsensi);
    setLoading(false);
  }, [rombel, tanggal]);

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
      nisn: m.nisn,
      status: absensi[m.nisn]?.status || 'Hadir',
      catatan: absensi[m.nisn]?.catatan || '-',
      pencatat: user.nama,
      metode: nfcData[m.nisn] ? 'NFC' : 'Manual',
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
    Hadir: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    Sakit: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    Izin: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    Alfa: 'bg-red-500/20 text-red-300 border-red-500/30',
    Dispen: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  };

  const summary = statusOptions.reduce((acc, s) => {
    acc[s] = Object.values(absensi).filter(a => a.status === s).length;
    return acc;
  }, {});

  const filteredMurid = muridList.filter(m => {
    const matchSearch = m.nama_murid.toLowerCase().includes(searchQuery.toLowerCase()) || m.nisn.includes(searchQuery);
    const matchStatus = filterStatus === 'Semua' || absensi[m.nisn]?.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Presensi Murid</h2>
        <p className="text-white/40 text-sm mt-1">Catat kehadiran harian murid</p>
      </div>

      {/* Filter Tanggal & Rombel */}
      <div className="flex flex-wrap gap-3">
        <input
          type="date"
          value={tanggal}
          onChange={e => setTanggal(e.target.value)}
          className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-blue-400/50"
        />
        <select
          value={rombel}
          onChange={e => setRombel(e.target.value)}
          className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-blue-400/50"
        >
          {rombelOptions.map(r => (
            <option key={r} value={r} className="bg-slate-900">{r}</option>
          ))}
        </select>
      </div>

      {/* Filter Search & Status */}
      {!isHoliday && muridList.length > 0 && (
        <div className="flex flex-wrap gap-3 items-center">
          <input
            type="text"
            placeholder="Cari nama / NISN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 min-w-[200px] px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-blue-400/50"
          />
          <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 hide-scrollbar">
            {['Semua', ...statusOptions].map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  filterStatus === s 
                    ? (s === 'Semua' ? 'bg-blue-600 text-white' : statusColors[s].replace('bg-opacity-20', 'bg-opacity-100').replace('text-', 'text-white bg-').split(' ')[0] + ' text-white border-transparent')
                    : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Summary Bar */}
      {muridList.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {statusOptions.map(s => (
            <span key={s} className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${statusColors[s]}`}>
              {s}: {summary[s]}
            </span>
          ))}
        </div>
      )}

      {/* Message */}
      {message && (
        <div className={`px-4 py-3 rounded-xl text-sm ${
          message.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' : 'bg-red-500/10 border border-red-500/30 text-red-300'
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
        <div className="text-center py-12 text-white/30">Tidak ada murid di rombel ini</div>
      ) : filteredMurid.length === 0 ? (
        <div className="text-center py-12 text-white/30">Tidak ada murid yang cocok dengan pencarian/filter</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/5">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/5">
                <th className="px-4 py-3 text-left text-white/50 font-medium">No</th>
                <th className="px-4 py-3 text-left text-white/50 font-medium">NISN</th>
                <th className="px-4 py-3 text-left text-white/50 font-medium">Nama</th>
                <th className="px-4 py-3 text-left text-white/50 font-medium">NFC</th>
                <th className="px-4 py-3 text-left text-white/50 font-medium">Status</th>
                <th className="px-4 py-3 text-left text-white/50 font-medium">Catatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredMurid.map((m, idx) => (
                <tr key={m.nisn} className="hover:bg-white/3 transition-colors">
                  <td className="px-4 py-3 text-white/40">{idx + 1}</td>
                  <td className="px-4 py-3 text-white/60 font-mono text-xs">{m.nisn}</td>
                  <td className="px-4 py-3 text-white font-medium">{m.nama_murid}</td>
                  <td className="px-4 py-3">
                    {nfcData[m.nisn] ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                        {nfcData[m.nisn].jam_datang || 'Tap'}
                      </span>
                    ) : (
                      <span className="text-white/20 text-xs">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {statusOptions.map(s => (
                        <button
                          key={s}
                          onClick={() => handleStatusChange(m.nisn, s)}
                          className={`px-2 py-1 rounded-md text-xs font-medium border transition-all ${
                            absensi[m.nisn]?.status === s
                              ? statusColors[s]
                              : 'border-white/5 text-white/20 hover:border-white/20 hover:text-white/40'
                          }`}
                        >
                          {s.charAt(0)}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={absensi[m.nisn]?.catatan || ''}
                      onChange={e => handleCatatanChange(m.nisn, e.target.value)}
                      placeholder="-"
                      className="w-full bg-transparent border-b border-white/10 text-white/70 text-xs py-1 focus:outline-none focus:border-blue-400/50"
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
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 transition-all disabled:opacity-50"
        >
          {saving ? 'Menyimpan...' : 'Simpan Presensi'}
        </button>
      )}
    </div>
  );
}
