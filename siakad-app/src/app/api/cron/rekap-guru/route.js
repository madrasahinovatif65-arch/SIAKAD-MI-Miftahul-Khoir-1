import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getTodayDate } from "@/lib/dateUtils";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Dipanggil otomatis oleh Vercel Cron setiap pukul 07:00 WIB (00:00 UTC)
export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const today = getTodayDate();

    // 1. Ambil semua guru aktif
    const { data: semuaGuru } = await supabase
      .from("master_user")
      .select("id_user, nama, role")
      .in("role", ["Guru", "Wali Kelas", "Kepala Madrasah"])
      .eq("status_aktif", "Aktif");

    if (!semuaGuru || semuaGuru.length === 0) {
      return NextResponse.json({ message: "Tidak ada data guru aktif." });
    }

    // 2. Ambil data absensi guru hari ini
    const { data: absensiHariIni } = await supabase
      .from("absensi_guru")
      .select("id_guru, status")
      .eq("tanggal", today);

    const absensiMap = {};
    (absensiHariIni || []).forEach(a => { absensiMap[a.id_guru] = a.status; });

    // 3. Kelompokkan berdasarkan status
    const hadir = [], sakit = [], izin = [], alfa = [], belumAbsen = [];
    semuaGuru.forEach(g => {
      const status = absensiMap[g.id_user];
      if (!status) belumAbsen.push(g.nama);
      else if (status === "Hadir") hadir.push(g.nama);
      else if (status === "Sakit") sakit.push(g.nama);
      else if (status === "Izin") izin.push(g.nama);
      else alfa.push(g.nama);
    });

    // 4. Susun pesan rekap
    let pesanRekap = `Rekap per pukul 07.00 WIB — ${today}\n`;
    pesanRekap += `Hadir (${hadir.length}): ${hadir.length > 0 ? hadir.join(", ") : "-"}\n`;
    if (sakit.length > 0) pesanRekap += `Sakit (${sakit.length}): ${sakit.join(", ")}\n`;
    if (izin.length > 0) pesanRekap += `Izin (${izin.length}): ${izin.join(", ")}\n`;
    if (alfa.length > 0) pesanRekap += `Alfa (${alfa.length}): ${alfa.join(", ")}\n`;
    if (belumAbsen.length > 0) pesanRekap += `Belum Absen (${belumAbsen.length}): ${belumAbsen.join(", ")}`;

    // 5. Temukan akun Kepala Madrasah
    const kepMad = semuaGuru.filter(g => g.role === "Kepala Madrasah");
    if (kepMad.length === 0) {
      return NextResponse.json({ message: "Tidak ada akun Kepala Madrasah ditemukan." });
    }

    // 6. Insert notifikasi ke setiap Kepala Madrasah
    const notifPayloads = kepMad.map(km => ({
      id_user: km.id_user,
      role_target: null,
      title: `Rekap Kehadiran Guru — ${today}`,
      message: pesanRekap,
      type: "REKAP",
      link: "/dashboard/verifikasi",
      is_read: false,
    }));

    const { error } = await supabase.from("notifikasi").insert(notifPayloads);
    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: `Rekap terkirim ke ${kepMad.length} Kepala Madrasah. Hadir: ${hadir.length}, Sakit: ${sakit.length}, Izin: ${izin.length}, Alfa: ${alfa.length}, Belum Absen: ${belumAbsen.length}.`,
    });

  } catch (err) {
    console.error("Cron Rekap Guru Error:", err);
    return NextResponse.json({ error: "Gagal menjalankan rekap.", details: err.message }, { status: 500 });
  }
}
