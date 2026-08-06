import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// API ini hanya boleh dipanggil dari sisi klien untuk login QR
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

    // 2. Lakukan login menggunakan email virtual dan PIN
    const email = `${user.id_user.toLowerCase()}@siakad.local`;
    const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
      email: email,
      password: user.pin
    });

    if (authError || !authData.session) {
      return NextResponse.json({ success: false, message: 'Gagal mengautentikasi sesi QR' }, { status: 401 });
    }

    // 3. Kembalikan session ke klien
    return NextResponse.json({
      success: true,
      session: authData.session
    });

  } catch (error) {
    console.error('QR Login API Error:', error);
    return NextResponse.json({ success: false, message: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
