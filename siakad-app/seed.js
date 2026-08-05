// Script untuk mengisi data awal (seed) ke Supabase
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://uodzgtprafjxyvvqfqam.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvZHpndHByYWZqeHl2dnFmcWFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4MzIyNTIsImV4cCI6MjEwMTQwODI1Mn0.MQDtuJz-aA6w4OymyMRK3YPpH3JxC91f7AsjCk5nLmk'
);

async function seed() {
  console.log('🌱 Mulai seeding data...\n');

  // 1. Master User
  const users = [
    { id_user: 'ADM01', nama: 'Kepala Sekolah', role: 'Admin', pin: '000000', rombel: '-', status_aktif: 'Aktif', mapel: '-' },
    { id_user: 'G001', nama: 'Ahmad Guru', role: 'Wali Kelas', pin: '123456', rombel: 'Kelas 1A', status_aktif: 'Aktif', mapel: '-' },
    { id_user: 'G002', nama: 'Siti Aisyah', role: 'Wali Kelas', pin: '654321', rombel: 'Kelas 1B', status_aktif: 'Aktif', mapel: '-' },
    { id_user: 'G003', nama: 'Pak Joko', role: 'Guru Mapel', pin: '123123', rombel: '-', status_aktif: 'Aktif', mapel: 'PJOK' },
    { id_user: 'G004', nama: 'Bu Ratna', role: 'Guru Mapel', pin: '321321', rombel: '-', status_aktif: 'Aktif', mapel: 'Matematika,Tematik' },
    { id_user: '1001', nama: 'Budi Santoso', role: 'Murid', pin: '111111', rombel: 'Kelas 1A', status_aktif: 'Aktif', mapel: '-' },
    { id_user: '1002', nama: 'Ani Wijaya', role: 'Murid', pin: '222222', rombel: 'Kelas 1A', status_aktif: 'Aktif', mapel: '-' },
    { id_user: '1003', nama: 'Citra Kirana', role: 'Murid', pin: '333333', rombel: 'Kelas 1A', status_aktif: 'Aktif', mapel: '-' },
    { id_user: '1004', nama: 'Dodi Pratama', role: 'Murid', pin: '444444', rombel: 'Kelas 1B', status_aktif: 'Aktif', mapel: '-' },
    { id_user: '1005', nama: 'Eka Sari', role: 'Murid', pin: '555555', rombel: 'Kelas 1B', status_aktif: 'Aktif', mapel: '-' },
  ];
  
  const { data: userData, error: userErr } = await supabase.from('master_user').upsert(users, { onConflict: 'id_user' }).select();
  if (userErr) console.error('❌ master_user:', userErr.message);
  else console.log(`✅ master_user: ${userData.length} baris`);

  // 2. Master Murid
  const murid = [
    { nisn: '1001', nama_murid: 'Budi Santoso', rombel: 'Kelas 1A', status: 'Aktif' },
    { nisn: '1002', nama_murid: 'Ani Wijaya', rombel: 'Kelas 1A', status: 'Aktif' },
    { nisn: '1003', nama_murid: 'Citra Kirana', rombel: 'Kelas 1A', status: 'Aktif' },
    { nisn: '1004', nama_murid: 'Dodi Pratama', rombel: 'Kelas 1B', status: 'Aktif' },
    { nisn: '1005', nama_murid: 'Eka Sari', rombel: 'Kelas 1B', status: 'Aktif' },
  ];

  const { data: muridData, error: muridErr } = await supabase.from('master_murid').upsert(murid, { onConflict: 'nisn' }).select();
  if (muridErr) console.error('❌ master_murid:', muridErr.message);
  else console.log(`✅ master_murid: ${muridData.length} baris`);

  // 3. Master Mapel
  const mapel = [
    { id_mapel: 'MP01', nama_mapel: 'Tematik' },
    { id_mapel: 'MP02', nama_mapel: 'Matematika' },
    { id_mapel: 'MP03', nama_mapel: 'Pendidikan Agama Islam (PAI)' },
    { id_mapel: 'MP04', nama_mapel: 'Pendidikan Pancasila' },
    { id_mapel: 'MP05', nama_mapel: 'PJOK' },
  ];

  const { data: mapelData, error: mapelErr } = await supabase.from('master_mapel').upsert(mapel, { onConflict: 'id_mapel' }).select();
  if (mapelErr) console.error('❌ master_mapel:', mapelErr.message);
  else console.log(`✅ master_mapel: ${mapelData.length} baris`);

  // 4. Master Jam Pelajaran
  const jam = [
    { id_jam: 'J01', nama_jam: 'Jam Ke-1', waktu_mulai: '07:00', waktu_selesai: '07:35' },
    { id_jam: 'J02', nama_jam: 'Jam Ke-2', waktu_mulai: '07:35', waktu_selesai: '08:10' },
    { id_jam: 'J03', nama_jam: 'Jam Ke-3', waktu_mulai: '08:10', waktu_selesai: '08:45' },
    { id_jam: 'J04', nama_jam: 'Jam Ke-4', waktu_mulai: '08:45', waktu_selesai: '09:20' },
    { id_jam: 'J05', nama_jam: 'Jam Ke-5', waktu_mulai: '09:40', waktu_selesai: '10:15' },
    { id_jam: 'J06', nama_jam: 'Jam Ke-6', waktu_mulai: '10:15', waktu_selesai: '10:50' },
  ];

  const { data: jamData, error: jamErr } = await supabase.from('master_jam_pelajaran').upsert(jam, { onConflict: 'id_jam' }).select();
  if (jamErr) console.error('❌ master_jam_pelajaran:', jamErr.message);
  else console.log(`✅ master_jam_pelajaran: ${jamData.length} baris`);

  console.log('\n🎉 Seeding selesai!');
}

seed().catch(console.error);
