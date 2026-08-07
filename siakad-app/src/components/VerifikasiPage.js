'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import useSWR from 'swr';

export default function VerifikasiPage() {
  const [tanggal, setTanggal] = useState(() => new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(null);
  const [message, setMessage] = useState(null);

  const statusOptions = ['Hadir', 'Sakit', 'Izin', 'Alfa', 'Dinas Luar'];
  const statusColors = {
    'Hadir': 'bg-emerald-500/20 text-emerald-300',
    'Sakit': 'bg-amber-500/20 text-amber-300',
    'Izin': 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
    'Alfa': 'bg-red-500/20 text-red-600 dark:text-red-300',
    'Dinas Luar': 'bg-purple-500/20 text-purple-300',
    'Menunggu Verifikasi': 'bg-yellow-500/20 text-yellow-300',
    'Di Luar Radius': 'bg-orange-500/20 text-orange-300',
  };

  const { data: swrData, isLoading: loading, mutate: reloadData } = useSWR(`verifikasi_${tanggal}`, async () => {
    // Ambil semua guru
    const { data: allGuru } = await supabase
      .from('master_user')
      .select('id_user, nama, role, rombel')
      .in('role', ['Wali Kelas', 'Guru Mapel'])
      .eq('status_aktif', 'Aktif')
      .order('nama');

    // Ambil log GPS hari ini
    const { data: gpsLogs } = await supabase
      .from('log_gps_guru')
      .select('*')
      .eq('tanggal', tanggal);

    // Ambil NFC hari ini
    const { data: nfcLogs } = await supabase
      .from('view_rekap_absensi_nfc')
      .select('*')
      .eq('tanggal', tanggal);

    // Ambil verifikasi yang sudah ada
    const { data: verified } = await supabase
      .from('verifikasi_gps_guru')
      .select('*')
      .eq('tanggal', tanggal);

    const gpsMap = {};
    (gpsLogs || []).forEach(g => { gpsMap[g.id_guru] = g; });
    const nfcMap = {};
    (nfcLogs || []).forEach(n => { nfcMap[n.id_user] = n; });
    const verMap = {};
    (verified || []).forEach(v => { verMap[v.id_guru] = v; });

    // Gabungkan data
    const merged = (allGuru || []).map(guru => {
      const gps = gpsMap[guru.id_user];
      const nfc = nfcMap[guru.id_user];
      const ver = verMap[guru.id_user];

      let metode = '-';
      let waktu = '-';
      let currentStatus = 'Belum Absen';
      let catatan = '';

      if (ver) {
        currentStatus = ver.status;
        waktu = ver.waktu;
        metode = ver.metode;
        catatan = ver.catatan || '';
      } else if (nfc) {
        currentStatus = 'Hadir';
        waktu = nfc.jam_datang || '-';
        metode = 'NFC';
        catatan = 'Auto-verified via NFC';
      } else if (gps) {
        currentStatus = gps.status;
        waktu = gps.waktu;
        metode = 'GPS';
        catatan = gps.jarak_meter ? `Jarak: ${gps.jarak_meter}m` : '';
      }

      return {
        ...guru,
        waktu,
        metode,
        currentStatus,
        catatan,
        isNFC: !!nfc,
        isVerified: !!ver,
        gpsData: gps,
        nfcData: nfc,
      };
    });

    return merged;
  });

  const data = swrData || [];

  const handleVerify = async (guru, newStatus) => {
    setSaving(guru.id_user);

    const { error } = await supabase.from('verifikasi_gps_guru').upsert({
      tanggal,
      id_guru: guru.id_user,
      nama_guru: guru.nama,
      waktu: guru.waktu || '-',
      status: newStatus,
      catatan: guru.catatan || '-',
      verifikator: 'Admin',
      metode: guru.metode,
    }, { onConflict: 'tanggal,id_guru' });

    setSaving(null);
    if (error) {
      setMessage({ type: 'error', text: 'Gagal: ' + error.message });
    } else {
      reloadData();
    }
  };

  const handleVerifyAll = async () => {
    const unverified = data.filter(d => !d.isVerified && (d.metode === 'GPS' || d.metode === 'NFC'));
    if (unverified.length === 0) return;

    setSaving('all');
    const rows = unverified.map(guru => ({
      tanggal,
      id_guru: guru.id_user,
      nama_guru: guru.nama,
      waktu: guru.waktu || '-',
      status: guru.isNFC ? 'Hadir' : (guru.currentStatus === 'Menunggu Verifikasi' ? 'Hadir' : guru.currentStatus),
      catatan: guru.catatan || '-',
      verifikator: 'Admin',
      metode: guru.metode,
    }));

    const { error } = await supabase.from('verifikasi_gps_guru').upsert(rows, { onConflict: 'tanggal,id_guru' });
    setSaving(null);
    if (error) {
      setMessage({ type: 'error', text: 'Gagal batch verify: ' + error.message });
    } else {
      setMessage({ type: 'success', text: `${rows.length} guru berhasil diverifikasi!` });
      reloadData();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Verifikasi Kehadiran Guru</h2>
          <p className="text-slate-600 dark:text-white/40 text-sm mt-1">Kelola dan verifikasi absensi guru</p>
        </div>
        <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)}
          className="px-4 py-2.5 bg-white/50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-emerald-500/50" />
      </div>

      {message && (
        <div className={`px-4 py-3 rounded-xl text-sm ${
          message.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' : 'bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-300'
        }`}>{message.text}</div>
      )}

      {/* Batch Verify */}
      <button onClick={handleVerifyAll} disabled={saving === 'all'}
        className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-900 dark:text-white font-medium text-sm rounded-xl shadow-lg transition-all disabled:opacity-50">
        {saving === 'all' ? 'Memproses...' : '✓ Verifikasi Semua'}
      </button>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-300 dark:border-white/5">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white dark:bg-white/5 shadow-sm dark:shadow-none">
                <th className="px-4 py-3 text-left text-slate-600 dark:text-white/50 font-medium">Nama</th>
                <th className="px-4 py-3 text-left text-slate-600 dark:text-white/50 font-medium">Role</th>
                <th className="px-4 py-3 text-left text-slate-600 dark:text-white/50 font-medium">Metode</th>
                <th className="px-4 py-3 text-left text-slate-600 dark:text-white/50 font-medium">Waktu</th>
                <th className="px-4 py-3 text-left text-slate-600 dark:text-white/50 font-medium">Status</th>
                <th className="px-4 py-3 text-left text-slate-600 dark:text-white/50 font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.map(guru => (
                <tr key={guru.id_user} className="hover:bg-white/3 transition-colors">
                  <td className="px-4 py-3 text-slate-900 dark:text-white font-medium">{guru.nama}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-white/50 text-xs">{guru.role}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                      guru.metode === 'NFC' ? 'bg-emerald-500/10 text-emerald-400' :
                      guru.metode === 'GPS' ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                      'text-slate-400 dark:text-white/20'
                    }`}>{guru.metode}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-white/60 font-mono text-xs">{guru.waktu}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-md text-xs font-medium ${statusColors[guru.currentStatus] || 'text-slate-600 dark:text-white/30'}`}>
                      {guru.currentStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {statusOptions.map(s => (
                        <button key={s} onClick={() => handleVerify(guru, s)}
                          disabled={saving === guru.id_user}
                          className={`px-2 py-1 rounded-md text-xs border transition-all ${
                            guru.currentStatus === s && guru.isVerified
                              ? statusColors[s] + ' border-transparent'
                              : 'border-slate-300 dark:border-white/10 text-slate-600 dark:text-white/30 hover:text-slate-600 dark:text-white/60 hover:border-slate-300 dark:border-white/20'
                          }`}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
