const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  'https://uodzgtprafjxyvvqfqam.supabase.co', 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvZHpndHByYWZqeHl2dnFmcWFtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTgzMjI1MiwiZXhwIjoyMTAxNDA4MjUyfQ.qL9fkuBcBYGJrVqgt_oTTVRSWcG03TpmZv2-E8LbqDk'
);

async function downloadImage(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Gagal fetch ${url}: ${response.statusText}`);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const contentType = response.headers.get('content-type') || 'image/jpeg';
  return { buffer, contentType };
}

async function main() {
  console.log('Mulai migrasi foto...');
  
  // 1. Ambil data user yang punya foto eksternal
  const { data: users, error } = await supabase
    .from('master_user')
    .select('id, id_user, nama, foto')
    .neq('foto', '')
    .not('foto', 'is', null);

  if (error) {
    console.error('Gagal mengambil data user:', error);
    return;
  }

  console.log(`Ditemukan ${users.length} pengguna dengan foto yang perlu dimigrasi.`);

  let sukses = 0;
  let gagal = 0;

  for (const user of users) {
    // Skip jika URL foto bukan HTTP/HTTPS (misal: udah lokal atau base64)
    if (!user.foto.startsWith('http')) {
      console.log(`[SKIPPED] ${user.nama} (${user.id_user}): Bukan link HTTP valid.`);
      continue;
    }

    try {
      console.log(`Memproses [${user.id_user}] ${user.nama}...`);
      
      // 2. Download foto lama
      const { buffer, contentType } = await downloadImage(user.foto);
      
      // Tentukan ekstensi
      let ext = 'jpg';
      if (contentType.includes('png')) ext = 'png';
      else if (contentType.includes('webp')) ext = 'webp';

      const fileName = `${user.id_user}_${Date.now()}.${ext}`;

      // 3. Upload ke bucket profil_app
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('profil_app')
        .upload(fileName, buffer, {
          contentType: contentType,
          upsert: true
        });

      if (uploadError) throw uploadError;

      // 4. Dapatkan public URL
      const { data: publicUrlData } = supabase.storage
        .from('profil_app')
        .getPublicUrl(fileName);

      const newUrl = publicUrlData.publicUrl;

      // 5. Update kolom foto_app di master_user
      const { error: updateError } = await supabase
        .from('master_user')
        .update({ foto_app: newUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      console.log(`  [OK] Berhasil migrasi foto: ${newUrl}`);
      sukses++;

    } catch (err) {
      console.error(`  [GAGAL] Gagal migrasi untuk ${user.id_user}:`, err.message);
      gagal++;
    }
  }

  console.log('\n--- Selesai ---');
  console.log(`Total Sukses : ${sukses}`);
  console.log(`Total Gagal  : ${gagal}`);
}

main();
