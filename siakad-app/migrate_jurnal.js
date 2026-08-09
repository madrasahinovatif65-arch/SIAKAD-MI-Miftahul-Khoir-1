const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const csv = require('csv-parser');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

function parseDate(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr;
}

async function migrateData() {
  const results = [];
  
  fs.createReadStream('jurnal_lama.csv')
    .pipe(csv({ separator: ';' }))
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      console.log(`Berhasil membaca ${results.length} baris dari CSV. Mulai migrasi...`);
      
      let successCount = 0;
      let errorCount = 0;

      for (const row of results) {
        const keys = Object.keys(row);
        const tanggalLama = row[keys[0]]; 
        const jam = row[keys[1]]; 
        const idGuru = row[keys[2]]; 
        const rombel = row[keys[3]]; 
        const mapel = row[keys[4]]; 
        const materi = row[keys[5]]; 
        const catatan = row[keys[6]]; 

        const tanggal = parseDate(tanggalLama);

        const payload = {
          tanggal,
          jam_pelajaran: jam,
          id_guru: idGuru,
          rombel,
          mata_pelajaran: mapel,
          materi: materi || '-',
          catatan: catatan || '-'
        };

        const { error } = await supabase.from('jurnal_guru').insert(payload);
        
        if (error) {
          console.error(`Gagal migrasi baris (ID Guru: ${idGuru}, Tanggal: ${tanggal}):`, error.message);
          errorCount++;
        } else {
          successCount++;
        }
      }

      console.log('--------------------------------------------------');
      console.log('MIGRASI SELESAI!');
      console.log(`Berhasil: ${successCount}`);
      console.log(`Gagal: ${errorCount}`);
      console.log('Catatan: Data Kehadiran_Siswa tidak dimigrasi karena struktur baru mencatat per-siswa.');
    });
}

migrateData();
