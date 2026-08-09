---
trigger: always_on
---

# Next.js App Router Standards
- Gunakan Next.js App Router (struktur folder `src/app/`).
- Gunakan TypeScript untuk keamanan tipe data secara ketat.
- Gunakan Tailwind CSS untuk penataan gaya (styling).
- Secara default, buat komponen sebagai Server Component. Hanya gunakan `'use client'` jika diperlukan interaktivitas (seperti useState/useEffect).
- Jangan pernah menjalankan perintah `npm run dev` di terminal latar belakang tanpa izin eksplisit dari user.
