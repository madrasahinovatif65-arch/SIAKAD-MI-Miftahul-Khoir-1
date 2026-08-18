import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Simpan atau perbarui subscription push untuk user yang sedang login
export async function POST(request) {
  try {
    const { id_user, subscription } = await request.json();

    if (!id_user || !subscription?.endpoint) {
      return Response.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    const { endpoint, keys } = subscription;

    // Upsert berdasarkan endpoint (satu browser = satu endpoint unik)
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          id_user,
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'endpoint' }
      );

    if (error) {
      console.error('[Push/Subscribe] Error:', error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    console.log('[Push/Subscribe] Subscription saved for user:', id_user);
    return Response.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('[Push/Subscribe] Fatal:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// Hapus subscription (saat user logout atau menonaktifkan notifikasi)
export async function DELETE(request) {
  try {
    const { endpoint } = await request.json();
    if (!endpoint) return Response.json({ error: 'No endpoint' }, { status: 400 });

    await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
    return Response.json({ success: true }, { status: 200 });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
