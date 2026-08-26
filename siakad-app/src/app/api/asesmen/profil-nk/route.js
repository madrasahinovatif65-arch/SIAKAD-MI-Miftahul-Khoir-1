import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * GET /api/asesmen/profil-nk?rombel=...&tahun_ajaran=...
 * Ambil profil non-kognitif murid untuk tampilan badge di Guru Mapel.
 *
 * POST /api/asesmen/profil-nk
 * Body: { id_murid, id_wali_kelas, rombel, tahun_ajaran, gaya_belajar, catatan_emosional, catatan_khusus }
 * Wali Kelas input profil (upsert: update jika sudah ada, insert jika belum)
 *
 * PATCH /api/asesmen/profil-nk?id_murid=...&tahun_ajaran=...
 * Update profil yang sudah ada
 */

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const rombel = searchParams.get('rombel');
  const tahun_ajaran = searchParams.get('tahun_ajaran');
  const id_murid = searchParams.get('id_murid');

  try {
    let query = supabase
      .from('profil_non_kognitif')
      .select('id_murid, gaya_belajar, catatan_emosional, catatan_khusus, tahun_ajaran');

    if (rombel) query = query.eq('rombel', rombel);
    if (tahun_ajaran) query = query.eq('tahun_ajaran', tahun_ajaran);
    if (id_murid) query = query.eq('id_murid', id_murid);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      id_murid,
      id_wali_kelas,
      rombel,
      tahun_ajaran,
      gaya_belajar,
      catatan_emosional,
      catatan_khusus
    } = body;

    if (!id_murid || !id_wali_kelas || !rombel || !tahun_ajaran) {
      return NextResponse.json(
        { error: 'id_murid, id_wali_kelas, rombel, dan tahun_ajaran wajib diisi.' },
        { status: 400 }
      );
    }

    // Validasi gaya_belajar
    const validGaya = ['Visual', 'Auditori', 'Kinestetik', 'Campuran'];
    if (gaya_belajar && !validGaya.includes(gaya_belajar)) {
      return NextResponse.json(
        { error: 'gaya_belajar tidak valid. Pilih: Visual, Auditori, Kinestetik, atau Campuran.' },
        { status: 400 }
      );
    }

    // Upsert: update jika sudah ada (UNIQUE: id_murid + tahun_ajaran)
    const { data, error } = await supabase
      .from('profil_non_kognitif')
      .upsert(
        { id_murid, id_wali_kelas, rombel, tahun_ajaran, gaya_belajar, catatan_emosional, catatan_khusus },
        { onConflict: 'id_murid,tahun_ajaran' }
      )
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 200 });

  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
