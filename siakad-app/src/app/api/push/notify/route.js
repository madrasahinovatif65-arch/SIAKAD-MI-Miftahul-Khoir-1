import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

// ── Konfigurasi VAPID ────────────────────────────────────────────────────────
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// ── Supabase dengan service-role (bisa baca semua tabel) ────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const body = await request.json();
    const { type, table, record } = body;

    console.log('[Push/Notify] Webhook received:', table, type, record?.id);

    if (type !== 'INSERT' && type !== 'UPDATE') {
      return Response.json({ skipped: true }, { status: 200 });
    }

    let targetIdUsers = [];  // daftar id_user yang akan dikirim notifikasi
    let title = '';
    let notifBody = '';

    // ── Format waktu WIB ──────────────────────────────────────────────────────
    const formatWaktu = (isoOrStr) => {
      if (!isoOrStr) return '';
      try {
        const d = new Date(isoOrStr);
        if (!isNaN(d)) {
          const wib = new Date(d.getTime() + 7 * 60 * 60 * 1000);
          return `${String(wib.getUTCHours()).padStart(2, '0')}:${String(wib.getUTCMinutes()).padStart(2, '0')}`;
        }
      } catch (_) {}
      return isoOrStr.replace('.', ':').substring(0, 5);
    };

    // ── Kasus 1: Tap NFC → notif ke pemilik RFID ─────────────────────────────
    if (table === 'log_absensi') {
      const rfid = record?.rfid_uid;
      if (!rfid) return Response.json({ skipped: 'no rfid' }, { status: 200 });

      // Cari id_user berdasarkan rfid
      const { data: userRow } = await supabase
        .from('master_user')
        .select('id_user')
        .eq('rfid', rfid)
        .single();

      if (userRow) targetIdUsers = [userRow.id_user];

      const waktu = formatWaktu(record?.waktu);
      const jenis = record?.jenis_absen || 'Absen';
      title = 'Tap NFC Berhasil 💳';
      notifBody = waktu
        ? `${jenis} tercatat pukul ${waktu} WIB`
        : `${jenis} Anda telah berhasil terdeteksi`;
    }

    // ── Kasus 2: Absen GPS Guru ───────────────────────────────────────────────
    else if (table === 'log_gps_guru') {
      const idGuru = record?.id_guru;
      if (!idGuru) return Response.json({ skipped: 'no id_guru' }, { status: 200 });
      targetIdUsers = [idGuru];

      const waktu = formatWaktu(record?.waktu) || formatWaktu(record?.created_at);
      const status = record?.status || '';
      title = 'Absen GPS Berhasil 📍';
      notifBody = waktu
        ? `Lokasi tersimpan pukul ${waktu} WIB — ${status}`
        : `Lokasi Anda berhasil tersimpan — ${status}`;
    }

    // ── Kasus 3: Verifikasi Kehadiran Guru ───────────────────────────────────
    else if (table === 'verifikasi_guru') {
      const idGuru = record?.id_guru;
      if (!idGuru) return Response.json({ skipped: 'no id_guru' }, { status: 200 });
      targetIdUsers = [idGuru];

      const waktu = formatWaktu(record?.created_at);
      const status = record?.status || '';
      const metode = record?.metode || 'Sistem';
      title = 'Verifikasi Kehadiran 📋';
      notifBody = waktu
        ? `Kehadiran (${metode}) diverifikasi pukul ${waktu}: ${status}`
        : `Kehadiran Anda (${metode}) diverifikasi: ${status}`;
    }

    // ── Kasus 4: Absensi Murid → notif ke murid itu sendiri ──────────────────
    else if (table === 'data_absensi') {
      const nisn = record?.nisn;
      if (!nisn) return Response.json({ skipped: 'no nisn' }, { status: 200 });
      targetIdUsers = [nisn];

      const waktu = formatWaktu(record?.created_at);
      const status = record?.status || '';
      title = 'Absensi Tercatat ✅';
      notifBody = waktu
        ? `Kehadiran dicatat pukul ${waktu}: ${status}`
        : `Kehadiran Anda dicatat: ${status}`;
    }

    else {
      return Response.json({ skipped: 'unknown table' }, { status: 200 });
    }

    if (!targetIdUsers.length) {
      return Response.json({ skipped: 'no target users' }, { status: 200 });
    }

    // ── Ambil push_subscriptions untuk user-user tersebut ────────────────────
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('id_user', targetIdUsers);

    if (subError) {
      console.error('[Push/Notify] Error fetching subscriptions:', subError);
      return Response.json({ error: subError.message }, { status: 500 });
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('[Push/Notify] No subscriptions found for users:', targetIdUsers);
      return Response.json({ sent: 0 }, { status: 200 });
    }

    // ── Kirim push ke semua subscription yang ditemukan ───────────────────────
    const payload = JSON.stringify({
      title,
      body: notifBody,
      icon: '/logo.png',
      badge: '/logo.png',
      data: { url: '/dashboard/riwayat' }
    });

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const pushSub = {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth }
        };
        return webpush.sendNotification(pushSub, payload);
      })
    );

    const sent = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    // Hapus subscription yang sudah tidak valid (410 Gone)
    const expiredEndpoints = results
      .filter(r => r.status === 'rejected' && r.reason?.statusCode === 410)
      .map((_, i) => subscriptions[i]?.endpoint)
      .filter(Boolean);

    if (expiredEndpoints.length > 0) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .in('endpoint', expiredEndpoints);
      console.log('[Push/Notify] Cleaned up expired subscriptions:', expiredEndpoints.length);
    }

    console.log(`[Push/Notify] Done. Sent: ${sent}, Failed: ${failed}`);
    return Response.json({ sent, failed }, { status: 200 });

  } catch (err) {
    console.error('[Push/Notify] Fatal error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
