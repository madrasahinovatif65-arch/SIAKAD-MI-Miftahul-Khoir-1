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
    const now = new Date();
    const currentMonth = now.toISOString().substring(0, 7); // YYYY-MM
    
    console.log(`[Cron] Menjalankan Alfa Reminder untuk bulan: ${currentMonth}`);

    // 1. Ambil data Alfa bulan ini
    const { data: absensi, error: errAbsen } = await supabase
      .from('data_absensi')
      .select('nisn')
      .eq('status', 'Alfa')
      .like('tanggal', `${currentMonth}%`);

    if (errAbsen) throw errAbsen;
    if (!absensi || absensi.length === 0) {
      return NextResponse.json({ message: 'Tidak ada murid Alfa bulan ini.' });
    }

    // Hitung jumlah Alfa per NISN
    const alfaCount = {};
    absensi.forEach(a => {
      alfaCount[a.nisn] = (alfaCount[a.nisn] || 0) + 1;
    });

    // Ambil murid yang Alfa > 3
    const targetNisn = Object.keys(alfaCount).filter(nisn => alfaCount[nisn] >= 3);

    if (targetNisn.length === 0) {
      return NextResponse.json({ message: 'Tidak ada murid yang melebihi batas Alfa.' });
    }

    // 2. Ambil id_user berdasarkan NISN dari master_murid
    const { data: murids, error: errMurid } = await supabase
      .from('master_murid')
      .select('nisn, id_user, nama')
      .in('nisn', targetNisn);

    if (errMurid) throw errMurid;

    const notifPayloads = [];
    const targetIdUsers = [];

    murids.forEach(m => {
      if (!m.id_user) return;
      targetIdUsers.push(m.id_user);
      notifPayloads.push({
        id_user: m.id_user,
        role_target: null,
        title: 'Peringatan Absensi ⚠️',
        message: `Ananda ${m.nama} telah tercatat Alfa sebanyak ${alfaCount[m.nisn]} kali di bulan ini. Mohon perhatikan tingkat kehadiran.`,
        type: 'peringatan',
        link: '/dashboard/riwayat-murid',
        is_read: false
      });
    });

    if (notifPayloads.length === 0) {
      return NextResponse.json({ message: 'Tidak ditemukan id_user untuk dikirimkan notifikasi.' });
    }

    // 3. Bulk Insert ke tabel notifikasi
    await supabase.from('notifikasi').insert(notifPayloads);

    // 4. Kirim Push Notification
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth, id_user')
      .in('id_user', targetIdUsers);

    if (subs && subs.length > 0) {
      const pushPromises = subs.map(async (sub) => {
        // Cari pesan spesifik untuk user ini
        const pld = notifPayloads.find(n => n.id_user === sub.id_user);
        if (!pld) return;

        const pushPayload = JSON.stringify({
          title: pld.title,
          body: pld.message,
          icon: '/logo.png',
          badge: '/logo.png',
          data: { url: pld.link }
        });

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

    return NextResponse.json({ success: true, alerted: targetIdUsers.length });

  } catch (err) {
    console.error('[Cron] Error:', err);
    return NextResponse.json({ error: 'Internal server error', details: err.message }, { status: 500 });
  }
}
