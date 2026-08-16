'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import * as XLSX from 'xlsx';
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { id } from 'date-fns/locale/id';
import { getTodayDate } from '@/lib/dateUtils';
import useSWR from 'swr';

registerLocale('id', id);

export default function BackupPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // Global Filters for Backup
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const [startDate, setStartDate] = useState(firstDayOfMonth);
  const [endDate, setEndDate] = useState(today);
  const [filterRombel, setFilterRombel] = useState('Semua');

  const { data: usersData } = useSWR('master_user_rombel', async () => {
    const { data } = await supabase.from('master_user').select('rombel');
    return data || [];
  });
  const rombelOptions = usersData ? [...new Set(usersData.map(d => d.rombel).filter(r => r && r !== '-'))].sort() : [];

  if (user?.role !== 'Admin') {
    return <div className="p-8 text-center text-red-500">Akses ditolak. Halaman ini khusus untuk Admin.</div>;
  }

  const exportExcel = (data, sheetName, fileName) => {
    if (!data || data.length === 0) {
      setMessage({ type: 'error', text: `Tidak ada data untuk diekspor pada ${sheetName}.` });
      return;
    }
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, fileName);
    setMessage({ type: 'success', text: `Berhasil mengunduh ${fileName}` });
  };

  const getFilterParams = () => {
    const startStr = startDate ? new Date(startDate.getTime() - (startDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0] : null;
    const endStr = endDate ? new Date(endDate.getTime() - (endDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0] : null;
    return { startStr, endStr, filterRombel };
  };

  // 1. Jurnal Mengajar
  const backupJurnal = async (isFiltered = true) => {
    setLoading(true); setMessage(null);
    try {
      const { startStr, endStr } = getFilterParams();
      let query = supabase.from('jurnal_guru').select('*, master_user(nama), data_absensi_mapel(status)');
      if (isFiltered && startStr && endStr) {
        query = query.gte('tanggal', startStr).lte('tanggal', endStr);
      }
      const { data, error } = await query;
      if (error) throw error;

      const formatted = data.map((item, i) => {
        let sakit = 0, izin = 0, alfa = 0;
        if (item.data_absensi_mapel) {
          item.data_absensi_mapel.forEach(a => {
            if (a.status === 'Sakit') sakit++;
            if (a.status === 'Izin') izin++;
            if (a.status === 'Alfa') alfa++;
          });
        }
        return {
          'No': i + 1, 'Tanggal': item.tanggal, 'Jam Ke': item.jam_pelajaran,
          'Nama Guru': item.master_user?.nama || '-', 'Rombel': item.rombel,
          'Mata Pelajaran': item.mata_pelajaran, 'Materi': item.materi,
          'Sakit': sakit, 'Izin': izin, 'Alfa': alfa
        };
      });
      exportExcel(formatted, 'Jurnal', `Backup_Jurnal_${isFiltered ? 'Filtered' : 'Semua'}.xlsx`);
    } catch (err) { setMessage({ type: 'error', text: err.message }); }
    setLoading(false);
  };

  // 2. Absensi Harian
  const backupAbsensiHarian = async (isFiltered = true) => {
    setLoading(true); setMessage(null);
    try {
      const { startStr, endStr, filterRombel } = getFilterParams();
      let query = supabase.from('view_rekap_kehadiran_murid_final').select('*');
      if (isFiltered) {
        if (startStr && endStr) query = query.gte('tanggal', startStr).lte('tanggal', endStr);
        if (filterRombel !== 'Semua') query = query.eq('rombel', filterRombel);
      }
      const { data, error } = await query;
      if (error) throw error;

      const acc = {};
      data.forEach(d => {
        if (!acc[d.id_murid]) {
          acc[d.id_murid] = { Nama: d.nama, Rombel: d.rombel, Hadir: 0, Sakit: 0, Izin: 0, Alfa: 0 };
        }
        if (d.status) acc[d.id_murid][d.status]++;
      });

      const formatted = Object.values(acc).map((item, i) => ({
        'No': i + 1, ...item,
        'Total Hari': item.Hadir + item.Sakit + item.Izin + item.Alfa
      }));
      exportExcel(formatted, 'Absensi Harian', `Backup_AbsensiHarian_${isFiltered ? 'Filtered' : 'Semua'}.xlsx`);
    } catch (err) { setMessage({ type: 'error', text: err.message }); }
    setLoading(false);
  };

  // 3. Verifikasi Kehadiran Guru
  const backupVerifikasiGuru = async (isFiltered = true) => {
    setLoading(true); setMessage(null);
    try {
      const { startStr, endStr } = getFilterParams();
      let query = supabase.from('view_rekap_kehadiran_guru_final').select('*');
      if (isFiltered && startStr && endStr) query = query.gte('tanggal', startStr).lte('tanggal', endStr);
      const { data, error } = await query;
      if (error) throw error;

      const formatted = data.map((item, i) => ({
        'No': i + 1, 'Tanggal': item.tanggal, 'Nama Guru': item.nama, 'Role': item.role,
        'Status': item.status, 'Waktu': item.waktu || '-', 'Metode': item.metode || '-', 'Catatan': item.catatan || '-'
      }));
      exportExcel(formatted, 'Verifikasi Guru', `Backup_VerifikasiGuru_${isFiltered ? 'Filtered' : 'Semua'}.xlsx`);
    } catch (err) { setMessage({ type: 'error', text: err.message }); }
    setLoading(false);
  };

  // 4. Data Master Pengguna
  const backupMasterUser = async (isFiltered = true) => {
    setLoading(true); setMessage(null);
    try {
      const { filterRombel } = getFilterParams();
      let query = supabase.from('master_user').select('*').order('role').order('nama');
      if (isFiltered && filterRombel !== 'Semua') query = query.eq('rombel', filterRombel);
      const { data, error } = await query;
      if (error) throw error;

      const formatted = data.map((u, i) => ({
        'No': i + 1, 'ID_User': u.id_user, 'Nama': u.nama, 'Role': u.role,
        'Rombel': u.rombel, 'Status': u.status_aktif, 'RFID': u.rfid || ''
      }));
      exportExcel(formatted, 'Data Pengguna', `Backup_MasterPengguna_${isFiltered ? 'Filtered' : 'Semua'}.xlsx`);
    } catch (err) { setMessage({ type: 'error', text: err.message }); }
    setLoading(false);
  };

  // 5. Data Konfigurasi (Jadwal & Kalender)
  const backupJadwal = async () => {
    setLoading(true); setMessage(null);
    try {
      const { data, error } = await supabase.from('jadwal_pelajaran').select('*, master_user(nama)');
      if (error) throw error;
      const hariMap = {1:'Senin',2:'Selasa',3:'Rabu',4:'Kamis',5:'Jumat',6:'Sabtu',7:'Minggu'};
      const formatted = data.map((j, i) => ({
        'No': i + 1, 'Hari': hariMap[j.hari] || j.hari, 'Jam Mulai': j.jam_mulai, 'Jam Selesai': j.jam_selesai,
        'Rombel': j.rombel, 'Mata Pelajaran': j.mata_pelajaran, 'Nama Guru': j.master_user?.nama || '-'
      }));
      exportExcel(formatted, 'Jadwal', 'Backup_JadwalPelajaran.xlsx');
    } catch (err) { setMessage({ type: 'error', text: err.message }); }
    setLoading(false);
  };

  const backupKalender = async () => {
    setLoading(true); setMessage(null);
    try {
      const { data, error } = await supabase.from('master_kalender').select('*').order('tanggal', { ascending: false });
      if (error) throw error;
      const formatted = data.map((k, i) => ({
        'No': i + 1, 'Tanggal': k.tanggal, 'Tipe Hari': k.tipe_hari, 'Keterangan': k.keterangan
      }));
      exportExcel(formatted, 'Kalender', 'Backup_KalenderAkademik.xlsx');
    } catch (err) { setMessage({ type: 'error', text: err.message }); }
    setLoading(false);
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-24">
      {/* Header */}
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-white tracking-tight">Pusat Backup Data</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Unduh seluruh data historis dan konfigurasi SIAKAD dalam format Excel.</p>
      </div>

      {message && (
        <div className={`px-4 py-3 rounded-xl text-sm font-medium shadow-sm flex items-center justify-between ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'}`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="opacity-50 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Global Filters */}
      <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-3xl p-6 shadow-sm">
        <h3 className="text-base font-bold text-slate-800 dark:text-white mb-4">Pengaturan Filter (Opsional)</h3>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Mulai Tanggal</label>
            <DatePicker selected={startDate} onChange={setStartDate} dateFormat="dd-MM-yyyy" locale="id" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Sampai Tanggal</label>
            <DatePicker selected={endDate} onChange={setEndDate} dateFormat="dd-MM-yyyy" locale="id" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Rombel / Kelas</label>
            <select value={filterRombel} onChange={e => setFilterRombel(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500">
              <option value="Semua">Semua Kelas</option>
              {rombelOptions.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-4">* Filter di atas hanya akan diaplikasikan jika Anda menekan tombol <strong>Download dengan Filter</strong>.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Card Data Inti */}
        <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-3xl p-6 shadow-sm flex flex-col h-full">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Data Inti</h3>
            <p className="text-xs text-slate-500 mt-1">Bukti kegiatan KBM & Absensi</p>
          </div>
          <div className="space-y-4 flex-1">
            <BackupItem title="Jurnal Mengajar" onFilter={() => backupJurnal(true)} onAll={() => backupJurnal(false)} disabled={loading} />
            <BackupItem title="Absensi Harian Murid" onFilter={() => backupAbsensiHarian(true)} onAll={() => backupAbsensiHarian(false)} disabled={loading} />
            <BackupItem title="Verifikasi Kehadiran Guru" onFilter={() => backupVerifikasiGuru(true)} onAll={() => backupVerifikasiGuru(false)} disabled={loading} />
          </div>
        </div>

        {/* Card Data Master */}
        <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-3xl p-6 shadow-sm flex flex-col h-full">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Data Master</h3>
            <p className="text-xs text-slate-500 mt-1">Snapshot buku induk sekolah</p>
          </div>
          <div className="space-y-4 flex-1">
            <BackupItem title="Data Master Pengguna" onFilter={() => backupMasterUser(true)} onAll={() => backupMasterUser(false)} disabled={loading} />
          </div>
        </div>

        {/* Card Konfigurasi */}
        <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-3xl p-6 shadow-sm flex flex-col h-full">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Data Konfigurasi</h3>
            <p className="text-xs text-slate-500 mt-1">Jadwal pelajaran & kalender akademik</p>
          </div>
          <div className="space-y-4 flex-1">
            <BackupItem title="Jadwal Pelajaran" onFilter={backupJadwal} onAll={backupJadwal} disabled={loading} hideFilterBtn />
            <BackupItem title="Kalender Akademik" onFilter={backupKalender} onAll={backupKalender} disabled={loading} hideFilterBtn />
          </div>
        </div>

      </div>
    </div>
  );
}

function BackupItem({ title, onFilter, onAll, disabled, hideFilterBtn }) {
  return (
    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-white/5">
      <h4 className="font-semibold text-sm text-slate-700 dark:text-slate-200 mb-3">{title}</h4>
      <div className="flex flex-wrap gap-2">
        {!hideFilterBtn && (
          <button onClick={onFilter} disabled={disabled} className="flex-1 py-2 px-3 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50">
            Dgn Filter
          </button>
        )}
        <button onClick={onAll} disabled={disabled} className="flex-1 py-2 px-3 bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50">
          Semua Data
        </button>
      </div>
    </div>
  );
}
