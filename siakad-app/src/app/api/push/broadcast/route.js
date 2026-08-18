import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

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
    const { title, message, targets } = await request.json(); // targets is an array of roles, e.g. ['Wali Kelas', 'Murid']
    
    if (!title || !message || !targets || !targets.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    console.log('[Push/Broadcast] Memulai broadcast...', targets);

    // 1. Kumpulkan semua id_user berdasarkan targets
    let query = supabase.from('master_user').select('id_user, role');
    
    if (!targets.includes('Semua Pengguna')) {
      let roles = [];
      if (targets.includes('Semua Guru')) {
        roles.push('Guru Mapel', 'Wali Kelas', 'Kepala Madrasah', 'Admin');
      }
      if (targets.includes('Semua Murid')) {
        roles.push('Murid');
      }
      if (targets.includes('Wali Kelas')) roles.push('Wali Kelas');
      if (targets.includes('Guru Mapel')) roles.push('Guru Mapel');
      
      // Hapus duplikat
      roles = [...new Set(roles)];
      
      if (roles.length > 0) {
        query = query.in('role', roles);
      }
    }

    const { data: users, error: userErr } = await query;
    if (userErr) throw userErr;

    if (!users || users.length === 0) {
      return NextResponse.json({ success: true, message: 'Tidak ada pengguna yang cocok dengan target', sent: 0 });
    }

    const targetIdUsers = users.map(u => u.id_user);
    const targetUrl = null; // Pengumuman biasa tidak butuh halaman detail

    // 2. Simpan Histori ke Tabel `notifikasi` (Bulk Insert)
    try {
      const notifPayloads = users.map(user => ({
        id_user: user.id_user,
        role_target: user.role,
        title: title,
        message: message,
        type: 'info',
        link: targetUrl,
        is_read: false
      }));

      // Memecah insert menjadi chunk (misal 50 per batch) agar tidak terlalu berat jika user banyak
      const chunkSize = 50;
      for (let i = 0; i < notifPayloads.length; i += chunkSize) {
        const chunk = notifPayloads.slice(i, i + chunkSize);
        await supabase.from('notifikasi').insert(chunk);
      }
      console.log('[Push/Broadcast] Berhasil bulk insert ke tabel notifikasi');
    } catch (dbErr) {
      console.error('[Push/Broadcast] Gagal menyimpan histori notifikasi:', dbErr);
    }

    // 3. Ambil daftar endpoint browser (Push Subscriptions) dari target pengguna
    const { data: subs, error: subErr } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth, id_user')
      .in('id_user', targetIdUsers);

    if (subErr) {
      console.error('[Push/Broadcast] Error fetch subs:', subErr);
      return NextResponse.json({ error: 'Gagal mengambil subscription' }, { status: 500 });
    }

    if (!subs || subs.length === 0) {
      console.log('[Push/Broadcast] Tidak ada perangkat yang berlangganan push.');
      return NextResponse.json({ success: true, message: 'Pengumuman disimpan, tapi tidak ada perangkat untuk dikirim push.', sent: 0 });
    }

    // 4. Kirim push ke semua subscription secara paralel
    const pushPayload = JSON.stringify({
      title,
      body: message,
      icon: '/logo.png',
      badge: '/logo.png',
      data: { url: targetUrl }
    });

    const pushPromises = subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          pushPayload
        );
      } catch (err) {
        // Jika endpoint expired/unsubscribed (410 Gone), hapus dari DB
        if (err.statusCode === 410 || err.statusCode === 404) {
          console.log(`[Push/Broadcast] Endpoint expired, menghapus sub untuk id_user: ${sub.id_user}`);
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        } else {
          console.error(`[Push/Broadcast] Gagal kirim ke ${sub.id_user}:`, err.message);
        }
      }
    });

    await Promise.allSettled(pushPromises);
    console.log(`[Push/Broadcast] Selesai. Mencoba kirim ke ${subs.length} endpoint.`);

    return NextResponse.json({ success: true, sent: subs.length });

  } catch (err) {
    console.error('[Push/Broadcast] Error:', err);
    return NextResponse.json({ error: 'Internal server error', details: err.message }, { status: 500 });
  }
}
