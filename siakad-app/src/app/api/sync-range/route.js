import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request) {
  try {
    const { tglMulai, tglAkhir, rombel } = await request.json();

    if (!tglMulai || !tglAkhir || !rombel) {
      return NextResponse.json({ error: 'Tanggal mulai, tanggal akhir, dan rombel wajib diisi.' }, { status: 400 });
    }

    const start = new Date(tglMulai);
    const end = new Date(tglAkhir);

    // Validasi 1 bulan maksimal dan di bulan yang sama
    if (start.getFullYear() !== end.getFullYear() || start.getMonth() !== end.getMonth()) {
      return NextResponse.json({ error: 'Rentang tanggal harus berada pada bulan dan tahun yang sama.' }, { status: 400 });
    }

    if (start > end) {
      return NextResponse.json({ error: 'Tanggal mulai tidak boleh lebih dari tanggal akhir.' }, { status: 400 });
    }

    // Hitung selisih hari
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    if (diffDays > 31) {
      return NextResponse.json({ error: 'Rentang waktu maksimal 1 bulan (31 hari).' }, { status: 400 });
    }

    // 1. Ambil data hari libur pada rentang tersebut
    const { data: liburData } = await supabase
      .from('master_libur')
      .select('tanggal')
      .gte('tanggal', tglMulai)
      .lte('tanggal', tglAkhir);
    
    const liburSet = new Set((liburData || []).map(l => l.tanggal));

    // 2. Ambil data murid di rombel tersebut
    const { data: murid } = await supabase
      .from('master_user')
      .select('id_user, rombel')
      .eq('role', 'Murid')
      .eq('status_aktif', 'Aktif')
      .eq('rombel', rombel);

    if (!murid || murid.length === 0) {
      return NextResponse.json({ error: `Tidak ada data murid aktif di kelas ${rombel}.` }, { status: 404 });
    }

    // 3. Ambil data_absensi yang sudah ada pada rentang tersebut
    const { data: existingAbsen } = await supabase
      .from('data_absensi')
      .select('nisn, tanggal')
      .eq('rombel', rombel)
      .gte('tanggal', tglMulai)
      .lte('tanggal', tglAkhir);

    // Buat Set berisi key 'tanggal_nisn' untuk pencarian cepat
    const existingSet = new Set((existingAbsen || []).map(a => `${a.tanggal}_${a.nisn}`));

    // 4. Ambil data NFC dari view_rekap_absensi_nfc pada rentang tersebut
    const { data: nfcData } = await supabase
      .from('view_rekap_absensi_nfc')
      .select('id_user, tanggal')
      .eq('rombel', rombel)
      .gte('tanggal', tglMulai)
      .lte('tanggal', tglAkhir);
      
    const startUTC = new Date(`${tglMulai}T00:00:00+07:00`).toISOString();
    const endUTC = new Date(`${tglAkhir}T23:59:59+07:00`).toISOString();
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

    const nfcMapData = {};
    (nfcData || []).forEach(n => {
      const m = murid.find(x => x.id_user === n.id_user);
      const rawTime = m && rfidToTime[m.rfid] ? rfidToTime[m.rfid] : null;
      nfcMapData[`${n.tanggal}_${n.id_user}`] = rawTime || n.jam_datang || n.jam_pulang;
    });

    // 5. Siapkan array untuk bulk insert
    const toInsert = [];
    let added = 0;
    let skipped = 0;

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const currentDateString = d.toISOString().split('T')[0];
      if (d.getDay() === 0) continue;
      if (liburSet.has(currentDateString)) continue;

      for (const m of murid) {
        const key = `${currentDateString}_${m.id_user}`;
        if (existingSet.has(key)) {
          skipped++;
        } else {
          const jam = nfcMapData[key];
          const isTap = !!jam;
          let catatan = isTap ? 'Tap NFC' : 'Hadir (Verifikasi Rentang)';
          if (isTap && jam) {
            const match = jam.match(/\d{2}:\d{2}:\d{2}/);
            const matchShort = jam.match(/\d{2}:\d{2}/);
            if ((match && match[0] > '07:00:00') || (matchShort && matchShort[0] > '07:00')) {
              catatan = 'Terlambat';
            }
          }
          toInsert.push({
            tanggal: currentDateString,
            nisn: m.id_user,
            rombel: m.rombel,
            status: 'Hadir',
            catatan: catatan,
            pencatat: 'Wali Kelas / Guru',
            metode: isTap ? 'NFC' : 'Otomatis'
          });
          added++;
        }
      }
    }

    if (toInsert.length > 0) {
      // Chunk insert jika lebih dari 1000 agar aman
      const chunkSize = 500;
      for (let i = 0; i < toInsert.length; i += chunkSize) {
        const chunk = toInsert.slice(i, i + chunkSize);
        const { error } = await supabase.from('data_absensi').insert(chunk);
        if (error) {
          console.error('Insert chunk error:', error);
          throw error;
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      added, 
      skipped,
      message: `Berhasil menambahkan ${added} data kehadiran. (${skipped} data dilewati karena sudah ada).` 
    });

  } catch (error) {
    console.error('Sync Range Error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat memproses verifikasi rentang waktu.', details: error.message },
      { status: 500 }
    );
  }
}
