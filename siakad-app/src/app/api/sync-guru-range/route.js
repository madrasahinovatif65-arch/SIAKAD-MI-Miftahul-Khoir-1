import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request) {
  try {
    const { tglMulai, tglAkhir } = await request.json();

    if (!tglMulai || !tglAkhir) {
      return NextResponse.json({ error: 'Tanggal mulai dan tanggal akhir wajib diisi.' }, { status: 400 });
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

    // 2. Ambil data guru
    const { data: guruList } = await supabase
      .from('master_user')
      .select('id_user, nama, role')
      .in('role', ['Wali Kelas', 'Guru Mapel'])
      .eq('status_aktif', 'Aktif');

    if (!guruList || guruList.length === 0) {
      return NextResponse.json({ error: `Tidak ada data guru aktif.` }, { status: 404 });
    }

    // 3. Ambil data verifikasi yang sudah ada pada rentang tersebut
    // Menggunakan tabel verifikasi_guru sesuai permintaan user
    const { data: existingVerif } = await supabase
      .from('verifikasi_guru')
      .select('id_guru, tanggal')
      .gte('tanggal', tglMulai)
      .lte('tanggal', tglAkhir);

    const existingSet = new Set((existingVerif || []).map(a => `${a.tanggal}_${a.id_guru}`));

    // 4. Ambil data NFC dan GPS pada rentang tersebut
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

    // 5. Siapkan array untuk bulk insert
    const toInsert = [];
    let added = 0;
    let skipped = 0;

    for (let d = new Date(tglMulai + 'T00:00:00'); d <= new Date(tglAkhir + 'T00:00:00'); d.setDate(d.getDate() + 1)) {
      const y = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      const dy = String(d.getDate()).padStart(2, '0');
      const currentDateString = `${y}-${mo}-${dy}`;
      if (d.getDay() === 0) continue; // Skip hari minggu
      if (liburSet.has(currentDateString)) continue; // Skip hari libur

      for (const guru of guruList) {
        const key = `${currentDateString}_${guru.id_user}`;
        
        if (existingSet.has(key)) {
          skipped++;
        } else {
          // Cek log NFC dan GPS
          const nfc = nfcMapData[key];
          const gps = gpsMapData[key];

          let status = 'Hadir';
          let catatan = 'Hadir (Verifikasi Admin)';
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
          added++;
        }
      }
    }

    if (toInsert.length > 0) {
      const chunkSize = 500;
      for (let i = 0; i < toInsert.length; i += chunkSize) {
        const chunk = toInsert.slice(i, i + chunkSize);
        const { error } = await supabase.from('verifikasi_guru').insert(chunk);
        if (error) {
          console.error('Insert chunk error:', error);
          throw error;
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Sinkronisasi selesai. Ditambahkan: ${added} presensi. Dilewati: ${skipped} (sudah ada).`,
      added,
      skipped
    });

  } catch (error) {
    console.error('Sync Range Guru Error:', error);
    return NextResponse.json(
      { error: 'Gagal melakukan sinkronisasi.', details: error.message },
      { status: 500 }
    );
  }
}
