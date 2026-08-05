import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create a Supabase client for API routes
// We prefer SUPABASE_SERVICE_ROLE_KEY for admin tasks in API route if available, 
// otherwise fallback to anon key
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request) {
  try {
    const data = await request.json();

    // Validasi data
    if (!data.id_guru && !data.nisn) {
      return NextResponse.json(
        { error: 'id_guru atau nisn wajib diisi' },
        { status: 400 }
      );
    }

    if (!data.tanggal || !data.jam_datang) {
      return NextResponse.json(
        { error: 'tanggal dan jam_datang wajib diisi' },
        { status: 400 }
      );
    }

    if (data.id_guru) {
      // Tap NFC Guru
      const { error } = await supabase
        .from('nfc_guru')
        .upsert({
          tanggal: data.tanggal,
          id_guru: data.id_guru,
          nama_guru: data.nama_guru || '-',
          jam_datang: data.jam_datang,
          jam_pulang: data.jam_pulang || null,
        }, { onConflict: 'tanggal,id_guru' });

      if (error) throw error;
      return NextResponse.json({ success: true, message: 'NFC Guru tersimpan' });
    } else if (data.nisn) {
      // Tap NFC Murid
      const { error } = await supabase
        .from('data_nfc_murid')
        .upsert({
          tanggal: data.tanggal,
          nisn: data.nisn,
          nama_murid: data.nama_murid || '-',
          rombel: data.rombel || '-',
          jam_datang: data.jam_datang,
          jam_pulang: data.jam_pulang || null,
          status_tap: data.status_tap || 'Datang',
        }, { onConflict: 'tanggal,nisn' });

      if (error) throw error;
      return NextResponse.json({ success: true, message: 'NFC Murid tersimpan' });
    }

  } catch (error) {
    console.error('NFC API Error:', error);
    return NextResponse.json(
      { error: 'Gagal memproses data NFC', details: error.message },
      { status: 500 }
    );
  }
}
