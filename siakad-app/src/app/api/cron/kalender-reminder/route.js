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
  try {
    // 1. Dapatkan tanggal besok (YYYY-MM-DD)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Karena Vercel Cron menggunakan UTC, kita perlu menyesuaikan ke zona waktu lokal (WIB UTC+7) 
    // agar pengecekan "besok" akurat.
    const wibOffset = 7 * 60 * 60 * 1000;
    const tomorrowWIB = new Date(tomorrow.getTime() + wibOffset);
    const targetDate = tomorrowWIB.toISOString().substring(0, 10);
    
    console.log(`[Cron] Mengecek jadwal Kalender Akademik untuk besok: ${targetDate}`);

    // 2. Ambil jadwal dari master_kalender
    const { data: jadwal, error: errJadwal } = await supabase
      .from('master_kalender')
      .select('*')
      .eq('tanggal', targetDate)
      .in('tipe_hari', ['Libur', 'Non-Efektif KBM']);

    if (errJadwal) throw errJadwal;
    if (!jadwal || jadwal.length === 0) {
      return NextResponse.json({ message: 'Tidak ada jadwal Non-Efektif KBM / Libur untuk besok.' });
    }

    // Menggabungkan semua keterangan jika ada lebih dari 1 event di hari yang sama
    const keteranganList = jadwal.map(j => j.keterangan).join(' & ');
    const isLibur = jadwal.some(j => j.tipe_hari === 'Libur');
    const title = isLibur ? 'Pengingat Hari Libur 🏖️' : 'Pengingat Kalender Akademik 📅';
    const message = `Besok (${targetDate}): ${keteranganList}`;

    // 3. Ambil semua user yang masih aktif
    const { data: users, error: errUser } = await supabase
      .from('master_user')
      .select('id_user')
      .eq('status_aktif', 'Aktif');

    if (errUser) throw errUser;
    if (!users || users.length === 0) {
      return NextResponse.json({ message: 'Tidak ada user aktif.' });
    }

    const targetIdUsers = users.map(u => u.id_user);

    // 4. Siapkan Payload Notifikasi
    const notifPayloads = users.map(user => ({
      id_user: user.id_user,
      role_target: null, // Broadcast ke semua orang, null karena disebar satu per satu
      title: title,
      message: message,
      type: 'info',
      link: null, // Tidak perlu "Lihat Detail"
      is_read: false
    }));

    // Memecah insert menjadi chunk (misal 50 per batch)
    const chunkSize = 50;
    for (let i = 0; i < notifPayloads.length; i += chunkSize) {
      const chunk = notifPayloads.slice(i, i + chunkSize);
      const { error: insertErr } = await supabase.from('notifikasi').insert(chunk);
      if (insertErr) console.error('[Cron] Gagal insert chunk:', insertErr);
    }

    // 5. Kirim Push Notification paralel
    const { data: subs, error: subsErr } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth, id_user');

    if (subsErr) throw subsErr;

    // Filter subscription yang id_user nya ada di target
    const activeSubs = subs?.filter(s => targetIdUsers.includes(s.id_user)) || [];

    if (activeSubs.length > 0) {
      const pushPayload = JSON.stringify({
        title: title,
        body: message,
        icon: '/logo.png',
        badge: '/logo.png',
        data: { url: '/dashboard/notifikasi' }
      });

      const pushPromises = activeSubs.map(async (sub) => {
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

    return NextResponse.json({ 
      success: true, 
      message: 'Notifikasi Kalender Akademik berhasil disebar.',
      target_users: users.length,
      push_sent: activeSubs.length
    });

  } catch (err) {
    console.error('[Cron] Error Kalender Reminder:', err);
    return NextResponse.json({ error: 'Internal server error', details: err.message }, { status: 500 });
  }
}
