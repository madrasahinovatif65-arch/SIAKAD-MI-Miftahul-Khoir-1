-- 1. Update CHECK constraint pada tabel master_user
-- Asumsikan constraint bernama master_user_role_check
ALTER TABLE master_user DROP CONSTRAINT IF EXISTS master_user_role_check;
ALTER TABLE master_user ADD CONSTRAINT master_user_role_check 
  CHECK (role IN ('Admin', 'Guru Mapel', 'Wali Kelas', 'Murid', 'Kepala Madrasah'));

-- 2. Buat fungsi helper untuk Kepala Madrasah
CREATE OR REPLACE FUNCTION public.is_kepala_madrasah()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM master_user
    WHERE id_user = auth.uid()::text AND role = 'Kepala Madrasah'
  );
$$;

-- 3. Kebijakan RLS (Jika tabel-tabel utama menggunakan RLS yang ketat, 
-- pastikan SELECT diizinkan untuk Kepala Madrasah, mirip seperti Admin).
-- Contoh jika verifikasi_guru menggunakan RLS:
-- ALTER TABLE verifikasi_guru ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Kepala Madrasah can update verifikasi_guru" 
-- ON verifikasi_guru FOR UPDATE TO authenticated USING (is_kepala_madrasah() OR is_admin());
