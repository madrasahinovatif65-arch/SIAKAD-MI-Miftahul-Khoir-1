import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * GET /api/asesmen/profil-nk?rombel=...&tahun_ajaran=...
 * Ambil profil non-kognitif murid (3 dimensi: sosial-emosional, dukungan belajar, minat dominan)
 *
 * POST /api/asesmen/profil-nk
 * Body: { id_murid, id_wali_kelas, rombel, tahun_ajaran,
 *         sosial_emosional, dukungan_belajar, minat_dominan, catatan_khusus }
 * Upsert: update jika sudah ada (UNIQUE: id_murid + tahun_ajaran), insert jika belum
 */

const VALID_SOSIAL_EMOSIONAL = ['Antusias', 'Biasa saja', 'Cemas/Takut'];
const VALID_DUKUNGAN_BELAJAR  = ['Didampingi', 'Mandiri', 'Sering kesulitan'];
const VALID_MINAT_DOMINAN     = ['Seni', 'Olahraga', 'Teknologi', 'Membaca'];

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const rombel      = searchParams.get('rombel');
  const tahun_ajaran = searchParams.get('tahun_ajaran');
  const id_murid    = searchParams.get('id_murid');

  try {
    let query = supabase
      .from('profil_non_kognitif')
      .select('id_murid, sosial_emosional, dukungan_belajar, minat_dominan, catatan_khusus, tahun_ajaran, rombel');

    if (rombel)       query = query.eq('rombel', rombel);
    if (tahun_ajaran) query = query.eq('tahun_ajaran', tahun_ajaran);
    if (id_murid)     query = query.eq('id_murid', id_murid);

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
      sosial_emosional,
      dukungan_belajar,
      minat_dominan,
      catatan_khusus,
    } = body;

    if (!id_murid || !id_wali_kelas || !rombel || !tahun_ajaran) {
      return NextResponse.json(
        { error: 'id_murid, id_wali_kelas, rombel, dan tahun_ajaran wajib diisi.' },
        { status: 400 }
      );
    }

    // Validasi nilai enum (null diperbolehkan — belum diisi)
    if (sosial_emosional && !VALID_SOSIAL_EMOSIONAL.includes(sosial_emosional)) {
      return NextResponse.json(
        { error: `sosial_emosional tidak valid. Pilih: ${VALID_SOSIAL_EMOSIONAL.join(', ')}` },
        { status: 400 }
      );
    }
    if (dukungan_belajar && !VALID_DUKUNGAN_BELAJAR.includes(dukungan_belajar)) {
      return NextResponse.json(
        { error: `dukungan_belajar tidak valid. Pilih: ${VALID_DUKUNGAN_BELAJAR.join(', ')}` },
        { status: 400 }
      );
    }
    if (minat_dominan && !VALID_MINAT_DOMINAN.includes(minat_dominan)) {
      return NextResponse.json(
        { error: `minat_dominan tidak valid. Pilih: ${VALID_MINAT_DOMINAN.join(', ')}` },
        { status: 400 }
      );
    }

    // Upsert: update jika sudah ada (UNIQUE: id_murid + tahun_ajaran)
    const { data, error } = await supabase
      .from('profil_non_kognitif')
      .upsert(
        {
          id_murid,
          id_wali_kelas,
          rombel,
          tahun_ajaran,
          sosial_emosional: sosial_emosional || null,
          dukungan_belajar: dukungan_belajar || null,
          minat_dominan:    minat_dominan || null,
          catatan_khusus:   catatan_khusus || null,
        },
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
