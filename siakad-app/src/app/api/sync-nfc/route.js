import { getTodayDate } from '@/lib/dateUtils';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    // Basic security for CRON: ensure auth header matches CRON_SECRET if defined
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let targetDate = getTodayDate();

    // Coba parsing body jika ada (admin memicu manual)
    try {
      const data = await request.json();
      if (data.tanggal) targetDate = data.tanggal;
    } catch (e) {
      // ignore JSON parse error, just use default today
    }

    // 1. Cek Hari Libur (Minggu atau di Master Libur)
    const d = new Date(targetDate);
    if (d.getDay() === 0) {
      return NextResponse.json({ message: 'Hari Minggu dilewati.' });
    }
    const { data: kalender } = await supabase.from('master_kalender').select('*').eq('tanggal', targetDate).single();
    if (kalender && kalender.tipe_hari === 'Libur') {
      return NextResponse.json({ message: 'Hari libur dilewati: ' + kalender.keterangan });
    }

    // 2. Ambil data murid aktif dan data NFC hari itu
    const [{ data: murid }, { data: nfc }] = await Promise.all([
      supabase.from('master_user').select('*').eq('role', 'Murid').eq('status_aktif', 'Aktif'),
      supabase.from('view_rekap_absensi_nfc').select('*').eq('tanggal', targetDate).eq('role', 'Murid')
    ]);

    if (!murid || murid.length === 0) {
      return NextResponse.json({ message: 'Tidak ada data murid aktif.' });
    }

    const nfcMap = {};
    (nfc || []).forEach(n => { nfcMap[n.id_user] = n; });

    // 3. Ambil absensi yang sudah ada hari itu untuk mencegah overwrite yang sudah divalidasi
    const { data: existingAbsen } = await supabase.from('data_absensi').select('*').eq('tanggal', targetDate);
    const existingMap = {};
    (existingAbsen || []).forEach(a => { existingMap[a.nisn] = a; });

    const startUTC = new Date(`${targetDate}T00:00:00+07:00`).toISOString();
    const endUTC = new Date(`${targetDate}T23:59:59+07:00`).toISOString();
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
    (nfc || []).forEach(n => {
      const m = murid.find(x => x.id_user === n.id_user);
      const rawTime = m && rfidToTime[m.rfid] ? rfidToTime[m.rfid] : null;
      nfcMapData[n.id_user] = rawTime || n.jam_datang || n.jam_pulang;
    });

    // 4. Siapkan data baru (Insert Only)
    const toInsert = [];
    let added = 0;
    let skipped = 0;

    murid.forEach(m => {
      if (existingMap[m.id_user]) {
        skipped++; // Sudah ada, jangan ditimpa (mungkin hasil edit guru)
      } else {
        const jam = nfcMapData[m.id_user];
        const isTap = !!jam;
        if (isTap) added++; // Only add if they tapped. The original sync-nfc might add them as absent? No, it says "Hadir (Otomatis)".
        // Wait, original sync-nfc inserted EVERY active student!
        added++;
        
        let catatan = isTap ? 'Tap NFC Mandiri' : 'Hadir (Otomatis)';
        if (isTap && jam) {
          const match = jam.match(/\d{2}[:.]\d{2}[:.]\d{2}/);
          const matchShort = jam.match(/\d{2}[:.]\d{2}/);
          if ((match && match[0].replace(/\./g, ':') > '07:00:00') || (matchShort && matchShort[0].replace(/\./g, ':') > '07:00')) {
            catatan = 'Terlambat';
          }
        }
        toInsert.push({
          tanggal: targetDate,
          nisn: m.id_user,
          rombel: m.rombel,
          status: 'Hadir', // Default selalu hadir (R3 Sinkronisasi)
          catatan: catatan,
          pencatat: 'System',
          metode: isTap ? 'NFC' : 'Otomatis'
        });
      }
    });

    if (toInsert.length > 0) {
      const { error } = await supabase.from('data_absensi').insert(toInsert);
      if (error) throw error;

      // Kirim notifikasi ke murid yang berhasil Tap NFC hari ini
      const nfcNotifs = toInsert
        .filter(a => a.metode === 'NFC')
        .map(a => {
          const siswa = murid.find(m => m.id_user === a.nisn);
          const jamWIB = nfcMapData[a.nisn] || '-';
          return {
            id_user: a.nisn,
            role_target: null,
            title: 'Kehadiran Berhasil ✅',
            message: `Ananda ${siswa?.nama || ''} telah tercatat Hadir di sekolah hari ini via NFC pada pukul ${jamWIB}.`,
            type: 'ABSENSI',
            link: '/dashboard/presensi',
            is_read: false,
          };
        });
      if (nfcNotifs.length > 0) {
        await supabase.from('notifikasi').insert(nfcNotifs);
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Sinkronisasi berhasil. Ditambahkan: ${added}, Dilewati: ${skipped}` 
    });

  } catch (error) {
    console.error('Sync NFC Error:', error);
    return NextResponse.json(
      { error: 'Gagal sinkronisasi NFC', details: error.message },
      { status: 500 }
    );
  }
}
