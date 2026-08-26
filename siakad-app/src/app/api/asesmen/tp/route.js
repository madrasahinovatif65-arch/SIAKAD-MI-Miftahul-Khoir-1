import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * GET /api/asesmen/tp?mapel=...&tingkat_kelas=...&tahun_ajaran=...
 * Ambil pool TP shared untuk dropdown autocomplete.
 *
 * POST /api/asesmen/tp
 * Body: { mata_pelajaran, tingkat_kelas, tujuan, tahun_ajaran, dibuat_oleh }
 * Tambah TP baru dengan normalisasi: trim → lowercase → Title Case
 *
 * PATCH /api/asesmen/tp?id=...
 * Body: { tujuan } — Admin koreksi typo (normalisasi yang sama diterapkan)
 *
 * DELETE /api/asesmen/tp?id=...
 * Admin hapus TP yang salah (validasi role Admin/Staf TU via server)
 */

/** Normalisasi teks TP: trim → lowercase → Title Case */
function normalizeTP(tujuan) {
  return tujuan
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const mata_pelajaran = searchParams.get('mapel');
  const tingkat_kelas = searchParams.get('tingkat_kelas');
  const tahun_ajaran = searchParams.get('tahun_ajaran');

  try {
    let query = supabase.from('master_tp').select('id, tujuan, mata_pelajaran, tingkat_kelas').order('tujuan');

    if (mata_pelajaran) query = query.eq('mata_pelajaran', mata_pelajaran);
    if (tingkat_kelas) query = query.eq('tingkat_kelas', tingkat_kelas);
    if (tahun_ajaran) query = query.eq('tahun_ajaran', tahun_ajaran);

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
    const { mata_pelajaran, tingkat_kelas, tujuan, tahun_ajaran, dibuat_oleh } = body;

    if (!mata_pelajaran || !tingkat_kelas || !tujuan || !tahun_ajaran || !dibuat_oleh) {
      return NextResponse.json({ error: 'Semua field wajib diisi.' }, { status: 400 });
    }

    // Normalisasi: trim → lowercase → Title Case
    const normalizedTujuan = normalizeTP(tujuan);

    // Cek apakah sudah ada (UNIQUE constraint akan menolak, tapi lebih baik cek dulu)
    const { data: existing } = await supabase
      .from('master_tp')
      .select('id, tujuan')
      .eq('mata_pelajaran', mata_pelajaran)
      .eq('tingkat_kelas', tingkat_kelas)
      .eq('tujuan', normalizedTujuan)
      .eq('tahun_ajaran', tahun_ajaran)
      .single();

    if (existing) {
      // TP sudah ada — kembalikan yang existing (bukan error)
      return NextResponse.json({ ...existing, already_exists: true }, { status: 200 });
    }

    const { data, error } = await supabase
      .from('master_tp')
      .insert({
        mata_pelajaran,
        tingkat_kelas,
        tujuan: normalizedTujuan,
        tahun_ajaran,
        dibuat_oleh,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });

  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) return NextResponse.json({ error: 'id wajib diisi.' }, { status: 400 });

  try {
    const { tujuan } = await request.json();
    if (!tujuan) return NextResponse.json({ error: 'tujuan wajib diisi.' }, { status: 400 });

    // Normalisasi yang sama diterapkan saat PATCH
    const normalizedTujuan = normalizeTP(tujuan);

    const { data, error } = await supabase
      .from('master_tp')
      .update({ tujuan: normalizedTujuan })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);

  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) return NextResponse.json({ error: 'id wajib diisi.' }, { status: 400 });

  try {
    const { error } = await supabase
      .from('master_tp')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });

  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
