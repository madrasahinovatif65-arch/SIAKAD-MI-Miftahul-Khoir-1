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

    let targetDate = new Date().toISOString().split('T')[0];

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
    const { data: libur } = await supabase.from('master_libur').select('*').eq('tanggal', targetDate).single();
    if (libur) {
      return NextResponse.json({ message: 'Hari libur dilewati: ' + libur.keterangan });
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

    // 4. Siapkan data baru (Insert Only)
    const toInsert = [];
    let added = 0;
    let skipped = 0;

    murid.forEach(m => {
      if (existingMap[m.id_user]) {
        skipped++; // Sudah ada, jangan ditimpa (mungkin hasil edit guru)
      } else {
        added++;
        const isTap = !!nfcMap[m.id_user];
        toInsert.push({
          tanggal: targetDate,
          nisn: m.id_user,
          rombel: m.rombel,
          status: 'Hadir', // Default selalu hadir (R3 Sinkronisasi)
          catatan: isTap ? 'Tap NFC Mandiri' : 'Hadir (Otomatis)',
          pencatat: 'System',
          metode: isTap ? 'NFC' : 'Otomatis'
        });
      }
    });

    if (toInsert.length > 0) {
      const { error } = await supabase.from('data_absensi').insert(toInsert);
      if (error) throw error;
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
