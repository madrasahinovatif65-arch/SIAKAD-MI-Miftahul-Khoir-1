const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Pastikan NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY ada di .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const CSV_DIR = path.join(__dirname, '../csv_data');

// Helper fungsi parse tanggal dari sembarang format ke YYYY-MM-DD
function parseDate(val) {
  if (!val) return '1970-01-01';
  const strVal = String(val).trim();
  
  // Pisahkan jam jika ada (misal 27/07/2026 6:19:01)
  const dateOnly = strVal.split(' ')[0];
  
  const parts = dateOnly.split(/[\/\-]/);
  if (parts.length === 3) {
    if (parts[2].length === 4) {
      // asumsi DD/MM/YYYY
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
  }
  
  const d = new Date(val);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }
  return '1970-01-01';
}

function parseTime(val) {
  if (!val) return null;
  const parts = String(val).trim().split(' ');
  if (parts.length > 1) {
    return parts[1];
  }
  return val;
}

function safeDouble(val) {
  if (!val) return 0;
  // Ganti koma jadi titik, lalu parse
  const parsed = parseFloat(String(val).replace(',', '.'));
  return isNaN(parsed) ? 0 : parsed;
}

async function runMigration() {
  console.log("🚀 Memulai Migrasi dari CSV (Versi 3.0)...");

  if (!fs.existsSync(CSV_DIR)) {
    console.error(`❌ Folder ${CSV_DIR} tidak ditemukan.`);
    process.exit(1);
  }

  console.log("📥 Mengambil data Master User dari Supabase...");
  const { data: users, error: errUser } = await supabase.from('master_user').select('id_user, nama');
  if (errUser) {
    console.error("❌ Gagal mengambil master_user:", errUser.message);
    process.exit(1);
  }
  
  const userMapByName = {};
  const userMapById = {};
  users.forEach(u => {
    userMapByName[u.nama.trim().toLowerCase()] = u.id_user;
    userMapById[u.id_user] = u.nama;
  });

  const getGuruInfo = (idOrName) => {
    if (!idOrName) return { id: 'UNKNOWN', nama: 'UNKNOWN' };
    const clean = String(idOrName).trim();
    if (userMapById[clean]) return { id: clean, nama: userMapById[clean] };
    const lower = clean.toLowerCase();
    if (userMapByName[lower]) return { id: userMapByName[lower], nama: clean };
    return { id: 'UNKNOWN', nama: clean };
  };

  console.log("📥 Mengambil data Master Murid dari Supabase...");
  const { data: murids } = await supabase.from('master_murid').select('nisn');
  const validNisnSet = new Set(murids ? murids.map(m => m.nisn) : []);
  
  // Fungsi untuk mendaftarkan murid dummy jika NISN tidak ditemukan
  const ensureMuridExists = async (nisn, rombel) => {
    if (validNisnSet.has(nisn)) return;
    validNisnSet.add(nisn);
    console.log(`   [INFO] Menambahkan murid dummy untuk NISN tidak terdaftar: ${nisn}`);
    await supabase.from('master_murid').insert([{
      nisn: nisn,
      nama_murid: 'Unknown (Auto-migrated)',
      rombel: rombel || '-',
      status: 'Aktif'
    }]);
  };

  const targets = [
    {
      file: 'Data_Absensi.csv',
      table: 'data_absensi',
      onConflict: 'tanggal,nisn',
      process: (row) => {
        const tanggalStr = row['Tanggal'] || row['Timestamp'];
        const tanggal = parseDate(tanggalStr);
        const rombel = row['Rombel'];
        const jsonStr = row['Data_JSON'];
        
        if (!jsonStr || !tanggal || !rombel) return [];
        
        let students = [];
        try {
          const parsed = JSON.parse(jsonStr);
          if (Array.isArray(parsed)) students = parsed;
        } catch(e) { return []; }

        return students.map(student => ({
          tanggal: tanggal,
          rombel: String(rombel),
          nisn: student.nisn || student.id || 'UNKNOWN',
          status: student.status || 'Hadir',
          catatan: student.notes || student.catatan || '-',
          pencatat: '-',
          metode: 'Manual'
        }));
      }
    },
    {
      file: 'Data_NFC.csv',
      table: 'data_nfc_murid',
      onConflict: 'tanggal,nisn',
      process: (row) => {
        return [{
          tanggal: parseDate(row['Timestamp'] || row['Tanggal']),
          nisn: String(row['NISN']),
          nama_murid: String(row['Nama_Murid']),
          rombel: String(row['Rombel']),
          jam_datang: parseTime(row['Jam_Datang']) || '',
          jam_pulang: parseTime(row['Jam_Pulang']) || ''
        }];
      }
    },
    {
      file: 'Jurnal_Guru.csv',
      table: 'jurnal_guru',
      onConflict: null, // TIDAK ADA UNIQUE CONSTRAINT, PAKE INSERT AJA
      process: (row) => {
        // Kolom Nama_Guru ternyata isinya ID Guru! (misal: ID20549574196001)
        const rawNamaOrId = row['Nama_Guru'];
        const guru = getGuruInfo(rawNamaOrId);
        
        let siswaJSON = [];
        // Kehadiran_Siswa isinya string seperti "H: 0, S: 0, I: 0, A: 0"
        
        return [{
          tanggal: parseDate(row['Tanggal'] || row['Jam']), // Di csv jurnal, tgl ada di "Tanggal"
          jam_pelajaran: String(row['Jam Ke...'] || '-'),
          id_guru: guru.id,
          nama_guru: guru.nama,
          rombel: String(row['Rombel'] || '-'),
          mata_pelajaran: String(row['Mata_Pelajaran'] || '-'),
          materi_catatan: String(row['Materi'] || row['Catatan'] || ''),
          kehadiran_siswa: siswaJSON
        }];
      }
    },
    {
      file: 'Log_GPS.csv',
      table: 'log_gps_guru',
      onConflict: 'tanggal,id_guru',
      process: (row) => {
        const guru = getGuruInfo(row['ID_Guru'] || row['Nama_Guru']);
        // Format Timestamp: 27/07/2026 6:19:01
        const ts = row['Timestamp'];
        const waktu = ts ? parseTime(ts) : '';
        
        return [{
          tanggal: parseDate(row['Timestamp']),
          id_guru: guru.id,
          nama_guru: guru.nama,
          waktu: waktu,
          latitude: safeDouble(row['Latitude']),
          longitude: safeDouble(row['Longitude']),
          akurasi: safeDouble(row['Akurasi']),
          jarak_meter: safeDouble(row['Jarak_Meter']),
          status: String(row['Status'] || 'Menunggu Verifikasi')
        }];
      }
    },
    {
      file: 'Verifikasi_GPS.csv',
      table: 'verifikasi_gps_guru',
      onConflict: 'tanggal,id_guru',
      process: (row) => {
        const tanggal = parseDate(row['Tanggal']);
        const jsonStr = row['Data_JSON'];
        if (!jsonStr || !tanggal) return [];
        
        let dataObj = {};
        try {
          dataObj = JSON.parse(jsonStr);
        } catch(e) { return []; }
        
        const results = [];
        // json berbentuk { "ID_GURU": { status: "Hadir", catatan: "...", waktu: "..." } }
        for (const [idGuru, val] of Object.entries(dataObj)) {
          if (val.status === 'Libur') continue; // ABAIKAN JIKA LIBUR (karena tidak ada di check constraint verifikasi GPS)
          
          const guru = getGuruInfo(idGuru);
          results.push({
            tanggal: tanggal,
            id_guru: guru.id,
            nama_guru: guru.nama,
            waktu: String(val.waktu || ''),
            status: String(val.status || 'Hadir'),
            catatan: String(val.catatan || '-'),
            verifikator: 'Admin',
            metode: 'GPS'
          });
        }
        return results;
      }
    },
    {
      file: 'NFC_Guru.csv',
      table: 'nfc_guru',
      onConflict: 'tanggal,id_guru',
      process: (row) => {
        const guru = getGuruInfo(row['ID_Guru']);
        return [{
          tanggal: parseDate(row['Tanggal'] || row['Timestamp']),
          id_guru: guru.id,
          nama_guru: guru.nama,
          jam_datang: parseTime(row['Jam_Datang']) || '',
          jam_pulang: parseTime(row['Jam_Pulang']) || ''
        }];
      }
    }
  ];

  for (const target of targets) {
    const filePath = path.join(CSV_DIR, target.file);
    if (!fs.existsSync(filePath)) {
      console.log(`⏩ Melewati ${target.file} (File tidak ditemukan)`);
      continue;
    }

    console.log(`\n⏳ Memproses ${target.file}...`);
    const results = [];
    
    await new Promise((resolve) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => {
          try {
            const mapped = target.process(data);
            if (mapped && mapped.length > 0) {
              results.push(...mapped);
            }
          } catch(e) {
             console.log("Error processing row:", e.message);
          }
        })
        .on('end', resolve);
    });

    console.log(`   Ditemukan ${results.length} baris untuk dimasukkan ke tabel ${target.table}`);

    // Deduplikasi untuk mencegah "cannot affect row a second time"
    const uniqueResults = [];
    const seen = new Set();
    
    // Iterasi dari belakang agar mendapat data paling baru jika ada duplikat
    for (let i = results.length - 1; i >= 0; i--) {
      const row = results[i];
      let key = null;
      if (target.table === 'data_nfc_murid' || target.table === 'data_absensi') {
        key = `${row.tanggal}_${row.nisn}`;
      } else if (target.onConflict) {
        key = `${row.tanggal}_${row.id_guru}`;
      } else {
        key = `row_${i}`; // jurnal_guru tidak dideduplikasi
      }
      
      if (!seen.has(key)) {
        seen.add(key);
        uniqueResults.unshift(row); // masukkan ke depan agar urutan tetap (relatif)
      }
    }

    console.log(`   Setelah deduplikasi: ${uniqueResults.length} baris unik.`);

    if (uniqueResults.length > 0) {
      const chunkSize = 500;
      let successCount = 0;
      for (let i = 0; i < uniqueResults.length; i += chunkSize) {
        const chunk = uniqueResults.slice(i, i + chunkSize);
        
        // Cek dan pastikan murid ada untuk mencegah foreign key error
        if (target.table === 'data_absensi' || target.table === 'data_nfc_murid') {
          for (const row of chunk) {
            await ensureMuridExists(row.nisn, row.rombel);
          }
        }
        
        chunk.forEach(r => Object.keys(r).forEach(k => r[k] === undefined && delete r[k]));
        
        let action;
        if (!target.onConflict) {
          action = supabase.from(target.table).insert(chunk);
        } else {
          action = supabase.from(target.table).upsert(chunk, { onConflict: target.onConflict });
        }
          
        const { error } = await action;
        if (error) {
           console.error(`   ❌ Gagal insert chunk di ${target.file}:`, error.message);
        } else {
           successCount += chunk.length;
        }
      }
      console.log(`   ✅ Selesai. Sukses masuk: ${successCount}`);
    }
  }

  console.log("\n🎉 Seluruh proses migrasi CSV selesai!");
}

runMigration().catch(console.error);
