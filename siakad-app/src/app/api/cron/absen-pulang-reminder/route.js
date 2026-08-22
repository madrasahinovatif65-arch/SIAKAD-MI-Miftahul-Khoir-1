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

    console.log(`[Cron] Absen Pulang Reminder - ${hariIni} (${tanggalIni})`);

    // 1. Ambil SEMUA guru/staf aktif (selain Murid) — tanpa filter apakah sudah datang atau belum
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

    // 2. Kirim Push Notification ke SEMUA guru (sudah atau belum datang sekalipun)
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth, id_user')
      .in('id_user', allGuruIds);

    const isJumat = hariIni === 'Jumat';
    const pushPayload = JSON.stringify({
      title: isJumat ? 'Pengingat Absen Pulang (Jumat) 🕌' : 'Pengingat Absen Pulang 🏃',
      body: isJumat
        ? 'Bapak/Ibu, waktu pulang hari Jumat telah tiba. Jangan lupa absensi pulang via NFC atau GPS.'
        : 'Bapak/Ibu, waktu pulang telah tiba. Jangan lupa absensi pulang via NFC atau GPS.',
      icon: '/logo.png',
      badge: '/logo.png',
      data: { url: '/dashboard/absen-gps' }
    });

    let sent = 0;
    if (subs && subs.length > 0) {
      const pushPromises = subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            pushPayload
          );
          sent++;
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
      total_guru: allGuruIds.length,
      push_sent: sent
    });

  } catch (err) {
    console.error('[Cron] Absen Pulang Reminder Error:', err);
    return NextResponse.json({ error: 'Internal server error', details: err.message }, { status: 500 });
  }
}
