import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * POST /api/asesmen/sync-enrollment
 * Body: { tahun_ajaran: '2026/2027', semester: 'Ganjil' }
 *
 * Menarik semua murid aktif dari master_user dan memasukkannya ke enrollment_murid.
 * Menggunakan ON CONFLICT DO NOTHING (aman dijalankan berulang kali).
 * Mengembalikan laporan { synced: N, skipped: M }.
 */
export async function POST(request) {
  try {
    const { tahun_ajaran, semester } = await request.json();

    if (!tahun_ajaran || !semester) {
      return NextResponse.json(
        { error: 'tahun_ajaran dan semester wajib diisi.' },
        { status: 400 }
      );
    }

    if (!['Ganjil', 'Genap'].includes(semester)) {
      return NextResponse.json(
        { error: 'semester harus "Ganjil" atau "Genap".' },
        { status: 400 }
      );
    }

    // 1. Ambil semua murid aktif dari master_user
    const { data: muridList, error: errMurid } = await supabase
      .from('master_user')
      .select('id_user, nama, rombel')
      .eq('role', 'Murid')
      .eq('status_aktif', 'Aktif');

    if (errMurid) throw errMurid;
    if (!muridList || muridList.length === 0) {
      return NextResponse.json({ synced: 0, skipped: 0, message: 'Tidak ada murid aktif.' });
    }

    // 2. Susun payload enrollment
    // tingkat_kelas diambil dari rombel (cth: 'Kelas 4A' → 'Kelas 4')
    const enrollmentPayloads = muridList.map(m => {
      const tingkat = m.rombel ? m.rombel.replace(/[A-Z]$/, '').trim() : '';
      return {
        id_murid: m.id_user,
        nama_murid: m.nama,
        rombel: m.rombel || '',
        tingkat_kelas: tingkat,
        tahun_ajaran,
        semester,
      };
    });

    // 3. Insert dengan ON CONFLICT DO NOTHING
    // Upsert menggunakan ignoreDuplicates (supabase-js equivalent dari ON CONFLICT DO NOTHING)
    const { data: inserted, error: errInsert } = await supabase
      .from('enrollment_murid')
      .upsert(enrollmentPayloads, {
        onConflict: 'id_murid,tahun_ajaran,semester',
        ignoreDuplicates: true,
      })
      .select('id');

    if (errInsert) throw errInsert;

    const synced = inserted?.length || 0;
    const skipped = muridList.length - synced;

    return NextResponse.json({
      success: true,
      total: muridList.length,
      synced,
      skipped,
      message: `Berhasil menambahkan ${synced} murid, ${skipped} sudah ada (dilewati).`,
    });

  } catch (err) {
    console.error('[Sync Enrollment] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: err.message },
      { status: 500 }
    );
  }
}
