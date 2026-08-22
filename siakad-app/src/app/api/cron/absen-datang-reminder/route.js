import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET() {
  try {
    const nowWIB = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    const hariIni = new Intl.DateTimeFormat('id-ID', { weekday: 'long', timeZone: 'Asia/Jakarta' }).format(new Date());
    const tanggalIni = nowWIB.toISOString().split('T')[0];

    // Tidak jalan hari Minggu
    if (hariIni === 'Minggu') {
      return NextResponse.json({ message: 'Hari Minggu, tidak ada pengingat.' });
    }

    // Tidak jalan kalau hari libur
    const { data: kalender } = await supabase
      .from('master_kalender')
      .select('tipe_hari, keterangan')
      .eq('tanggal', tanggalIni)
      .single();

    if (kalender && kalender.tipe_hari === 'Libur') {
      return NextResponse.json({ message: `Hari Libur: ${kalender.keterangan}. Tidak ada pengingat.` });
    }

    console.log(`[Cron] Absen Datang Reminder - ${hariIni} (${tanggalIni})`);

    // 1. Ambil semua guru/staf aktif (selain Murid)
    const { data: allGuru, error: errGuru } = await supabase
      .from('master_user')
      .select('id_user')
      .eq('status_aktif', 'Aktif')
      .not('role', 'eq', 'Murid');

    if (errGuru) throw errGuru;
    if (!allGuru || allGuru.length === 0) {
      return NextResponse.json({ message: 'Tidak ada guru aktif.' });
    }

    const allGuruIds = allGuru.map(g => g.id_user);

    // 2. Cari guru yang SUDAH absen datang hari ini (GPS, NFC, atau Verifikasi)
    const [gpsRes, nfcRes, verRes] = await Promise.all([
      supabase.from('log_gps_guru').select('id_guru').eq('tanggal', tanggalIni).in('id_guru', allGuruIds),
      supabase.from('view_rekap_absensi_nfc').select('id_user').eq('tanggal', tanggalIni).in('id_user', allGuruIds),
      supabase.from('verifikasi_guru').select('id_guru').eq('tanggal', tanggalIni).in('id_guru', allGuruIds),
    ]);

    const sudahAbsen = new Set([
      ...(gpsRes.data || []).map(r => r.id_guru),
      ...(nfcRes.data || []).map(r => r.id_user),
      ...(verRes.data || []).map(r => r.id_guru),
    ]);

    // 3. Guru yang BELUM absen datang
    const targetIds = allGuruIds.filter(id => !sudahAbsen.has(id));

    if (targetIds.length === 0) {
      return NextResponse.json({ message: 'Semua guru sudah absen datang. Hebat!' });
    }

    // 4. Kirim Push Notification (tanpa tulis ke tabel notifikasi, hanya popup)
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth, id_user')
      .in('id_user', targetIds);

    const pushPayload = JSON.stringify({
      title: 'Pengingat Absen Datang 🏫',
      body: 'Bapak/Ibu belum tercatat absen datang hari ini. Segera lakukan absensi via NFC atau GPS.',
      icon: '/logo.png',
      badge: '/logo.png',
      data: { url: '/dashboard/absen-gps' }
    });

    if (subs && subs.length > 0) {
      const pushPromises = subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            pushPayload
          );
        } catch (err) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
          }
        }
      });
      await Promise.allSettled(pushPromises);
    }

    return NextResponse.json({
      success: true,
      belum_absen: targetIds.length,
      push_sent: subs?.length || 0
    });

  } catch (err) {
    console.error('[Cron] Absen Datang Reminder Error:', err);
    return NextResponse.json({ error: 'Internal server error', details: err.message }, { status: 500 });
  }
}
