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

  let nfcQuery = supabase.from('view_rekap_absensi_nfc').select('*').eq('tanggal', tanggal);
  if (rombel !== 'Semua') nfcQuery = nfcQuery.eq('rombel', rombel);
  const { data: nfc } = await nfcQuery;

  let existingQuery = supabase.from('data_absensi').select('*').eq('tanggal', tanggal);
  if (rombel !== 'Semua') existingQuery = existingQuery.eq('rombel', rombel);
  const { data: existing } = await existingQuery;

  const startUTC = new Date(`${tanggal}T00:00:00+07:00`).toISOString();
  const endUTC = new Date(`${tanggal}T23:59:59+07:00`).toISOString();
  
  const { data: rawLogs } = await supabase.from('log_absensi')
    .select('rfid_uid, waktu')
    .gte('waktu', startUTC)
    .lte('waktu', endUTC);

  const rfidToTime = {};
  (rawLogs || []).forEach(log => {
    const wibTime = new Date(log.waktu).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour12: false });
    if (!rfidToTime[log.rfid_uid] || wibTime < rfidToTime[log.rfid_uid]) {
      rfidToTime[log.rfid_uid] = wibTime; 
    }
  });

  const nfcMap = {};
  (nfc || []).forEach(n => {
    const m = (murid || []).find(x => x.id_user === n.id_user);
    const rawTime = m && rfidToTime[m.rfid] ? rfidToTime[m.rfid] : null;
    
    nfcMap[n.id_user] = {
      ...n,
      jam_datang: rawTime || n.jam_datang || n.jam_pulang
    };
  });
  
  const absensiMap = {};
  (existing || []).forEach(a => { absensiMap[a.nisn] = { status: a.status, catatan: a.catatan || '' }; });

  const mergedAbsensi = {};
  (murid || []).forEach(m => {
    if (absensiMap[m.id_user]) {
      mergedAbsensi[m.id_user] = absensiMap[m.id_user];
      if (mergedAbsensi[m.id_user].catatan && mergedAbsensi[m.id_user].catatan.startsWith('NFC:')) {
        mergedAbsensi[m.id_user].catatan = mergedAbsensi[m.id_user].catatan.replace('NFC:', 'Tap NFC:');
      }
    }
    else if (nfcMap[m.id_user]) {
      const jam = nfcMap[m.id_user].jam_datang || nfcMap[m.id_user].jam_pulang;
      if (isLate(jam)) {
        mergedAbsensi[m.id_user] = { status: 'Hadir', catatan: 'Terlambat' };
      } else {
        mergedAbsensi[m.id_user] = { status: 'Hadir', catatan: 'Tap NFC' };
      }
    }
    else {
      mergedAbsensi[m.id_user] = { status: 'Hadir', catatan: '' };
    }
  });

  return { isHoliday: false, holidayName: '', murid: murid || [], nfcMap, mergedAbsensi };
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
