import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/** Pembatasan karakter per TP untuk mencegah prompt membengkak */
const MAX_TP_CHARS = 100;
/** Maksimal catatan formatif yang dikirim ke prompt */
const MAX_FORMATIF = 7;

/**
 * POST /api/asesmen/generate-rapor
 * Body: { id_murid, nama_murid, rombel, mata_pelajaran, semester, tahun_ajaran }
 *
 * Pipeline:
 * 1. Agregasi semua sumatif murid (multi-TP) untuk semester+mapel ini
 * 2. Ambil profil non-kognitif (gaya belajar)
 * 3. Ambil maks. 7 catatan formatif terbaru
 * 4. Deteksi blank state → pilih Normal atau Fallback Prompt
 * 5. Kirim ke Gemini API → kembalikan narasi
 *
 * PENTING: API ini hanya memproses 1 murid per request.
 * "Generate Semua" harus dilakukan via client-side sequential loop,
 * BUKAN Promise.all() paralel (risiko timeout Vercel 15 detik).
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { id_murid, nama_murid, rombel, mata_pelajaran, semester, tahun_ajaran } = body;

    if (!id_murid || !mata_pelajaran || !semester || !tahun_ajaran) {
      return NextResponse.json(
        { error: 'id_murid, mata_pelajaran, semester, dan tahun_ajaran wajib diisi.' },
        { status: 400 }
      );
    }

    // ── LANGKAH 1: Agregasi multi-TP dari semua sumatif ──────────────
    const { data: sumatifRows, error: errSumatif } = await supabase
      .from('asesmen')
      .select('tujuan_pembelajaran, skor, hasil_kognitif')
      .eq('id_murid', id_murid)
      .eq('jenis', 'sumatif')
      .eq('semester', semester)
      .eq('mata_pelajaran', mata_pelajaran)
      .eq('tahun_ajaran', tahun_ajaran)
      .order('tanggal', { ascending: true });

    if (errSumatif) throw errSumatif;
    if (!sumatifRows || sumatifRows.length === 0) {
      return NextResponse.json(
        { error: 'Belum ada data sumatif untuk murid ini di semester yang dipilih.' },
        { status: 404 }
      );
    }

    // Susun TP_LIST dengan pembatasan 100 karakter per TP
    const tpList = sumatifRows
      .map((row, i) => {
        const rawTp = row.tujuan_pembelajaran || 'Tanpa Judul TP';
        const tpText = rawTp.length > MAX_TP_CHARS
          ? rawTp.slice(0, MAX_TP_CHARS) + '...'
          : rawTp;
        const skor = row.skor !== null ? row.skor : 'N/A';
        return `${i + 1}. ${tpText} (Skor: ${skor})`;
      })
      .join(', ');

    // Ambil hasil kognitif dari diagnostik (jenis=awal, mapel yang sama)
    const hasilKognitif = sumatifRows[0]?.hasil_kognitif || '';

    // ── LANGKAH 2: Profil non-kognitif ───────────────────────────────
    const { data: profilNK } = await supabase
      .from('profil_non_kognitif')
      .select('gaya_belajar, catatan_emosional')
      .eq('id_murid', id_murid)
      .eq('tahun_ajaran', tahun_ajaran)
      .single();

    const gayaBelajar = profilNK?.gaya_belajar || 'belum teridentifikasi';

    // ── LANGKAH 3: Maks. 7 catatan formatif terbaru ──────────────────
    const { data: formatifRows } = await supabase
      .from('asesmen')
      .select('catatan_guru, tanggal, tujuan_pembelajaran')
      .eq('id_murid', id_murid)
      .eq('jenis', 'formatif')
      .eq('semester', semester)
      .eq('mata_pelajaran', mata_pelajaran)
      .eq('tahun_ajaran', tahun_ajaran)
      .not('catatan_guru', 'is', null)
      .order('tanggal', { ascending: false })
      .limit(MAX_FORMATIF);

    const catatanList = (formatifRows || [])
      .map((r, i) => `[${i + 1}] ${r.catatan_guru}`)
      .filter(Boolean);

    const hasFormatif = catatanList.length > 0;

    // ── LANGKAH 4: Pilih Prompt ───────────────────────────────────────
    let systemPrompt;

    if (hasFormatif) {
      // Normal Prompt: ada catatan formatif + multi-TP
      systemPrompt = `Anda adalah asisten akademik Kurikulum Merdeka untuk Madrasah Ibtidaiyah (MI).

Data murid:
- Nama           : ${nama_murid || 'Murid'}
- Kelas          : ${rombel}
- Mata Pelajaran : ${mata_pelajaran} — Semester ${semester} (${tahun_ajaran})
- Profil Belajar : Gaya belajar ${gayaBelajar}

Capaian per Tujuan Pembelajaran semester ini:
${tpList}

Diagnostik Awal : ${hasilKognitif || 'Tidak tersedia'}
Observasi Kelas : ${catatanList.join(' | ')}

Tulis 1 paragraf (4-6 kalimat) narasi rapor yang:
1. Bahasa Indonesia formal dan positif/suportif
2. Menyebut secara eksplisit TP mana yang dikuasai dengan baik dan TP mana yang masih perlu pendampingan (berdasarkan skor di atas)
3. Menyebut 1 kekuatan konkret dari catatan observasi
4. Memberikan 1 saran perbaikan spesifik mengacu pada TP dengan skor terendah
5. Kontekstual untuk madrasah ibtidaiyah; hindari pujian generik tanpa dasar data`;

    } else {
      // Fallback Prompt: TIDAK ADA catatan formatif
      systemPrompt = `Anda adalah asisten akademik Kurikulum Merdeka untuk Madrasah Ibtidaiyah (MI).
PERINGATAN: Data observasi formatif untuk murid ini KOSONG.

Data murid:
- Nama           : ${nama_murid || 'Murid'}
- Kelas          : ${rombel}
- Mata Pelajaran : ${mata_pelajaran} — Semester ${semester} (${tahun_ajaran})

Capaian per Tujuan Pembelajaran semester ini:
${tpList}

Diagnostik Awal : ${hasilKognitif || 'Tidak tersedia'}

INSTRUKSI TEGAS: Karena tidak ada data observasi kualitatif, tulis narasi yang:
1. Fokus MURNI pada evaluasi skor per TP dan hasil kognitif di atas
2. JANGAN mengarang atau berasumsi tentang perilaku/partisipasi murid di kelas
3. Sertakan kalimat ajakan kepada guru untuk memperkaya catatan observasi di semester berikutnya
4. Tetap positif dan konstruktif
5. Bahasa Indonesia formal`;
    }

    // ── LANGKAH 5: Kirim ke Gemini API ───────────────────────────────
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY belum dikonfigurasi di .env.local' },
        { status: 503 }
      );
    }

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 512,
            topP: 0.9,
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errBody = await geminiRes.json();
      console.error('[Generate Rapor] Gemini error:', errBody);
      return NextResponse.json(
        { error: 'Gemini API error', details: errBody?.error?.message },
        { status: geminiRes.status }
      );
    }

    const geminiData = await geminiRes.json();
    const narasi = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!narasi) {
      return NextResponse.json(
        { error: 'Gemini tidak menghasilkan narasi. Coba lagi.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      narasi,
      used_fallback: !hasFormatif,
      tp_count: sumatifRows.length,
      formatif_count: catatanList.length,
    });

  } catch (err) {
    console.error('[Generate Rapor] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
