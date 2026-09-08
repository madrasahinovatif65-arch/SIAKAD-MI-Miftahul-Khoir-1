import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request) {
  try {
    // 1. Ambil data pengaturan sekolah (tahun ajaran + semester)
    const { data: pengaturanData, error: pengaturanError } = await supabase
      .from('pengaturan_sekolah')
      .select('tahun_ajaran, semester')
      .limit(1)
      .single();

    if (pengaturanError && pengaturanError.code !== 'PGRST116') {
      throw pengaturanError;
    }

    const tahunPelajaran = pengaturanData?.tahun_ajaran || '2026/2027';
    const semester = pengaturanData?.semester || 'Ganjil';

    // 2. Ambil data Kepala Madrasah
    const { data: kepsekData, error: kepsekError } = await supabase
      .from('master_user')
      .select('nama, id_user')
      .eq('role', 'Kepala Madrasah')
      .limit(1)
      .single();

    if (kepsekError && kepsekError.code !== 'PGRST116') {
      throw kepsekError;
    }

    // 3. Ambil data semua Guru
    const { data: guruData, error: guruError } = await supabase
      .from('master_user')
      .select('nama, id_user, mapel, role, rombel')
      .neq('role', 'Murid')
      .order('nama', { ascending: true });

    if (guruError) {
      throw guruError;
    }

    // 4. Transformasi dan Mapping Data sesuai kebutuhan APK Gen
    const responseData = {
      Nama_Sekolah: "MI Miftahul Khoir 1 Karangrejo",
      Nama_Yayasan: "Yayasan NU Miftakhul Khoir Damarjati",
      Jalan: "Jalan Sumber Keling No. 11, Dsn. Krajan, Ds. Karangrejo",
      Nama_Kepsek: kepsekData?.nama || "-",
      NIP_Kepsek: kepsekData?.id_user || "-",
      Tahun_Pelajaran: tahunPelajaran,
      Semester: semester,

      // Data Guru
      Guru: guruData.map(guru => {
        let formattedRombel = '';
        if (guru.rombel && guru.rombel !== '-' && guru.rombel.trim() !== '') {
          const match = guru.rombel.match(/\d+/);
          if (match) {
            const grade = parseInt(match[0], 10);
            let fase = '';
            if (grade === 1 || grade === 2) fase = 'A';
            else if (grade === 3 || grade === 4) fase = 'B';
            else if (grade === 5 || grade === 6) fase = 'C';
            
            if (fase) {
              formattedRombel = `Fase ${fase} / Kelas ${grade}`;
            }
          }
        }

        return {
          Nama_Guru: guru.nama,
          NIP_Guru: guru.id_user,
          siakadMapel: guru.mapel,
          siakadRole: guru.role,
          siakadRombel: formattedRombel
        };
      })
    };

    return NextResponse.json(responseData, { status: 200 });
  } catch (error) {
    console.error('Error in apk-gen-sync:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
