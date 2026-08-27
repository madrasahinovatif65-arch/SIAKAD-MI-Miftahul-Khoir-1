import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/** Konversi skor (%) ke kategori teks */
function skorKeKategori(skor) {
  if (skor === null || skor === undefined) return null;
  if (skor >= 85) return 'Sangat Cakap';
  if (skor >= 70) return 'Cakap';
  if (skor >= 50) return 'Berkembang';
  return 'Perlu Bimbingan';
}

/**
 * GET /api/asesmen/kognitif-interaktif?fase=A&tahun_ajaran=...&semester=...
 * Ambil soal acak per dimensi (5 soal per dimensi = 15 total) untuk sesi tes murid.
 * Soal diacak agar murid yang berbeda mendapat urutan berbeda.
 *
 * POST /api/asesmen/kognitif-interaktif
 * Body: { id_murid, nama_murid, rombel, tahun_ajaran, semester, fase, jawaban: { [id_soal]: jawaban } }
 * Hitung skor tiap dimensi, simpan ke hasil_kognitif_murid.
 */

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const fase         = searchParams.get('fase');
  const tahun_ajaran = searchParams.get('tahun_ajaran');
  const semester     = searchParams.get('semester');
  const id_murid     = searchParams.get('id_murid');

  if (!fase) {
    return NextResponse.json({ error: 'Parameter fase wajib diisi.' }, { status: 400 });
  }

  try {
    // Cek apakah murid sudah pernah mengerjakan tes ini
    if (id_murid && tahun_ajaran && semester) {
      const { data: existing } = await supabase
        .from('hasil_kognitif_murid')
        .select('id, skor_literasi, skor_numerasi, skor_reasoning, dikerjakan_at')
        .eq('id_murid', id_murid)
        .eq('tahun_ajaran', tahun_ajaran)
        .eq('semester', semester)
        .single();

      if (existing) {
        return NextResponse.json({ sudah_dikerjakan: true, hasil: existing });
      }
    }

    // Ambil semua soal aktif untuk fase ini
    const { data: soal, error } = await supabase
      .from('bank_soal_kognitif')
      .select('*')
      .eq('fase', fase)
      .eq('aktif', true)
      .order('dimensi')
      .order('urutan');

    if (error) throw error;

    // Kelompokkan per dimensi, ambil maks 5 soal per dimensi secara acak
    const MAKS_PER_DIMENSI = 5;
    const grouped = { literasi: [], numerasi: [], reasoning: [] };
    for (const s of (soal || [])) {
      if (grouped[s.dimensi]) grouped[s.dimensi].push(s);
    }

    // Fisher-Yates shuffle per dimensi, ambil 5 teratas
    const shuffle = (arr) => {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };

    const sesi = [
      ...shuffle(grouped.literasi).slice(0, MAKS_PER_DIMENSI).map((s, i) => ({ ...s, nomor_urut: i + 1 })),
      ...shuffle(grouped.numerasi).slice(0, MAKS_PER_DIMENSI).map((s, i) => ({ ...s, nomor_urut: i + 1 })),
      ...shuffle(grouped.reasoning).slice(0, MAKS_PER_DIMENSI).map((s, i) => ({ ...s, nomor_urut: i + 1 })),
    ];

    return NextResponse.json({
      sudah_dikerjakan: false,
      soal: sesi,
      total: sesi.length,
    });

  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      id_murid, nama_murid, rombel,
      tahun_ajaran, semester, fase,
      jawaban // { [id_soal]: "label_jawaban_yang_dipilih" | "teks_isian" }
    } = body;

    if (!id_murid || !tahun_ajaran || !semester || !fase || !jawaban) {
      return NextResponse.json(
        { error: 'id_murid, tahun_ajaran, semester, fase, dan jawaban wajib diisi.' },
        { status: 400 }
      );
    }

    // Ambil soal yang ada di sesi ini berdasarkan id-id soal yang dijawab
    const idSoalList = Object.keys(jawaban);
    const { data: soalData, error: soalErr } = await supabase
      .from('bank_soal_kognitif')
      .select('id, dimensi, tipe_jawaban, opsi_jawaban, jawaban_benar')
      .in('id', idSoalList);

    if (soalErr) throw soalErr;

    // Hitung skor per dimensi
    const hasil = { literasi: { benar: 0, total: 0 }, numerasi: { benar: 0, total: 0 }, reasoning: { benar: 0, total: 0 } };

    for (const soal of (soalData || [])) {
      const dim = soal.dimensi;
      if (!hasil[dim]) continue;

      hasil[dim].total++;
      const jawabanMurid = jawaban[soal.id];

      if (soal.tipe_jawaban === 'fill') {
        // Toleransi: lowercase + trim
        if (jawabanMurid?.trim().toLowerCase() === soal.jawaban_benar?.trim().toLowerCase()) {
          hasil[dim].benar++;
        }
      } else {
        // emoji / dropdown: cek is_correct dari opsi yang dipilih
        const opsi = (soal.opsi_jawaban || []).find(o => o.label === jawabanMurid);
        if (opsi?.is_correct) hasil[dim].benar++;
      }
    }

    // Konversi ke persentase
    const skor = (dim) => hasil[dim].total > 0
      ? Math.round((hasil[dim].benar / hasil[dim].total) * 100)
      : null;

    const skor_literasi  = skor('literasi');
    const skor_numerasi  = skor('numerasi');
    const skor_reasoning = skor('reasoning');

    // Simpan ke DB (upsert karena ada UNIQUE constraint)
    const { data: saved, error: saveErr } = await supabase
      .from('hasil_kognitif_murid')
      .upsert({
        id_murid, nama_murid, rombel,
        tahun_ajaran, semester, fase,
        skor_literasi,
        skor_numerasi,
        skor_reasoning,
        kategori_literasi:  skorKeKategori(skor_literasi),
        kategori_numerasi:  skorKeKategori(skor_numerasi),
        kategori_reasoning: skorKeKategori(skor_reasoning),
        dikerjakan_at: new Date().toISOString(),
        updated_at:    new Date().toISOString(),
      }, {
        onConflict: 'id_murid,tahun_ajaran,semester',
      })
      .select()
      .single();

    if (saveErr) throw saveErr;

    return NextResponse.json({
      success: true,
      hasil: {
        skor_literasi,  kategori_literasi:  skorKeKategori(skor_literasi),
        skor_numerasi,  kategori_numerasi:  skorKeKategori(skor_numerasi),
        skor_reasoning, kategori_reasoning: skorKeKategori(skor_reasoning),
      },
    }, { status: 201 });

  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * PATCH /api/asesmen/kognitif-interaktif?id_murid=UUID&tahun_ajaran=...&semester=...
 * Guru meng-override hasil murid + tambah catatan
 */
export async function PATCH(request) {
  const { searchParams } = new URL(request.url);
  const id_murid     = searchParams.get('id_murid');
  const tahun_ajaran = searchParams.get('tahun_ajaran');
  const semester     = searchParams.get('semester');

  if (!id_murid || !tahun_ajaran || !semester) {
    return NextResponse.json({ error: 'id_murid, tahun_ajaran, semester wajib.' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { override_literasi, override_numerasi, override_reasoning, catatan_guru, divalidasi_oleh } = body;

    const { data, error } = await supabase
      .from('hasil_kognitif_murid')
      .update({
        override_literasi:  override_literasi  || null,
        override_numerasi:  override_numerasi  || null,
        override_reasoning: override_reasoning || null,
        catatan_guru:       catatan_guru       || null,
        divalidasi_at:      new Date().toISOString(),
        divalidasi_oleh:    divalidasi_oleh    || null,
        updated_at:         new Date().toISOString(),
      })
      .eq('id_murid', id_murid)
      .eq('tahun_ajaran', tahun_ajaran)
      .eq('semester', semester)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);

  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
