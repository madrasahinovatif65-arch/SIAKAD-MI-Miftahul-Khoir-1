'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export default function RiwayatMuridPage() {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bulan, setBulan] = useState(() => new Date().toISOString().slice(0, 7));
  const [filterStatus, setFilterStatus] = useState('Semua');

  const loadData = useCallback(async () => {
    setLoading(true);
    const startDate = `${bulan}-01`;
    const endDate = `${bulan}-31`;

    // Ambil dari data_absensi
    const { data: absensi } = await supabase
      .from('data_absensi')
      .select('*')
      .eq('nisn', user.id_user)
      .gte('tanggal', startDate)
      .lte('tanggal', endDate)
      .order('tanggal', { ascending: false });

    // Ambil dari data_nfc_murid
    const { data: nfc } = await supabase
      .from('data_nfc_murid')
      .select('*')
      .eq('nisn', user.id_user)
      .gte('tanggal', startDate)
      .lte('tanggal', endDate)
      .order('tanggal', { ascending: false });

    // Merge: absensi overrides NFC
    const absenMap = {};
    (absensi || []).forEach(a => { absenMap[a.tanggal] = a; });

    const combined = [];
    (nfc || []).forEach(n => {
      if (!absenMap[n.tanggal]) {
        combined.push({
          tanggal: n.tanggal,
          status: 'Hadir',
          catatan: `NFC: ${n.jam_datang || '-'}${n.jam_pulang ? ' - ' + n.jam_pulang : ''}`,
          metode: 'NFC',
        });
      }
    });
    (absensi || []).forEach(a => combined.push({ ...a, metode: a.metode || 'Manual' }));
    combined.sort((a, b) => b.tanggal.localeCompare(a.tanggal));
    setData(combined);
    setLoading(false);
  }, [bulan, user]);

  useEffect(() => { loadData(); }, [loadData]);

  const statusColors = {
    'Hadir': 'bg-emerald-500/20 text-emerald-300',
    'Sakit': 'bg-amber-500/20 text-amber-300',
    'Izin': 'bg-blue-500/20 text-blue-300',
    'Alfa': 'bg-red-500/20 text-red-300',
    'Dispen': 'bg-purple-500/20 text-purple-300',
  };

  const summary = { Hadir: 0, Sakit: 0, Izin: 0, Alfa: 0, Dispen: 0 };
  data.forEach(d => { if (summary[d.status] !== undefined) summary[d.status]++; });
  const total = data.length;
  const persentase = total > 0 ? Math.round((summary.Hadir / total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Riwayat Absen Saya</h2>
          <p className="text-white/40 text-sm mt-1">{user.nama} · {user.rombel}</p>
        </div>
        <input type="month" value={bulan} onChange={e => setBulan(e.target.value)}
          className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-blue-400/50" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-emerald-600/20 to-emerald-800/20 border border-white/5 rounded-2xl p-5">
          <p className="text-white/50 text-xs">Kehadiran</p>
          <p className="text-3xl font-bold text-white mt-1">{persentase}%</p>
          <p className="text-white/30 text-xs mt-1">{summary.Hadir}/{total} hari</p>
        </div>
        <div className="bg-gradient-to-br from-amber-600/20 to-amber-800/20 border border-white/5 rounded-2xl p-5">
          <p className="text-white/50 text-xs">Sakit</p>
          <p className="text-3xl font-bold text-white mt-1">{summary.Sakit}</p>
        </div>
        <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 border border-white/5 rounded-2xl p-5">
          <p className="text-white/50 text-xs">Izin</p>
          <p className="text-3xl font-bold text-white mt-1">{summary.Izin}</p>
        </div>
        <div className="bg-gradient-to-br from-red-600/20 to-red-800/20 border border-white/5 rounded-2xl p-5">
          <p className="text-white/50 text-xs">Alfa</p>
          <p className="text-3xl font-bold text-white mt-1">{summary.Alfa}</p>
        </div>
      </div>

      {/* Filter Status */}
      {data.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 hide-scrollbar">
          {['Semua', 'Hadir', 'Sakit', 'Izin', 'Alfa', 'Dispen'].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                filterStatus === s 
                  ? (s === 'Semua' ? 'bg-blue-600 text-white' : statusColors[s].replace('bg-opacity-20', 'bg-opacity-100').replace('text-', 'text-white bg-').split(' ')[0] + ' text-white')
                  : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : data.length === 0 ? (
        <div className="text-center py-12 text-white/30 text-sm">Tidak ada data untuk bulan ini</div>
      ) : (
        <div className="space-y-2">
          {data
            .filter(d => filterStatus === 'Semua' || d.status === filterStatus)
            .map((row, idx) => (
            <div key={idx} className="bg-white/5 border border-white/5 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                <span className="text-white/60 font-mono text-xs w-24 shrink-0">{row.tanggal}</span>
                <span className={`px-2 py-1 rounded-md text-xs font-medium ${statusColors[row.status] || 'text-white/30'}`}>
                  {row.status}
                </span>
              </div>
              <div className="flex items-center gap-3 self-end sm:self-auto">
                {row.metode === 'NFC' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                    NFC
                  </span>
                ) : (
                  <span className="text-white/20 text-xs">Manual</span>
                )}
                <span className="text-white/40 text-xs max-w-[150px] sm:max-w-40 truncate" title={row.catatan || '-'}>{row.catatan || '-'}</span>
              </div>
            </div>
          ))}
          {data.filter(d => filterStatus === 'Semua' || d.status === filterStatus).length === 0 && (
            <div className="text-center py-8 text-white/30 text-sm">Tidak ada absensi dengan status {filterStatus}</div>
          )}
        </div>
      )}
    </div>
  );
}
