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

  const { data: gpsLogs } = await supabase
    .from('log_gps_guru')
    .select('*')
    .eq('tanggal', tanggal);

  const { data: nfcLogs } = await supabase
    .from('view_rekap_absensi_nfc')
    .select('*')
    .eq('tanggal', tanggal);

  const { data: verified } = await supabase
    .from('verifikasi_guru')
    .select('*')
    .eq('tanggal', tanggal);

  const startUTC = new Date(`${tanggal}T00:00:00+07:00`).toISOString();
  const endUTC = new Date(`${tanggal}T23:59:59+07:00`).toISOString();
  
  const { data: rawLogs } = await supabase.from('log_absensi')
    .select('rfid_uid, waktu')
    .gte('waktu', startUTC)
    .lte('waktu', endUTC);

  const rfidToTimes = {};
  (rawLogs || []).forEach(log => {
    const wibTime = new Date(log.waktu).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour12: false });
    if (!rfidToTimes[log.rfid_uid]) {
      rfidToTimes[log.rfid_uid] = { earliest: wibTime, latest: wibTime };
    } else {
      if (wibTime < rfidToTimes[log.rfid_uid].earliest) rfidToTimes[log.rfid_uid].earliest = wibTime;
      if (wibTime > rfidToTimes[log.rfid_uid].latest) rfidToTimes[log.rfid_uid].latest = wibTime;
    }
  });

  const mergedAbsensi = {};

  (allGuru || []).forEach(guru => {
    const ver = (verified || []).find(v => v.id_guru === guru.id_user);
    const nfc = (nfcLogs || []).find(n => n.id_user === guru.id_user);
    const gps = (gpsLogs || []).find(g => g.id_user === guru.id_user);
    const rawTimes = rfidToTimes[guru.rfid];

    let waktu_datang = null;
    let waktu_pulang = null;

    if (nfc) {
      if (nfc.jam_datang) waktu_datang = nfc.jam_datang;
      if (nfc.jam_pulang) waktu_pulang = nfc.jam_pulang;
    }

    if (rawTimes) {
      waktu_datang = waktu_datang || rawTimes.earliest;
      if (rawTimes.latest !== rawTimes.earliest) {
        waktu_pulang = waktu_pulang || rawTimes.latest;
      }
    }
    
    if (gps) {
      if (gps.waktu && gps.waktu !== '-') {
        if (!waktu_datang) waktu_datang = gps.waktu;
      }
      if (gps.waktu_pulang && gps.waktu_pulang !== '-') {
        if (!waktu_pulang) waktu_pulang = gps.waktu_pulang;
      }
    }

    let isLate = false;
    if (waktu_datang) {
      const match = waktu_datang.match(/(\d{2})[:.](\d{2})/);
      if (match) {
        const h = parseInt(match[1], 10);
        const m = parseInt(match[2], 10);
        if (h > 7 || (h === 7 && m > 0)) {
          isLate = true;
        }
      }
    }

    let currentStatus = 'Hadir';
    let catatan = '';
    let metode = 'Otomatis';
    let waktu = '-';

    if (ver) {
      currentStatus = ver.status;
      waktu = ver.waktu;
      metode = ver.metode;
      catatan = ver.catatan || '';
    } else if (nfc || gps) {
      if (nfc) {
        currentStatus = 'Hadir';
        metode = 'NFC';
        catatan = isLate ? 'Terlambat' : 'Auto-verified via NFC';
      } else if (gps) {
        metode = 'GPS';
        const radius = parseInt(process.env.NEXT_PUBLIC_GPS_RADIUS_METER || '50');
        if (gps.status === 'Menunggu Verifikasi' || gps.status === 'Di Luar Radius') {
          if (gps.jarak_meter !== null && gps.jarak_meter <= radius) {
             currentStatus = 'Hadir';
          } else if (gps.jarak_meter !== null && gps.jarak_meter > radius) {
             currentStatus = 'Di Luar Radius';
          } else {
             currentStatus = gps.status;
          }
        } else {
          currentStatus = gps.status;
        }
        catatan = isLate ? 'Terlambat' : 'Auto-verified via GPS';
      }
      if (nfc && gps) {
        metode = 'NFC+GPS';
      }
      waktu = waktu_datang || waktu_pulang || '-';
    } else {
      currentStatus = 'Hadir';
      catatan = 'Auto-verified by Admin';
      metode = 'Otomatis';
    }

    mergedAbsensi[guru.id_user] = {
      status: currentStatus,
      catatan,
      waktu,
      waktu_datang,
      waktu_pulang,
      metode,
      isLate,
      isNFC: !!nfc,
      isGPS: !!gps,
      isVerified: !!ver,
    };
  });

  return { isHoliday: false, holidayName: '', guruList: allGuru || [], mergedAbsensi };
};
