-- ============================================================================
-- SIAKAD MI MIFTAHUL KHOIR - SUPABASE DATABASE SCHEMA
-- ============================================================================
-- Migrasi dari Google Sheets ke PostgreSQL (Supabase)
-- Tanggal: 2026-08-04
-- ============================================================================

-- ============================================================================
-- 1. TABEL MASTER
-- ============================================================================

-- 1a. Master User (pengganti sheet Master_User)
-- Kolom asli: ID_User, Nama, Role, PIN, Rombel, Status_Aktif, Mapel, Foto
CREATE TABLE IF NOT EXISTS master_user (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  id_user TEXT UNIQUE NOT NULL,          -- ID_User (ADM01, G001, 1001, dll)
  nama TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Admin', 'Wali Kelas', 'Guru Mapel', 'Murid')),
  pin TEXT NOT NULL DEFAULT '000000',    -- PIN login (6 digit)
  rombel TEXT DEFAULT '-',
  status_aktif TEXT DEFAULT 'Aktif' CHECK (status_aktif IN ('Aktif', 'Nonaktif')),
  mapel TEXT DEFAULT '-',                -- Khusus Guru Mapel (pisah koma jika >1)
  foto TEXT DEFAULT '',                  -- URL foto profil
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1b. Master Murid (pengganti sheet Master_Murid)
-- Kolom asli: NISN, Nama_Murid, Rombel, Status
CREATE TABLE IF NOT EXISTS master_murid (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nisn TEXT UNIQUE NOT NULL,
  nama_murid TEXT NOT NULL,
  rombel TEXT NOT NULL,
  status TEXT DEFAULT 'Aktif' CHECK (status IN ('Aktif', 'Nonaktif')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1c. Master Mapel (pengganti sheet Master_Mapel)
-- Kolom asli: ID_Mapel, Nama_Mapel
CREATE TABLE IF NOT EXISTS master_mapel (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  id_mapel TEXT UNIQUE NOT NULL,
  nama_mapel TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1d. Master Jam Pelajaran (pengganti sheet Master_Jam_Pelajaran)
-- Kolom asli: ID_Jam, Nama_Jam, Waktu_Mulai, Waktu_Selesai
CREATE TABLE IF NOT EXISTS master_jam_pelajaran (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  id_jam TEXT UNIQUE NOT NULL,
  nama_jam TEXT NOT NULL,
  waktu_mulai TEXT NOT NULL,
  waktu_selesai TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1e. Master Libur (pengganti sheet Master_Libur)
CREATE TABLE IF NOT EXISTS master_libur (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tanggal DATE UNIQUE NOT NULL,
  keterangan TEXT NOT NULL DEFAULT 'Libur',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. TABEL DATA OPERASIONAL
-- ============================================================================

-- 2a. Data Absensi Murid (pengganti sheet Data_Absensi)
-- Kolom asli: Timestamp, Tanggal, Rombel, Data_JSON, Rekap_Angka
-- Di Supabase, kita normalisasi: satu baris = satu murid per hari
CREATE TABLE IF NOT EXISTS data_absensi (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tanggal DATE NOT NULL,
  rombel TEXT NOT NULL,
  nisn TEXT NOT NULL REFERENCES master_murid(nisn),
  status TEXT NOT NULL CHECK (status IN ('Hadir', 'Sakit', 'Izin', 'Alfa', 'Dispen')),
  catatan TEXT DEFAULT '-',
  pencatat TEXT DEFAULT '-',             -- Nama guru yang mencatat
  metode TEXT DEFAULT 'Manual',          -- Manual / NFC
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tanggal, nisn)                  -- Anti duplikat: 1 murid 1 status per hari
);

-- 2b. Data NFC Murid (pengganti sheet Data_NFC)
-- Kolom baru: Timestamp, NISN, Nama_Murid, Rombel, Jam_Datang, Jam_Pulang
CREATE TABLE IF NOT EXISTS data_nfc_murid (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tanggal DATE NOT NULL,
  nisn TEXT NOT NULL,
  nama_murid TEXT NOT NULL,
  rombel TEXT NOT NULL,
  jam_datang TEXT DEFAULT '',
  jam_pulang TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tanggal, nisn)
);

-- 2c. Jurnal Guru (pengganti sheet Jurnal_Guru)
-- Kolom asli: Timestamp, Tanggal, Jam_Pelajaran, Nama_Guru, Rombel, Mata_Pelajaran, Materi_Catatan, Kehadiran_Siswa
CREATE TABLE IF NOT EXISTS jurnal_guru (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tanggal DATE NOT NULL,
  jam_pelajaran TEXT NOT NULL,
  id_guru TEXT NOT NULL,                 -- Referensi ke master_user.id_user
  nama_guru TEXT NOT NULL,
  rombel TEXT NOT NULL,
  mata_pelajaran TEXT NOT NULL,
  materi_catatan TEXT DEFAULT '',
  kehadiran_siswa JSONB DEFAULT '[]',    -- Array JSON siswa dan statusnya
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2d. Log GPS Guru (pengganti sheet Log_GPS)
CREATE TABLE IF NOT EXISTS log_gps_guru (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tanggal DATE NOT NULL,
  id_guru TEXT NOT NULL,
  nama_guru TEXT NOT NULL,
  waktu TEXT NOT NULL,                   -- Jam absen GPS (HH:mm)
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  akurasi DOUBLE PRECISION,
  jarak_meter DOUBLE PRECISION,
  status TEXT DEFAULT 'Menunggu Verifikasi',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tanggal, id_guru)              -- 1 guru 1x absen GPS per hari
);

-- 2e. Verifikasi GPS Guru (pengganti sheet Verifikasi_GPS)
CREATE TABLE IF NOT EXISTS verifikasi_gps_guru (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tanggal DATE NOT NULL,
  id_guru TEXT NOT NULL,
  nama_guru TEXT NOT NULL,
  waktu TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Hadir', 'Sakit', 'Izin', 'Alfa', 'Dinas Luar')),
  catatan TEXT DEFAULT '-',
  verifikator TEXT DEFAULT 'Admin',
  metode TEXT DEFAULT 'GPS',             -- GPS / NFC / Manual
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tanggal, id_guru)
);

-- 2f. NFC Guru (pengganti sheet NFC_Guru)
CREATE TABLE IF NOT EXISTS nfc_guru (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tanggal DATE NOT NULL,
  id_guru TEXT NOT NULL,
  nama_guru TEXT NOT NULL,
  jam_datang TEXT DEFAULT '',
  jam_pulang TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tanggal, id_guru)
);

-- ============================================================================
-- 3. INDEXES (untuk performa query)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_absensi_tanggal ON data_absensi(tanggal);
CREATE INDEX IF NOT EXISTS idx_absensi_rombel ON data_absensi(rombel);
CREATE INDEX IF NOT EXISTS idx_absensi_nisn ON data_absensi(nisn);
CREATE INDEX IF NOT EXISTS idx_jurnal_tanggal ON jurnal_guru(tanggal);
CREATE INDEX IF NOT EXISTS idx_jurnal_guru ON jurnal_guru(id_guru);
CREATE INDEX IF NOT EXISTS idx_log_gps_tanggal ON log_gps_guru(tanggal);
CREATE INDEX IF NOT EXISTS idx_verifikasi_tanggal ON verifikasi_gps_guru(tanggal);
CREATE INDEX IF NOT EXISTS idx_nfc_guru_tanggal ON nfc_guru(tanggal);
CREATE INDEX IF NOT EXISTS idx_nfc_murid_tanggal ON data_nfc_murid(tanggal);

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS) - Keamanan Data
-- ============================================================================
-- Akan dikonfigurasi setelah Supabase Auth disetup
-- Prinsip:
--   Admin: Bisa baca & tulis SEMUA tabel
--   Wali Kelas: Baca/tulis tabel yang terkait rombelnya
--   Guru Mapel: Baca/tulis jurnal dan absen GPS miliknya
--   Murid: Hanya baca riwayat absen miliknya sendiri

-- ============================================================================
-- 5. FUNGSI AUTO-UPDATE updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_master_user_updated
  BEFORE UPDATE ON master_user
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_absensi_updated
  BEFORE UPDATE ON data_absensi
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_verifikasi_updated
  BEFORE UPDATE ON verifikasi_gps_guru
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
