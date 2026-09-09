import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Client dengan service role untuk operasi admin (ambil data sekolah & kepsek)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);

export async function GET(request) {
  try {
    // ============================================================
    // 1. Verifikasi Bearer Token dari APK Gen
    // ============================================================
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '').trim();

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Token autentikasi diperlukan.' },
        { status: 401 }
      );
    }

    // Verifikasi token menggunakan Supabase Auth
    // Gunakan client anon untuk memvalidasi token user
    const supabaseForAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user: authUser }, error: authError } = await supabaseForAuth.auth.getUser();

    if (authError || !authUser) {
      console.warn('⚠️ apk-gen-sync: Token tidak valid -', authError?.message);
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Token tidak valid atau sudah kedaluwarsa.' },
        { status: 401 }
      );
    }

    // ============================================================
    // 2. Ambil data pengaturan sekolah (tahun ajaran + semester)
    // ============================================================
    const { data: pengaturanData, error: pengaturanError } = await supabaseAdmin
      .from('pengaturan_sekolah')
      .select('tahun_ajaran, semester')
      .limit(1)
      .single();

    if (pengaturanError && pengaturanError.code !== 'PGRST116') {
      throw pengaturanError;
    }

    const tahunPelajaran = pengaturanData?.tahun_ajaran || '2026/2027';
    const semester = pengaturanData?.semester || 'Ganjil';

    // ============================================================
    // 3. Ambil data Kepala Madrasah (data publik, tidak perlu filter)
    // ============================================================
    const { data: kepsekData, error: kepsekError } = await supabaseAdmin
      .from('master_user')
      .select('nama, id_user')
      .eq('role', 'Kepala Madrasah')
      .limit(1)
      .single();

    if (kepsekError && kepsekError.code !== 'PGRST116') {
      throw kepsekError;
    }

    // ============================================================
    // 4. Ambil data guru yang sedang login (filter per user_id)
    // ============================================================
    // Coba cari berdasarkan user_id (UUID Supabase Auth)
    let { data: guruRows, error: guruError } = await supabaseAdmin
      .from('master_user')
      .select('nama, id_user, mapel, role, rombel')
      .eq('user_id', authUser.id);

    // Fallback: cari berdasarkan id_user = bagian email sebelum '@'
    if (guruError || !guruRows || guruRows.length === 0) {
      const idFromEmail = authUser.email?.split('@')[0] || '';
      const fallback = await supabaseAdmin
        .from('master_user')
        .select('nama, id_user, mapel, role, rombel')
        .eq('id_user', idFromEmail);

      if (fallback.error) throw fallback.error;
      guruRows = fallback.data || [];
    }

    if (!guruRows || guruRows.length === 0) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Data profil guru tidak ditemukan untuk akun ini.' },
        { status: 404 }
      );
    }

    // ============================================================
    // 5. Transformasi dan Mapping Data sesuai kebutuhan APK Gen
    // ============================================================
    const formattedGuru = guruRows.map(guru => {
      let formattedRombel = '';
      if (guru.rombel && guru.rombel !== '-' && guru.rombel.trim() !== '') {
        const match = guru.rombel.match(/\d+/);
        if (match) {
          const grade = parseInt(match[0], 10);
          let fase = '';
          if (grade === 1 || grade === 2) fase = 'A';
          else if (grade === 3 || grade === 4) fase = 'B';
          else if (grade === 5 || grade === 6) fase = 'C';
          if (fase) formattedRombel = `Fase ${fase} / Kelas ${grade}`;
        }
      }

      return {
        Nama_Guru: guru.nama,
        NIP_Guru: guru.id_user,
        siakadMapel: guru.mapel,
        siakadRole: guru.role,
        siakadRombel: formattedRombel,
        id_user: guru.id_user,
      };
    });

    const responseData = {
      Nama_Sekolah: "MI Miftahul Khoir 1 Karangrejo",
      Nama_Yayasan: "Yayasan NU Miftakhul Khoir Damarjati",
      Jalan: "Jalan Sumber Keling No. 11, Dsn. Krajan, Ds. Karangrejo",
      Nama_Kepsek: kepsekData?.nama || "-",
      NIP_Kepsek: kepsekData?.id_user || "-",
      Tahun_Pelajaran: tahunPelajaran,
      Semester: semester,
      // Hanya berisi data guru yang sedang login (bukan semua guru)
      Guru: formattedGuru,
    };

    return NextResponse.json(responseData, { status: 200 });

  } catch (error) {
    console.error('Error in apk-gen-sync:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
