# Pentol Surya PWA

Pentol Surya adalah aplikasi operasional multi outlet untuk absensi, stok, penjualan, pengeluaran, laporan, monitoring lokasi, payroll, dan dashboard owner.

## Stack

- HTML5, CSS3, JavaScript ES6 modules
- Vite
- Supabase Auth, Database, Storage, Realtime
- PWA offline shell
- GitHub Pages compatible

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

Isi `.env` dengan Supabase URL dan publishable key. Jangan pernah menaruh `service_role` key di frontend.

## Supabase Setup

1. Buat project Supabase.
2. Jalankan SQL di `supabase/migrations/001_initial_schema.sql`.
3. Buat bucket Storage `shift-photos` bila belum dibuat oleh migration.
4. Deploy Edge Function `admin-reset-pin` untuk reset PIN oleh owner.
5. Buat user owner pertama melalui Supabase Auth, lalu isi `user_profiles` dengan role `owner`.

## GitHub Pages

Build memakai `base: './'`, sehingga hasil `dist/` dapat dipakai di GitHub Pages.

```bash
npm run build
```

## Struktur

- `src/core`: router, Supabase client, state, helpers, offline queue.
- `src/data`: repository data per domain.
- `src/features`: layar utama aplikasi.
- `src/ui`: komponen UI kecil reusable.
- `supabase`: migration dan Edge Function.
- `docs`: catatan roadmap dan deployment.
