'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export default function RiwayatGuruPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bulan, setBulan] = useState(() => new Date().toISOString().slice(0, 7)); // YYYY-MM

  const loadData = useCallback(async () => {
    setLoading(true);
    const startDate = `${bulan}-01`;
    const endDate = `${bulan}-31`;

    if (isAdmin) {
      // Admin: lihat semua guru
      const { data: verData } = await supabase
        .from('verifikasi_gps_guru')
        .select('*')
        .gte('tanggal', startDate)
        .lte('tanggal', endDate)
        .order('tanggal', { ascending: false });
      setData(verData || []);
    } else {
      // Guru: lihat riwayat sendiri
      const { data: verData } = await supabase
        .from('verifikasi_gps_guru')
        .select('*')
        .eq('id_guru', user.id_user)
        .gte('tanggal', startDate)
        .lte('tanggal', endDate)
        .order('tanggal', { ascending: false });
      
      // Juga cek NFC
      const { data: nfcData } = await supabase
        .from('nfc_guru')
        .select('*')
        .eq('id_guru', user.id_user)
        .gte('tanggal', startDate)
        .lte('tanggal', endDate)
        .order('tanggal', { ascending: false });

      const verMap = {};
      (verData || []).forEach(v => { verMap[v.tanggal] = v; });

      const combined = [];
      // Tambahkan NFC yang belum ada di verifikasi
      (nfcData || []).forEach(n => {
        if (!verMap[n.tanggal]) {
          combined.push({
            tanggal: n.tanggal,
            nama_guru: n.nama_guru,
            waktu: n.jam_datang || '-',
            status: 'Hadir',
            metode: 'NFC',
            catatan: n.jam_pulang ? `Pulang: ${n.jam_pulang}` : '-',
          });
        }
      });
      // Tambahkan verifikasi
      (verData || []).forEach(v => combined.push(v));
      combined.sort((a, b) => b.tanggal.localeCompare(a.tanggal));
      setData(combined);
    }
    setLoading(false);
  }, [bulan, isAdmin, user]);

  useEffect(() => { loadData(); }, [loadData]);

  const handlePrint = () => {
    window.print();
  };

  const statusColors = {
    'Hadir': 'bg-emerald-500/20 text-emerald-300',
    'Sakit': 'bg-amber-500/20 text-amber-300',
    'Izin': 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
    'Alfa': 'bg-red-500/20 text-red-600 dark:text-red-300',
    'Dinas Luar': 'bg-purple-500/20 text-purple-300',
  };

  // Summary
  const summary = { Hadir: 0, Sakit: 0, Izin: 0, Alfa: 0, 'Dinas Luar': 0 };
  data.forEach(d => { if (summary[d.status] !== undefined) summary[d.status]++; });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4 print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            {isAdmin ? 'Riwayat Semua Guru' : 'Riwayat Absen Saya'}
          </h2>
          <p className="text-slate-600 dark:text-white/40 text-sm mt-1">
            {isAdmin ? 'Rekap absensi seluruh guru' : 'Riwayat kehadiran Anda'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600/40 rounded-xl text-sm font-medium transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0v3.396c0 .63.508 1.141 1.141 1.141h8.218c.633 0 1.141-.51 1.141-1.141V8.25Z" />
            </svg>
            Print
          </button>
          <input type="month" value={bulan} onChange={e => setBulan(e.target.value)}
            className="px-4 py-2 bg-white/50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-emerald-500/50" />
        </div>
      </div>

      {!isAdmin && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 print:hidden">
        {Object.entries(summary).map(([s, count]) => (
          <span key={s} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${statusColors[s]}`}>
            {s}: {count}
          </span>
        ))}
        <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-white/10 text-slate-600 dark:text-white/60">
          Total: {data.length}
        </span>
      </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : data.length === 0 ? (
        <div className="text-center py-12 text-slate-600 dark:text-white/30 text-sm">Tidak ada data untuk bulan ini</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-300 dark:border-white/5 print:visible">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white dark:bg-white/5 shadow-sm dark:shadow-none">
                <th className="px-4 py-3 text-left text-slate-600 dark:text-white/50 font-medium">Tanggal</th>
                {isAdmin && <th className="px-4 py-3 text-left text-slate-600 dark:text-white/50 font-medium">Nama</th>}
                <th className="px-4 py-3 text-left text-slate-600 dark:text-white/50 font-medium">Waktu</th>
                <th className="px-4 py-3 text-left text-slate-600 dark:text-white/50 font-medium">Metode</th>
                <th className="px-4 py-3 text-left text-slate-600 dark:text-white/50 font-medium">Status</th>
                <th className="px-4 py-3 text-left text-slate-600 dark:text-white/50 font-medium">Catatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.map((row, idx) => (
                <tr key={idx} className="hover:bg-white/3 transition-colors">
                  <td className="px-4 py-3 text-slate-700 dark:text-white/70 font-mono text-xs">{row.tanggal}</td>
                  {isAdmin && <td className="px-4 py-3 text-slate-900 dark:text-white font-medium">{row.nama_guru}</td>}
                  <td className="px-4 py-3 text-slate-600 dark:text-white/60 text-xs">{row.waktu}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-md text-xs ${
                      row.metode === 'NFC' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    }`}>{row.metode || 'GPS'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-md text-xs font-medium ${statusColors[row.status] || 'text-slate-600 dark:text-white/30'}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-white/40 text-xs">{row.catatan || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * { visibility: hidden; }
          .print\\:hidden { display: none !important; }
          .print\\:visible, .print\\:visible * { visibility: visible; }
          .print\\:visible { position: absolute; left: 0; top: 0; width: 100%; }
          table, table * { visibility: visible; }
          table { position: absolute; left: 0; top: 0; width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #000; padding: 8px; color: #000 !important; }
          th { background: #eee !important; -webkit-print-color-adjust: exact; }
          .text-slate-900 dark:text-white { color: #000 !important; }
          .text-slate-900 dark:text-white\\/50, .text-slate-900 dark:text-white\\/70 { color: #333 !important; }
        }
      `}} />
    </div>
  );
}
