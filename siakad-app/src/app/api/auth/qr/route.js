import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// API ini hanya boleh dipanggil dari sisi klien untuk mengambil PIN berdasarkan QR scan
export async function POST(request) {
  try {
    const { id_user } = await request.json();

    if (!id_user) {
      return NextResponse.json({ success: false, message: 'ID User tidak valid' }, { status: 400 });
    }

    if (!supabaseServiceKey) {
      return NextResponse.json({ success: false, message: 'Server tidak dikonfigurasi dengan service role key' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // 1. Cari user di master_user untuk mendapatkan PIN
    const { data: user, error: userError } = await supabaseAdmin
      .from('master_user')
      .select('id_user, pin, status_aktif')
      .eq('id_user', id_user.trim())
      .single();

    if (userError || !user || user.status_aktif !== 'Aktif') {
      return NextResponse.json({ success: false, message: 'Pengguna tidak ditemukan atau tidak aktif' }, { status: 404 });
    }

    // 2. Kembalikan PIN ke klien (Peringatan: Ini mengekspos PIN pengguna)
    return NextResponse.json({
      success: true,
      pin: user.pin
    });

  } catch (error) {
    console.error('QR Login API Error:', error);
    return NextResponse.json({ success: false, message: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
