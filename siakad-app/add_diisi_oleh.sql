-- Tambah kolom diisi_oleh ke profil_non_kognitif
ALTER TABLE profil_non_kognitif
  ADD COLUMN IF NOT EXISTS diisi_oleh TEXT CHECK (diisi_oleh IN ('murid', 'guru'));

-- (Opsional) Index untuk filter cepat
CREATE INDEX IF NOT EXISTS idx_profil_nk_diisi_oleh ON profil_non_kognitif(diisi_oleh);
