import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * GET /api/asesmen?rombel=...&mapel=...&jenis=...&semester=...&tahun_ajaran=...
 * Ambil daftar asesmen. Murid diambil dari enrollment_murid (historis).
 *
 * POST /api/asesmen
 * Simpan 1 asesmen baru.
 *
 * PATCH /api/asesmen?id=...
 * Update asesmen (guru edit narasi, dll.)
 *
 * DELETE /api/asesmen?id=...
 * Hapus asesmen. Validasi: pembuat sendiri, < 7 hari, belum ada narasi_rapor.
 */

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const rombel = searchParams.get('rombel');
  const mapel = searchParams.get('mapel');
  const jenis = searchParams.get('jenis');
  const semester = searchParams.get('semester');
  const tahun_ajaran = searchParams.get('tahun_ajaran');
  const id_murid = searchParams.get('id_murid');
  const id_guru = searchParams.get('id_guru');

  try {
    let query = supabase
      .from('asesmen')
      .select('*')
      .order('tanggal', { ascending: false });

    if (rombel) query = query.eq('rombel', rombel);
    if (mapel) query = query.eq('mata_pelajaran', mapel);
    if (jenis) query = query.eq('jenis', jenis);
    if (semester) query = query.eq('semester', semester);
    if (tahun_ajaran) query = query.eq('tahun_ajaran', tahun_ajaran);
    if (id_murid) query = query.eq('id_murid', id_murid);
    if (id_guru) query = query.eq('id_guru', id_guru);

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
      id_guru, id_murid, nama_murid, rombel, tahun_ajaran, semester,
      jenis, tanggal, mata_pelajaran, id_tp, tujuan_pembelajaran,
      hasil_kognitif, catatan_guru, skor, narasi_rapor
    } = body;

    if (!id_guru || !id_murid || !rombel || !tahun_ajaran || !semester || !jenis || !mata_pelajaran) {
      return NextResponse.json({ error: 'Field wajib tidak lengkap.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('asesmen')
      .insert({
        id_guru, id_murid, nama_murid, rombel, tahun_ajaran, semester,
        jenis, tanggal: tanggal || new Date().toISOString().split('T')[0],
        mata_pelajaran, id_tp, tujuan_pembelajaran,
        hasil_kognitif, catatan_guru, skor, narasi_rapor
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

    // Field yang boleh diupdate
    const allowed = [
      'hasil_kognitif', 'catatan_guru', 'skor', 'narasi_rapor',
      'tujuan_pembelajaran', 'id_tp', 'tanggal'
    ];
    const updates = {};
    allowed.forEach(key => {
      if (key in body) updates[key] = body[key];
    });

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Tidak ada field yang diupdate.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('asesmen')
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
  const id_guru_req = searchParams.get('id_guru'); // untuk validasi kepemilikan

  if (!id || !id_guru_req) {
    return NextResponse.json({ error: 'id dan id_guru wajib diisi.' }, { status: 400 });
  }

  try {
    // Ambil data asesmen untuk validasi
    const { data: existing, error: fetchErr } = await supabase
      .from('asesmen')
      .select('id, id_guru, created_at, narasi_rapor')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Asesmen tidak ditemukan.' }, { status: 404 });
    }

    // Validasi 1: hanya pembuat yang boleh hapus
    if (existing.id_guru !== id_guru_req) {
      return NextResponse.json(
        { error: 'Anda tidak berhak menghapus asesmen ini.' },
        { status: 403 }
      );
    }

    // Validasi 2: maksimal 7 hari setelah dibuat
    const createdAt = new Date(existing.created_at);
    const now = new Date();
    const diffDays = (now - createdAt) / (1000 * 60 * 60 * 24);
    if (diffDays > 7) {
      return NextResponse.json(
        { error: 'Asesmen tidak dapat dihapus setelah 7 hari dibuat.' },
        { status: 403 }
      );
    }

    // Validasi 3: tidak bisa hapus jika sudah ada narasi rapor
    if (existing.narasi_rapor) {
      return NextResponse.json(
        { error: 'Asesmen yang sudah memiliki narasi rapor tidak dapat dihapus.' },
        { status: 403 }
      );
    }

    const { error: delErr } = await supabase.from('asesmen').delete().eq('id', id);
    if (delErr) throw delErr;

    return NextResponse.json({ success: true });

  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
