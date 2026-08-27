import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * GET /api/asesmen/bank-soal?fase=A&dimensi=literasi&aktif=true
 * Ambil daftar soal dari bank soal (Admin/manajemen atau sistem tes)
 *
 * POST /api/asesmen/bank-soal
 * Tambah soal baru (Admin/Kurikulum only)
 *
 * PATCH /api/asesmen/bank-soal?id=UUID
 * Edit soal atau toggle aktif/nonaktif
 *
 * DELETE /api/asesmen/bank-soal?id=UUID
 * Hapus soal
 */

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const fase    = searchParams.get('fase');
  const dimensi = searchParams.get('dimensi');
  const aktif   = searchParams.get('aktif'); // 'true' | 'false' | null (semua)
  const limit   = parseInt(searchParams.get('limit') || '0');

  try {
    let query = supabase
      .from('bank_soal_kognitif')
      .select('*')
      .order('urutan', { ascending: true })
      .order('created_at', { ascending: true });

    if (fase)    query = query.eq('fase', fase);
    if (dimensi) query = query.eq('dimensi', dimensi);
    if (aktif !== null && aktif !== undefined) query = query.eq('aktif', aktif === 'true');
    if (limit > 0) query = query.limit(limit);

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
      fase, dimensi, teks_pertanyaan, tipe_jawaban,
      opsi_jawaban, jawaban_benar, urutan, dibuat_oleh
    } = body;

    if (!fase || !dimensi || !teks_pertanyaan || !tipe_jawaban) {
      return NextResponse.json(
        { error: 'fase, dimensi, teks_pertanyaan, dan tipe_jawaban wajib diisi.' },
        { status: 400 }
      );
    }

    // Validasi tipe_jawaban ↔ data
    if (tipe_jawaban === 'fill' && !jawaban_benar) {
      return NextResponse.json(
        { error: 'Soal tipe fill wajib mengisi jawaban_benar.' },
        { status: 400 }
      );
    }
    if ((tipe_jawaban === 'emoji' || tipe_jawaban === 'dropdown') && !opsi_jawaban) {
      return NextResponse.json(
        { error: `Soal tipe ${tipe_jawaban} wajib mengisi opsi_jawaban.` },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('bank_soal_kognitif')
      .insert({
        fase, dimensi, teks_pertanyaan, tipe_jawaban,
        opsi_jawaban: opsi_jawaban || null,
        jawaban_benar: jawaban_benar || null,
        urutan: urutan || 0,
        aktif: true,
        dibuat_oleh: dibuat_oleh || null,
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
    const body = await request.json();
    // Hanya izinkan field yang bisa diupdate
    const allowed = [
      'teks_pertanyaan', 'tipe_jawaban', 'opsi_jawaban',
      'jawaban_benar', 'urutan', 'aktif'
    ];
    const updates = Object.fromEntries(
      Object.entries(body).filter(([k]) => allowed.includes(k))
    );
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('bank_soal_kognitif')
      .update(updates)
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
      .from('bank_soal_kognitif')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });

  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
