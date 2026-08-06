// migrate-auth.js
// Skrip untuk migrasi dari master_user ke Supabase Auth
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY tidak ditemukan di .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration() {
  console.log('--- Memulai Migrasi ke Supabase Auth ---');

  // 1. Ambil semua user dari master_user
  const { data: users, error: fetchError } = await supabase
    .from('master_user')
    .select('*');

  if (fetchError) {
    console.error('Gagal mengambil data dari master_user:', fetchError.message);
    return;
  }

  console.log(`Ditemukan ${users.length} user di master_user.`);

  let successCount = 0;
  let errorCount = 0;

  for (const user of users) {
    const email = `${user.id_user.toLowerCase()}@siakad.local`;
    const password = user.pin.trim();

    try {
      // 2. Buat user di Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
        user_metadata: {
          id_user: user.id_user,
          role: user.role
        }
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          console.log(`[SKIP] User ${user.id_user} (${email}) sudah terdaftar di Auth.`);
        } else {
          console.error(`[ERROR] Gagal membuat user ${user.id_user}:`, authError.message);
          errorCount++;
        }
        continue;
      }

      const authId = authData.user.id;

      // 3. Update master_user dengan auth_id yang baru dibuat
      const { error: updateError } = await supabase
        .from('master_user')
        .update({ user_id: authId })
        .eq('id_user', user.id_user);

      if (updateError) {
        console.error(`[ERROR] Gagal update user_id di master_user untuk ${user.id_user}:`, updateError.message);
        errorCount++;
      } else {
        console.log(`[OK] Berhasil migrasi user: ${user.id_user}`);
        successCount++;
      }

    } catch (err) {
      console.error(`[FATAL ERROR] pada user ${user.id_user}:`, err.message);
      errorCount++;
    }
  }

  console.log('--- Migrasi Selesai ---');
  console.log(`Berhasil: ${successCount}`);
  console.log(`Gagal: ${errorCount}`);
}

runMigration();
