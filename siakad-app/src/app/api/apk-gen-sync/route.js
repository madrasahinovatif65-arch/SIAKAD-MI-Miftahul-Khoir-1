import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request) {
  try {
    // 1. Ambil data pengaturan sekolah
    const { data: pengaturanData, error: pengaturanError } = await supabase
      .from('pengaturan_sekolah')
      .select('tahun_ajaran')
      .limit(1)
      .single();

    if (pengaturanError && pengaturanError.code !== 'PGRST116') {
      throw pengaturanError;
    }

    const tahunPelajaran = pengaturanData?.tahun_ajaran || '2026/2027';

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
      .select('nama, id_user, mapel, role')
      .neq('role', 'Murid')
      .order('nama', { ascending: true });

    if (guruError) {
      throw guruError;
    }

    // 4. Transformasi dan Mapping Data sesuai kebutuhan APK Gen
    // APK Gen biasanya memproses array data, maka kita akan buatkan array guru,
    // di mana setiap item di array memiliki data sekolah/kepsek yang sama (redundant tapi aman untuk diparsing per baris).
    
    // Atau jika APK Gen mengharapkan response JSON terpisah antara setting dan list guru:
    const responseData = {
      // Data Pengaturan Global
      Nama_Sekolah: "MI Miftahul Khoir 1 Karangrejo",
      Nama_Kepsek: kepsekData?.nama || "-",
      NIP_Kepsek: kepsekData?.id_user || "-",
      Tahun_Pelajaran: tahunPelajaran,
      Kantor_Kemenag: "-",
      Pemerintah: "-",
      Nama_Yayasan: "Yayasan NU Miftakhul Khoir Damarjati",
      
      // Data Guru
      Guru: guruData.map(guru => ({
        Nama_Guru: guru.nama,
        NIP_Guru: guru.id_user,
        siakadMapel: guru.mapel,
        siakadRole: guru.role
      }))
    };

    return NextResponse.json(responseData, { status: 200 });
  } catch (error) {
    console.error('Error in apk-gen-sync:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
