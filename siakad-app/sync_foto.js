const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://uodzgtprafjxyvvqfqam.supabase.co', 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvZHpndHByYWZqeHl2dnFmcWFtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTgzMjI1MiwiZXhwIjoyMTAxNDA4MjUyfQ.qL9fkuBcBYGJrVqgt_oTTVRSWcG03TpmZv2-E8LbqDk'
);

async function main() {
  console.log('Memulai sinkronisasi kolom foto dengan foto_app...');
  
  // Ambil semua user yang memiliki foto_app
  const { data: users, error } = await supabase
    .from('master_user')
    .select('id, foto_app')
    .neq('foto_app', '')
    .not('foto_app', 'is', null);

  if (error) {
    console.error('Gagal mengambil data:', error);
    return;
  }

  console.log(`Ditemukan ${users.length} data yang akan diupdate.`);

  let sukses = 0;
  let gagal = 0;

  for (const user of users) {
    const { error: updateError } = await supabase
      .from('master_user')
      .update({ foto: user.foto_app })
      .eq('id', user.id);

    if (updateError) {
      gagal++;
      console.error(`Gagal update ID ${user.id}:`, updateError.message);
    } else {
      sukses++;
    }
  }

  console.log('\n--- Selesai ---');
  console.log(`Total Berhasil Diperbarui : ${sukses}`);
  console.log(`Total Gagal               : ${gagal}`);
}

main();
