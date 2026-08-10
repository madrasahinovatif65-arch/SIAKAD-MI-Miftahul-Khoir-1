require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const csv = require('csv-parser');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function migrate() {
  console.log('Fetching users...');
  const { data: users, error: userError } = await supabase.from('master_user').select('id_user, nama');
  if (userError) {
    console.error('Error fetching users:', userError);
    return;
  }
  const userMap = {};
  for (const u of users) {
    userMap[u.id_user] = u.nama;
  }
  console.log(`Loaded ${users.length} users.`);

  const records = [];

  console.log('Reading CSV...');
  fs.createReadStream('gps_lama.csv')
    .pipe(csv())
    .on('data', (row) => {
      // row: { Timestamp, ID_Guru, Latitude, Longitude, Jarak_Meter, Status }
      // Timestamp format: DD/MM/YYYY H:mm:ss
      if (!row.Timestamp || !row.ID_Guru) return;
      
      const [datePart, timePart] = row.Timestamp.trim().split(' ');
      if (!datePart || !timePart) return;
      
      const [dd, mm, yyyy] = datePart.split('/');
      const tanggal = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
      
      const timeParts = timePart.split(':');
      const hh = timeParts[0].padStart(2, '0');
      const min = timeParts[1].padStart(2, '0');
      const ss = (timeParts[2] || '00').padStart(2, '0');
      const waktu = `${hh}:${min}:${ss}`;

      const lat = parseFloat(row.Latitude.replace(',', '.'));
      const lng = parseFloat(row.Longitude.replace(',', '.'));
      const jarak = parseInt(row.Jarak_Meter, 10);
      
      records.push({
        tanggal,
        waktu,
        id_guru: row.ID_Guru.trim(),
        latitude: lat,
        longitude: lng,
        jarak_meter: jarak,
        status: row.Status ? row.Status.trim() : 'Hadir',
        rawTime: new Date(`${tanggal}T${waktu}`)
      });
    })
    .on('end', async () => {
      console.log(`Parsed ${records.length} records.`);
      
      // Group by tanggal and id_guru
      const grouped = {};
      for (const r of records) {
        const key = `${r.tanggal}_${r.id_guru}`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(r);
      }

      const upserts = [];
      for (const key in grouped) {
        const group = grouped[key];
        // Sort by time
        group.sort((a, b) => a.rawTime - b.rawTime);
        
        const masuk = group[0];
        const nama = userMap[masuk.id_guru] || 'Unknown';
        
        const payload = {
          tanggal: masuk.tanggal,
          id_guru: masuk.id_guru,
          waktu: masuk.waktu,
          latitude: masuk.latitude,
          longitude: masuk.longitude,
          jarak_meter: masuk.jarak_meter,
          status: 'Hadir' // Supaya otomatis diterima/masuk rekap
        };
        
        if (group.length > 1) {
          const pulang = group[group.length - 1];
          payload.waktu_pulang = pulang.waktu;
          payload.lat_pulang = pulang.latitude;
          payload.long_pulang = pulang.longitude;
          payload.jarak_pulang = pulang.jarak_meter;
        } else {
           // Jika hanya 1 record, cek apakah jam > 10:00 (siang)
           const jam = parseInt(masuk.waktu.split(':')[0], 10);
           if (jam >= 10) {
             // Berarti ini pulang
             payload.waktu_pulang = masuk.waktu;
             payload.lat_pulang = masuk.latitude;
             payload.long_pulang = masuk.longitude;
             payload.jarak_pulang = masuk.jarak_meter;
             
             // Karena kolom waktu NOT NULL, isi dengan '-'
             payload.waktu = '-';
             payload.latitude = null;
             payload.longitude = null;
             payload.jarak_meter = null;
           }
        }
        
        upserts.push(payload);
      }
      
      console.log(`Prepared ${upserts.length} rows for upsert.`);
      
      // Process in batches
      const batchSize = 100;
      let successCount = 0;
      let errorCount = 0;
      
      for (let i = 0; i < upserts.length; i += batchSize) {
        const batch = upserts.slice(i, i + batchSize);
        const { error } = await supabase.from('log_gps_guru').upsert(batch, { onConflict: 'tanggal,id_guru' });
        if (error) {
          console.error(`Error upserting batch ${i}:`, error.message);
          errorCount++;
        } else {
          successCount += batch.length;
        }
      }
      
      console.log('Migration finished!');
      console.log(`Success: ${successCount}`);
      console.log(`Errors: ${errorCount}`);
    });
}

migrate();
