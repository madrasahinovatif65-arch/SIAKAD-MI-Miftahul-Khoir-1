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

export async function GET(request) {
  // Hanya bisa dipanggil via Cron Vercel (disarankan pakai auth/token di production)
  try {
    // 1. Dapatkan hari ini dalam bahasa Indonesia
    const dateOptions = { weekday: 'long', timeZone: 'Asia/Jakarta' };
    const hariIni = new Intl.DateTimeFormat('id-ID', dateOptions).format(new Date());
    
    const nowWIB = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
    const tanggalIni = nowWIB.toISOString().split('T')[0];

    if (hariIni === 'Minggu') {
      return NextResponse.json({ message: 'Hari Minggu, tidak ada pengingat.' });
    }

    console.log(`[Cron] Menjalankan Jurnal Reminder untuk hari: ${hariIni} (${tanggalIni})`);

    // 2. Ambil id_guru yang punya jadwal mengajar hari ini
    const { data: jadwal, error: errJadwal } = await supabase
      .from('jadwal_pelajaran')
      .select('id_guru')
      .eq('hari', hariIni);

    if (errJadwal) throw errJadwal;
    if (!jadwal || jadwal.length === 0) return NextResponse.json({ message: 'Tidak ada jadwal.' });

    const uniqueGuruJadwal = [...new Set(jadwal.map(j => j.id_guru).filter(Boolean))];

    // 3. Ambil data guru yang SUDAH mengisi jurnal hari ini
    const { data: jurnal, error: errJurnal } = await supabase
      .from('jurnal_guru')
      .select('id_guru')
      .eq('tanggal', tanggalIni);

    if (errJurnal) throw errJurnal;

    const uniqueGuruJurnal = new Set(jurnal.map(j => j.id_guru).filter(Boolean));

    // 4. Cari guru yang belum mengisi
    const guruBelumIsi = uniqueGuruJadwal.filter(id => !uniqueGuruJurnal.has(id));

    if (guruBelumIsi.length === 0) {
      return NextResponse.json({ message: 'Semua guru sudah mengisi jurnal hari ini. Hebat!' });
    }

    console.log(`[Cron] Mengirim notifikasi ke ${guruBelumIsi.length} guru.`);

    const title = 'Pengingat Jurnal ⏰';
    const message = `Bapak/Ibu, Anda belum mengisi Jurnal Mengajar untuk jadwal hari ini. Mohon segera dilengkapi.`;
    const targetUrl = '/dashboard/jurnal';

    // 5. Bulk Insert ke tabel notifikasi (Private Message)
    const notifPayloads = guruBelumIsi.map(id => ({
      id_user: id,
      role_target: null, // Khusus untuk individu
      title: title,
      message: message,
      type: 'PERINGATAN',
      link: targetUrl,
      is_read: false
    }));

    await supabase.from('notifikasi').insert(notifPayloads);

    // 6. Ambil subscriptions dan kirim push
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth, id_user')
      .in('id_user', guruBelumIsi);

    if (subs && subs.length > 0) {
      const pushPayload = JSON.stringify({
        title,
        body: message,
        icon: '/logo.png',
        badge: '/logo.png',
        data: { url: targetUrl }
      });

      const pushPromises = subs.map(async (sub) => {
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, pushPayload);
        } catch (err) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
          }
        }
      });
      await Promise.allSettled(pushPromises);
    }

    return NextResponse.json({ success: true, alerted: guruBelumIsi.length });

  } catch (err) {
    console.error('[Cron] Error:', err);
    return NextResponse.json({ error: 'Internal server error', details: err.message }, { status: 500 });
  }
}
