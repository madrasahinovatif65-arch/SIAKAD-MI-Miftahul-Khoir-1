-- ============================================================================
-- KONFIGURASI ROW LEVEL SECURITY (RLS) DENGAN SUPABASE AUTH
-- Jalankan script ini di menu "SQL Editor" pada dashboard Supabase Anda.
-- ============================================================================

-- 1. Tambahkan kolom user_id untuk relasi ke tabel auth.users
ALTER TABLE public.master_user ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- 2. Aktifkan RLS pada semua tabel
ALTER TABLE public.master_user ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_murid ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_mapel ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_jam_pelajaran ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_libur ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_absensi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_nfc_murid ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jurnal_guru ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_gps_guru ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verifikasi_gps_guru ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfc_guru ENABLE ROW LEVEL SECURITY;

-- HAPUS POLICY LAMA JIKA ADA (opsional)
-- DROP POLICY IF EXISTS "..." ON master_user;

-- ============================================================================
-- POLICY TABEL MASTER (Hanya bisa dibaca oleh user yang sudah login)
-- ============================================================================
CREATE POLICY "Allow authenticated read master_user" ON public.master_user FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated read master_murid" ON public.master_murid FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated read master_mapel" ON public.master_mapel FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated read master_jam_pelajaran" ON public.master_jam_pelajaran FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated read master_libur" ON public.master_libur FOR SELECT USING (auth.role() = 'authenticated');

-- Hanya user itu sendiri yang bisa UPDATE profilnya (ganti pin/foto)
CREATE POLICY "Allow individual update master_user" ON public.master_user FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- ============================================================================
-- POLICY TABEL OPERASIONAL
-- ============================================================================

-- JURNAL GURU: Hanya guru yang bersangkutan yang bisa CREATE, UPDATE, DELETE jurnalnya
CREATE POLICY "Allow guru select jurnal" ON public.jurnal_guru FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow guru insert jurnal" ON public.jurnal_guru FOR INSERT WITH CHECK (
  auth.uid() IN (SELECT user_id FROM public.master_user WHERE id_user = jurnal_guru.id_guru)
);
CREATE POLICY "Allow guru update jurnal" ON public.jurnal_guru FOR UPDATE USING (
  auth.uid() IN (SELECT user_id FROM public.master_user WHERE id_user = jurnal_guru.id_guru)
);
CREATE POLICY "Allow guru delete jurnal" ON public.jurnal_guru FOR DELETE USING (
  auth.uid() IN (SELECT user_id FROM public.master_user WHERE id_user = jurnal_guru.id_guru)
);

-- LOG GPS GURU
CREATE POLICY "Allow guru select log_gps" ON public.log_gps_guru FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow guru insert log_gps" ON public.log_gps_guru FOR INSERT WITH CHECK (
  auth.uid() IN (SELECT user_id FROM public.master_user WHERE id_user = log_gps_guru.id_guru)
);

-- VERIFIKASI GPS GURU
CREATE POLICY "Allow guru select verifikasi" ON public.verifikasi_gps_guru FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow guru insert verifikasi" ON public.verifikasi_gps_guru FOR INSERT WITH CHECK (
  auth.uid() IN (SELECT user_id FROM public.master_user WHERE id_user = verifikasi_gps_guru.id_guru)
);

-- DATA ABSENSI & NFC (Asumsi wali kelas / admin bisa input)
-- Untuk saat ini kita izinkan semua user terotentikasi menambah absensi 
-- (bisa diperketat nanti hanya untuk wali kelas)
CREATE POLICY "Allow authenticated select absensi" ON public.data_absensi FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated insert absensi" ON public.data_absensi FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated update absensi" ON public.data_absensi FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated select data_nfc_murid" ON public.data_nfc_murid FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated insert data_nfc_murid" ON public.data_nfc_murid FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated select nfc_guru" ON public.nfc_guru FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated insert nfc_guru" ON public.nfc_guru FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- PENGECUALIAN UNTUK ADMIN (Bisa melakukan apapun)
-- Misal Admin mendaftarkan murid baru, jadwal baru, dsb.
-- (Biasanya role Admin bisa kita deteksi dari master_user atau JWT claim)
-- Kita tambahkan fungsi helper untuk mengecek Admin
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.master_user 
    WHERE user_id = auth.uid() AND role = 'Admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Policy All-Access untuk Admin di tabel master (Contoh pada master_murid)
CREATE POLICY "Allow admin all master_murid" ON public.master_murid FOR ALL USING (public.is_admin());
CREATE POLICY "Allow admin all master_user" ON public.master_user FOR ALL USING (public.is_admin());
CREATE POLICY "Allow admin all master_mapel" ON public.master_mapel FOR ALL USING (public.is_admin());
