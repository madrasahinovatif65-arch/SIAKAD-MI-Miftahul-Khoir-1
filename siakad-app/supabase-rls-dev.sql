-- ============================================================================
-- SIAKAD - ROW LEVEL SECURITY POLICIES
-- ============================================================================
-- Jalankan script ini di Supabase SQL Editor
-- Ini akan mengizinkan operasi CRUD melalui anon key
-- ============================================================================

-- Nonaktifkan RLS untuk tabel master (data publik untuk read, admin untuk write)
-- Opsi 1: Disable RLS sepenuhnya (paling simple untuk development)

ALTER TABLE master_user DISABLE ROW LEVEL SECURITY;
ALTER TABLE master_murid DISABLE ROW LEVEL SECURITY;
ALTER TABLE master_mapel DISABLE ROW LEVEL SECURITY;
ALTER TABLE master_jam_pelajaran DISABLE ROW LEVEL SECURITY;
ALTER TABLE master_libur DISABLE ROW LEVEL SECURITY;
ALTER TABLE data_absensi DISABLE ROW LEVEL SECURITY;
ALTER TABLE data_nfc_murid DISABLE ROW LEVEL SECURITY;
ALTER TABLE jurnal_guru DISABLE ROW LEVEL SECURITY;
ALTER TABLE log_gps_guru DISABLE ROW LEVEL SECURITY;
ALTER TABLE verifikasi_gps_guru DISABLE ROW LEVEL SECURITY;
ALTER TABLE nfc_guru DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CATATAN: Untuk production, kita akan mengaktifkan RLS kembali
-- dan membuat policy yang lebih ketat per role.
-- Untuk saat ini (development), kita nonaktifkan agar bisa
-- melakukan CRUD tanpa hambatan.
-- ============================================================================
