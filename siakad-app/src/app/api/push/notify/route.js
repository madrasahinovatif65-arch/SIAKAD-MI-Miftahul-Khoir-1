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

    // ── Kumpulkan target_user dan format pesan berdasarkan tabel ─────────────────
    let rfidUser = null;
    let waktuStr = '';
    let jenisAbsen = 'hadir';

    if (table === 'log_absensi') {
      const rfid = record?.rfid_uid;
      if (!rfid) return Response.json({ skipped: 'no rfid' }, { status: 200 });

      const { data: userRow } = await supabase
        .from('master_user')
        .select('id_user, nama, role')
        .eq('rfid', rfid)
        .single();

      if (!userRow) return Response.json({ skipped: 'user not found' }, { status: 200 });
      
      targetIdUsers = [userRow.id_user];
      rfidUser = userRow;
      waktuStr = formatWaktu(record?.waktu);
      jenisAbsen = record?.jenis_absen?.toLowerCase() || 'datang';
      title = 'Tap NFC Berhasil 💳';
    } 
    else if (table === 'log_gps_guru') {
      const idGuru = record?.id_guru;
      if (!idGuru) return Response.json({ skipped: 'no id_guru' }, { status: 200 });
      targetIdUsers = [idGuru];
      waktuStr = formatWaktu(record?.waktu) || formatWaktu(record?.created_at);
      jenisAbsen = record?.status?.toLowerCase() || 'datang';
      title = 'Absen GPS Berhasil 📍';
    }
    else if (table === 'verifikasi_guru') {
      const idGuru = record?.id_guru;
      if (!idGuru) return Response.json({ skipped: 'no id_guru' }, { status: 200 });
      targetIdUsers = [idGuru];
      waktuStr = formatWaktu(record?.created_at);
      jenisAbsen = record?.status?.toLowerCase() || 'hadir';
      title = 'Verifikasi Kehadiran 📋';
    }
    else if (table === 'data_absensi') {
      const nisn = record?.nisn;
      if (!nisn) return Response.json({ skipped: 'no nisn' }, { status: 200 });
      targetIdUsers = [nisn];
      waktuStr = formatWaktu(record?.created_at);
      jenisAbsen = record?.status?.toLowerCase() || 'datang';
      title = 'Absensi Tercatat ✅';
    }
    else {
      return Response.json({ skipped: 'unknown table' }, { status: 200 });
    }

    if (!targetIdUsers.length) {
      return Response.json({ skipped: 'no target users' }, { status: 200 });
    }

    // Ambil data nama dan role user jika belum didapat (selain NFC)
    let userData = rfidUser;
    if (!userData) {
      const { data: userRow } = await supabase
        .from('master_user')
        .select('id_user, nama, role')
        .eq('id_user', targetIdUsers[0])
        .single();
      userData = userRow;
    }

    // ── Susun Notif Body Berdasarkan Peran (Murid/Guru) ───────────────────────
    let targetUrl = '/dashboard/riwayat';
    
    if (userData) {
      const timeText = waktuStr ? ` pukul ${waktuStr}` : '';
      if (userData.role === 'Murid') {
        notifBody = `Ananda ${userData.nama} telah ${jenisAbsen}${timeText}`;
        targetUrl = '/dashboard/riwayat-murid';
      } else {
        notifBody = `Anda telah tercatat ${jenisAbsen}${timeText}`;
        targetUrl = '/dashboard/riwayat-guru';
      }
    } else {
      // Fallback jika entah kenapa user tidak ditemukan
      const timeText = waktuStr ? ` pukul ${waktuStr}` : '';
      notifBody = `Kehadiran telah tercatat${timeText}`;
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
      data: { url: targetUrl }
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
