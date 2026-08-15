import { supabase } from '@/lib/supabase';

// Helper functions
const isLate = (timeStr) => {
  if (!timeStr || timeStr === '-') return false;
  const match = timeStr.match(/\d{2}[:.]\d{2}[:.]\d{2}/);
  if (match) return match[0].replace(/\./g, ':') > '07:00:00';
  const matchShort = timeStr.match(/\d{2}[:.]\d{2}/);
  if (matchShort) return matchShort[0].replace(/\./g, ':') > '07:00';
  return false;
};

// Fetcher for master_libur_all
export const fetchMasterLibur = async () => {
  const { data } = await supabase.from('master_libur').select('tanggal');
  return (data || []).map(d => d.tanggal);
};

// Fetcher for verified_dates_guru
export const fetchVerifiedDatesGuru = async () => {
  const { data } = await supabase.from('verifikasi_guru').select('tanggal');
  const uniqueDates = [...new Set((data || []).map(d => d.tanggal))];
  return uniqueDates.map(d => {
    const [y, m, day] = d.split('-');
    return new Date(y, m - 1, day);
  });
};

// Fetcher for presensi murid
export const fetchPresensiData = async ([_key, rombel, tanggal]) => {
  if (!rombel || !tanggal) return null;
  
  const d = new Date(tanggal);
  if (d.getDay() === 0) {
    return { isHoliday: true, holidayName: 'Hari Minggu', murid: [], nfcMap: {}, mergedAbsensi: {} };
  }
  const { data: libur } = await supabase.from('master_libur').select('*').eq('tanggal', tanggal).single();
  if (libur) {
    return { isHoliday: true, holidayName: libur.keterangan, murid: [], nfcMap: {}, mergedAbsensi: {} };
  }

  let muridQuery = supabase.from('master_user').select('*').eq('role', 'Murid').eq('status_aktif', 'Aktif').order('nama');
  if (rombel !== 'Semua') muridQuery = muridQuery.eq('rombel', rombel);
  const { data: murid } = await muridQuery;

  const { data: viewData } = await supabase
    .from('view_rekap_kehadiran_murid_final')
    .select('*')
    .eq('tanggal', tanggal);

  const mergedAbsensi = {};
  
  (murid || []).forEach(m => {
    const record = (viewData || []).find(v => v.id_murid === m.id_user);
    if (record) {
      mergedAbsensi[m.id_user] = {
        status: record.status,
        catatan: record.catatan,
        waktu_datang: record.waktu_datang,
        waktu_pulang: record.waktu_pulang,
        is_manual: record.status !== 'Hadir' || (record.catatan !== 'Tap NFC' && record.catatan !== 'Terlambat')
      };
    } else {
      mergedAbsensi[m.id_user] = {
        status: 'Hadir',
        catatan: 'Manual Guru',
        waktu_datang: '-',
        waktu_pulang: '-',
        is_manual: true
      };
    }
  });

  return { isHoliday: false, holidayName: '', murid: murid || [], nfcMap: {}, mergedAbsensi };
};

// Fetcher for verifikasi guru
export const fetchVerifikasiGuru = async ([_key, tanggal]) => {
  if (!tanggal) return null;
  
  const d = new Date(tanggal);
  if (d.getDay() === 0) {
    return { isHoliday: true, holidayName: 'Hari Minggu', guruList: [], mergedAbsensi: {} };
  }
  const { data: libur } = await supabase.from('master_libur').select('*').eq('tanggal', tanggal).single();
  if (libur) {
    return { isHoliday: true, holidayName: libur.keterangan, guruList: [], mergedAbsensi: {} };
  }

  const { data: allGuru } = await supabase
    .from('master_user')
    .select('id_user, nama, role, rombel, rfid')
    .in('role', ['Wali Kelas', 'Guru Mapel', 'Kepala Madrasah'])
    .eq('status_aktif', 'Aktif')
    .order('nama');

  const { data: viewData } = await supabase
    .from('view_rekap_kehadiran_guru_final')
    .select('*')
    .eq('tanggal', tanggal);

  const mergedAbsensi = {};

  (allGuru || []).forEach(guru => {
    const record = (viewData || []).find(v => v.id_guru === guru.id_user);

    if (record) {
      mergedAbsensi[guru.id_user] = {
        status: record.status,
        waktu: record.waktu || '-',
        metode: record.metode || '-',
        catatan: record.catatan || '',
      };
    } else {
      mergedAbsensi[guru.id_user] = {
        status: 'Hadir',
        waktu: '-',
        metode: 'Otomatis',
        catatan: 'Auto-verified (Belum ada data fisik)',
      };
    }
  });

  return { isHoliday: false, holidayName: '', guruList: allGuru || [], mergedAbsensi };
};
