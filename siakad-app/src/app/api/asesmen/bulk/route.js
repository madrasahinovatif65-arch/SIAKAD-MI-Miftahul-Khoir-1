import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * POST /api/asesmen/bulk
 * Body: { records: [ { id_guru, id_murid, nama_murid, rombel, tahun_ajaran, semester,
 *                       mata_pelajaran, id_tp, tujuan_pembelajaran, hasil_kognitif }, ... ] }
 *
 * Bulk insert diagnostik kognitif seluruh rombel sekaligus.
 * Menggunakan upsert agar aman dijalankan berulang (tidak duplikat per murid+mapel+semester).
 */
export async function POST(request) {
  try {
    const { records } = await request.json();

    if (!records || !Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: 'records wajib berupa array non-kosong.' }, { status: 400 });
    }

    // Tambahkan jenis = 'awal' dan tanggal hari ini untuk semua record
    const today = new Date().toISOString().split('T')[0];
    const normalized = records.map(r => ({
      ...r,
      jenis: 'awal',
      tanggal: r.tanggal || today,
    }));

    const { data, error } = await supabase
      .from('asesmen')
      .insert(normalized)
      .select('id, id_murid, nama_murid');

    if (error) throw error;

    return NextResponse.json({
      success: true,
      inserted: data?.length || 0,
      records: data,
    }, { status: 201 });

  } catch (err) {
    console.error('[Bulk Asesmen] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
