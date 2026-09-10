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

    // ============================================================
    // 6. Fetch Karakteristik Siswa (Asesmen Diagnostik)
    // ============================================================
    let rekapKarakteristik = '';
    const activeRombel = guruRows.find(g => g.rombel && g.rombel !== '-' && g.rombel.trim() !== '')?.rombel;
    
    if (activeRombel) {
      // 6a. Non-Kognitif
      const { data: nkData, error: nkError } = await supabaseAdmin
        .from('profil_non_kognitif')
        .select('sosial_emosional, dukungan_belajar, minat_dominan, catatan_khusus')
        .eq('rombel', activeRombel)
        .eq('tahun_ajaran', tahunPelajaran);
        
      if (!nkError && nkData && nkData.length > 0) {
        let total = nkData.length;
        let counts = { sosial: {}, dukungan: {}, minat: {} };
        nkData.forEach(d => {
          if (d.sosial_emosional) counts.sosial[d.sosial_emosional] = (counts.sosial[d.sosial_emosional] || 0) + 1;
          if (d.dukungan_belajar) counts.dukungan[d.dukungan_belajar] = (counts.dukungan[d.dukungan_belajar] || 0) + 1;
          if (d.minat_dominan) counts.minat[d.minat_dominan] = (counts.minat[d.minat_dominan] || 0) + 1;
        });

        rekapKarakteristik = `Berdasarkan data asesmen diagnostik untuk ${total} siswa Kelas ${activeRombel}:\n`;
        rekapKarakteristik += `Profil Non-Kognitif:\n`;
        rekapKarakteristik += `- Kesiapan Sosial Emosional: ${Object.entries(counts.sosial).map(([k,v]) => `${k} (${v})`).join(', ')}\n`;
        rekapKarakteristik += `- Dukungan Belajar di Rumah: ${Object.entries(counts.dukungan).map(([k,v]) => `${k} (${v})`).join(', ')}\n`;
        rekapKarakteristik += `- Minat Dominan: ${Object.entries(counts.minat).map(([k,v]) => `${k} (${v})`).join(', ')}\n`;
      }

      // 6b. Kognitif Umum
      const { data: kogData, error: kogError } = await supabaseAdmin
        .from('hasil_kognitif_murid')
        .select('kategori_literasi, kategori_numerasi')
        .eq('rombel', activeRombel)
        .eq('tahun_ajaran', tahunPelajaran)
        .eq('semester', semester);

      if (!kogError && kogData && kogData.length > 0) {
        let countsKog = { literasi: {}, numerasi: {} };
        kogData.forEach(d => {
          if (d.kategori_literasi) countsKog.literasi[d.kategori_literasi] = (countsKog.literasi[d.kategori_literasi] || 0) + 1;
          if (d.kategori_numerasi) countsKog.numerasi[d.kategori_numerasi] = (countsKog.numerasi[d.kategori_numerasi] || 0) + 1;
        });
        
        rekapKarakteristik += `\nProfil Kognitif (Asesmen Awal):\n`;
        rekapKarakteristik += `- Kemampuan Literasi: ${Object.entries(countsKog.literasi).map(([k,v]) => `${k} (${v})`).join(', ')}\n`;
        rekapKarakteristik += `- Kemampuan Numerasi: ${Object.entries(countsKog.numerasi).map(([k,v]) => `${k} (${v})`).join(', ')}`;
      }
    }

    // Jika data benar-benar kosong di database, tampilkan data SIMULASI agar fitur autofill bisa diuji
    if (!rekapKarakteristik) {
      rekapKarakteristik = `[DATA SIMULASI - KARENA ASESMEN KELAS ${activeRombel || 'INI'} MASIH KOSONG]
Berdasarkan data asesmen diagnostik untuk 25 siswa Kelas ${activeRombel || 'Simulasi'}:

Profil Non-Kognitif:
- Kesiapan Sosial Emosional: Antusias (18), Biasa saja (5), Cemas/Takut (2)
- Dukungan Belajar di Rumah: Didampingi (15), Mandiri (7), Sering kesulitan (3)
- Minat Dominan: Teknologi (10), Olahraga (8), Seni (4), Membaca (3)

Profil Kognitif (Asesmen Awal):
- Kemampuan Literasi: Cakap (14), Berkembang (8), Perlu Bimbingan (3)
- Kemampuan Numerasi: Cakap (10), Berkembang (11), Perlu Bimbingan (4)`;
    }

    const responseData = {
      Nama_Sekolah: "MI Miftahul Khoir 1 Karangrejo",
      Nama_Yayasan: "Yayasan NU Miftakhul Khoir Damarjati",
      Jalan: "Jalan Sumber Keling No. 11, Dsn. Krajan, Ds. Karangrejo",
      Nama_Kepsek: kepsekData?.nama || "-",
      NIP_Kepsek: kepsekData?.id_user || "-",
      Tahun_Pelajaran: tahunPelajaran,
      Semester: semester,
      siakadKarakteristik: rekapKarakteristik,
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
