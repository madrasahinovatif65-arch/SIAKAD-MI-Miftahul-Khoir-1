require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testSync() {
  const tglMulai = '2026-07-13';
  const tglAkhir = '2026-07-31';
  
  const { data: guruList } = await supabase
    .from('master_user')
    .select('id_user, nama, role')
    .in('role', ['Wali Kelas', 'Guru Mapel'])
    .eq('status_aktif', 'Aktif');

  const { data: nfcData } = await supabase
    .from('view_rekap_absensi_nfc')
    .select('id_user, tanggal, jam_datang, jam_pulang')
    .gte('tanggal', tglMulai)
    .lte('tanggal', tglAkhir);

  const nfcMapData = {};
  (nfcData || []).forEach(n => {
    nfcMapData[`${n.tanggal}_${n.id_user}`] = n;
  });

  const { data: gpsData } = await supabase
    .from('log_gps_guru')
    .select('id_guru, tanggal, waktu, status')
    .gte('tanggal', tglMulai)
    .lte('tanggal', tglAkhir);

  const gpsMapData = {};
  (gpsData || []).forEach(g => {
    gpsMapData[`${g.tanggal}_${g.id_guru}`] = g;
  });

  const start = new Date(tglMulai);
  const end = new Date(tglAkhir);
  const toInsert = [];

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const currentDateString = d.toISOString().split('T')[0];
    if (d.getDay() === 0) continue; // Skip hari minggu

    for (const guru of guruList) {
      const key = `${currentDateString}_${guru.id_user}`;
      const nfc = nfcMapData[key];
      const gps = gpsMapData[key];

      let status = 'Hadir';
      let catatan = 'Hadir (Verifikasi Rentang)';
      let metode = 'Otomatis';
      let waktu = '-';

      if (nfc) {
        metode = 'NFC';
        waktu = nfc.jam_datang || '-';
        catatan = 'Auto-verified via NFC';
      } else if (gps) {
        metode = 'GPS';
        waktu = gps.waktu || '-';
        catatan = 'Auto-verified via GPS';
      }

      toInsert.push({
        tanggal: currentDateString,
        id_guru: guru.id_user,
        waktu: waktu,
        status: status,
        catatan: catatan,
        verifikator: 'Admin',
        metode: metode
      });
    }
  }

  const chunk = toInsert.slice(0, 10);
  console.log("Attempting insert:", chunk);
  const { error } = await supabase.from('verifikasi_guru').insert(chunk);
  if (error) {
    console.error("ERROR FROM DB:", error);
  } else {
    console.log("Success inserting 10 rows!");
  }
}

testSync();
