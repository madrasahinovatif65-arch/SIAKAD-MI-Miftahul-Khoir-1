import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

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
 * AI Grading untuk soal isian (fill-in-the-blank).
 * Mengirimkan semua soal fill ke Gemini sekaligus dalam satu request
 * untuk meminimalkan latensi.
 */
async function aiGradeFill(fillSoalList) {
  if (!fillSoalList || fillSoalList.length === 0) return {};

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[AI Grading] GEMINI_API_KEY tidak ditemukan, fallback ke exact match.');
    const fallback = {};
    for (const s of fillSoalList) {
      fallback[s.id] = s.jawaban_murid?.trim().toLowerCase() === s.jawaban_benar?.trim().toLowerCase();
    }
    return fallback;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const soalJson = fillSoalList.map((s, i) => ({
      no: i + 1,
      id: s.id,
      pertanyaan: s.teks_pertanyaan,
      kunci: s.jawaban_benar,
      jawaban_murid: s.jawaban_murid,
    }));

    const prompt = `Kamu adalah penilai jawaban isian siswa sekolah dasar di Indonesia.
Untuk setiap soal di bawah, tentukan apakah jawaban murid BENAR secara makna/semantik meskipun berbeda kata atau ada typo ringan.
Pertimbangkan konteks anak SD: jawaban tidak harus sama persis, yang penting maknanya relevan dan menunjukkan pemahaman yang benar.

Soal: ${JSON.stringify(soalJson)}

Jawab HANYA dalam format JSON array seperti ini (jangan tambahkan teks lain):
[{"id":"<uuid>","benar":true},{"id":"<uuid>","benar":false},...]`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const clean = text.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(clean);

    const resultMap = {};
    for (const item of parsed) {
      resultMap[item.id] = Boolean(item.benar);
    }
    return resultMap;

  } catch (err) {
    console.error('[AI Grading] Error:', err.message);
    const fallback = {};
    for (const s of fillSoalList) {
      fallback[s.id] = s.jawaban_murid?.trim().toLowerCase() === s.jawaban_benar?.trim().toLowerCase();
    }
    return fallback;
  }
}

/**
 * Hitung ulang skor dari jawaban.
 * Digunakan saat POST awal (murid submit) maupun PATCH (guru koreksi).
 */
async function hitungSkor(jawaban, soalData) {
  const hitungan = {
    literasi:  { benar: 0, total: 0 },
    numerasi:  { benar: 0, total: 0 },
    reasoning: { benar: 0, total: 0 },
  };

  // Kumpulkan soal fill untuk AI batch grading
  const fillSoalList = [];
  for (const soal of soalData) {
    if (soal.tipe_jawaban === 'fill') {
      fillSoalList.push({
        id: soal.id,
        teks_pertanyaan: soal.teks_pertanyaan,
        jawaban_benar: soal.jawaban_benar,
        jawaban_murid: jawaban[soal.id] || '',
      });
    }
  }

  // Satu request ke Gemini untuk semua soal fill
  const aiResult = await aiGradeFill(fillSoalList);

  // Rakit raw_jawaban dan hitung poin per dimensi
  const rawJawaban = {};
  for (const soal of soalData) {
    const dim = soal.dimensi;
    if (!hitungan[dim]) continue;

    hitungan[dim].total++;
    const jawabanMurid = jawaban[soal.id] || '';
    let isBenar = false;

    if (soal.tipe_jawaban === 'fill') {
      isBenar = aiResult[soal.id] ?? false;
    } else {
      const opsi = (soal.opsi_jawaban || []).find(o => o.label === jawabanMurid);
      isBenar = opsi?.is_correct ?? false;
    }

    if (isBenar) hitungan[dim].benar++;

    rawJawaban[soal.id] = {
      teks_pertanyaan: soal.teks_pertanyaan,
      tipe_jawaban: soal.tipe_jawaban,
      opsi_jawaban: soal.opsi_jawaban || null,
      jawaban_benar: soal.jawaban_benar || null,
      jawaban_murid: jawabanMurid,
      ai_benar: soal.tipe_jawaban === 'fill' ? (aiResult[soal.id] ?? false) : undefined,
      is_benar: isBenar,
      dimensi: dim,
    };
  }

  const persen = (dim) => hitungan[dim].total > 0
    ? Math.round((hitungan[dim].benar / hitungan[dim].total) * 100)
    : null;

  return {
    skor_literasi:  persen('literasi'),
    skor_numerasi:  persen('numerasi'),
    skor_reasoning: persen('reasoning'),
    raw_jawaban: rawJawaban,
  };
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * GET /api/asesmen/kognitif-interaktif
 * - ?rombel=...  â†’ Guru: daftar hasil sekelas
 * - ?fase=A&id_murid=... â†’ Murid: ambil soal tes
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const fase         = searchParams.get('fase');
  const tahun_ajaran = searchParams.get('tahun_ajaran');
  const semester     = searchParams.get('semester');
  const id_murid     = searchParams.get('id_murid');
  const rombel       = searchParams.get('rombel');

  try {
    // Mode Guru: ambil data satu rombel
    if (rombel && tahun_ajaran && semester) {
      const { data: hasil, error } = await supabase
        .from('hasil_kognitif_murid')
        .select('*')
        .eq('rombel', rombel)
        .eq('tahun_ajaran', tahun_ajaran)
        .eq('semester', semester);

      if (error) throw error;
      return NextResponse.json(hasil || []);
    }

    if (!fase) {
      return NextResponse.json({ error: 'Parameter fase wajib diisi.' }, { status: 400 });
    }

    // Cek sudah pernah dikerjakan
    if (id_murid && tahun_ajaran && semester) {
      const { data: existing } = await supabase
        .from('hasil_kognitif_murid')
        .select('id, skor_literasi, skor_numerasi, skor_reasoning, kategori_literasi, kategori_numerasi, kategori_reasoning, dikerjakan_at')
        .eq('id_murid', id_murid)
        .eq('tahun_ajaran', tahun_ajaran)
        .eq('semester', semester)
        .single();

      if (existing) {
        return NextResponse.json({ sudah_dikerjakan: true, hasil: existing });
      }
    }

    // Ambil soal aktif
    const { data: soal, error } = await supabase
      .from('bank_soal_kognitif')
      .select('*')
      .eq('fase', fase)
      .eq('aktif', true)
      .order('dimensi')
      .order('urutan');

    if (error) throw error;

    const MAKS_PER_DIMENSI = 5;
    const grouped = { literasi: [], numerasi: [], reasoning: [] };
    for (const s of (soal || [])) {
      if (grouped[s.dimensi]) grouped[s.dimensi].push(s);
    }

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

    return NextResponse.json({ sudah_dikerjakan: false, soal: sesi, total: sesi.length });

  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/asesmen/kognitif-interaktif
 * Murid submit jawaban â†’ AI grading soal fill â†’ simpan skor & raw_jawaban
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { id_murid, nama_murid, rombel, tahun_ajaran, semester, fase, jawaban, catatan_guru, divalidasi_oleh } = body;

    if (!id_murid || !tahun_ajaran || !semester || !fase || !jawaban) {
      return NextResponse.json(
        { error: 'id_murid, tahun_ajaran, semester, fase, dan jawaban wajib diisi.' },
        { status: 400 }
      );
    }

    const idSoalList = Object.keys(jawaban);
    const { data: soalData, error: soalErr } = await supabase
      .from('bank_soal_kognitif')
      .select('id, dimensi, tipe_jawaban, opsi_jawaban, jawaban_benar, teks_pertanyaan')
      .in('id', idSoalList);

    if (soalErr) throw soalErr;

    const { skor_literasi, skor_numerasi, skor_reasoning, raw_jawaban } = await hitungSkor(jawaban, soalData || []);

    const { error: saveErr } = await supabase
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
        raw_jawaban,
        catatan_guru: catatan_guru || null,
        divalidasi_oleh: divalidasi_oleh || null,
        divalidasi_at: divalidasi_oleh ? new Date().toISOString() : null,
        dikerjakan_at: new Date().toISOString(),
        updated_at:    new Date().toISOString(),
      }, {
        onConflict: 'id_murid,tahun_ajaran,semester',
      });

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
 * PATCH /api/asesmen/kognitif-interaktif?id_murid=...&tahun_ajaran=...&semester=...
 * Guru mengoreksi jawaban murid â†’ hitung ulang skor dengan AI.
 * Body: { jawaban_koreksi: { [id_soal]: string }, catatan_guru, divalidasi_oleh }
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
    const { jawaban_koreksi, catatan_guru, divalidasi_oleh } = body;

    const idSoalList = Object.keys(jawaban_koreksi || {});
    if (idSoalList.length === 0) {
      return NextResponse.json({ error: 'jawaban_koreksi wajib berisi data.' }, { status: 400 });
    }

    const { data: soalData, error: soalErr } = await supabase
      .from('bank_soal_kognitif')
      .select('id, dimensi, tipe_jawaban, opsi_jawaban, jawaban_benar, teks_pertanyaan')
      .in('id', idSoalList);

    if (soalErr) throw soalErr;

    // Hitung ulang skor dengan jawaban koreksi guru (+ AI grading ulang untuk fill)
    const { skor_literasi, skor_numerasi, skor_reasoning, raw_jawaban } = await hitungSkor(jawaban_koreksi, soalData || []);

    const { data, error } = await supabase
      .from('hasil_kognitif_murid')
      .update({
        skor_literasi,
        skor_numerasi,
        skor_reasoning,
        kategori_literasi:  skorKeKategori(skor_literasi),
        kategori_numerasi:  skorKeKategori(skor_numerasi),
        kategori_reasoning: skorKeKategori(skor_reasoning),
        raw_jawaban,
        catatan_guru:       catatan_guru    || null,
        divalidasi_at:      new Date().toISOString(),
        divalidasi_oleh:    divalidasi_oleh || null,
        updated_at:         new Date().toISOString(),
        // Override lama dihapus karena skor kini dihitung ulang dari jawaban
        override_literasi:  null,
        override_numerasi:  null,
        override_reasoning: null,
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

