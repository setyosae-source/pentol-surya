# Pentol Surya PWA

Pentol Surya adalah aplikasi operasional multi outlet untuk absensi, stok, penjualan, pengeluaran, laporan, monitoring lokasi, payroll, dan dashboard owner.

## Stack

- HTML5, CSS3, JavaScript ES6 modules
- Full HTML static frontend (`index.html`)
- Supabase Auth, Database, Storage, Realtime
- PWA manifest ringan
- GitHub Pages compatible

## Quick Start

Frontend utama sekarang adalah `index.html` tunggal. Untuk cek lokal, buka `index.html` langsung di browser atau jalankan static server sederhana.

Supabase URL dan publishable key bisa diisi lewat setup screen saat file dibuka lokal. Untuk GitHub Pages, workflow akan mengambil nilai dari repository secrets:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Jangan pernah menaruh `service_role` key di frontend.

## Supabase Setup

1. Buat project Supabase.
2. Jalankan SQL di `supabase/migrations/001_initial_schema.sql`.
3. Buat bucket Storage `shift-photos` bila belum dibuat oleh migration.
4. Deploy Edge Function `admin-create-employee` dan `admin-reset-pin` dengan `--no-verify-jwt`. Untuk update terbaru, deploy ulang function wajib agar tambah karyawan memakai email internal dan tidak bergantung Phone Auth.
5. Buat user owner pertama melalui Supabase Auth, lalu isi `user_profiles` dengan role `owner`.

## Demo Data

Untuk crosscheck semua layar dengan data dummy lengkap, buat minimal 1 karyawan dari sidebar `Karyawan`, lalu jalankan:

```text
supabase/seed-demo-data.sql
```

Panduan lengkap ada di `docs/demo-data.md`.

## GitHub Pages

Workflow `.github/workflows/deploy-pages.yml` tidak menjalankan Vite build. Workflow hanya menyiapkan `index.html`, menyuntikkan Supabase URL/key dari secrets, menyalin folder `public`, lalu deploy ke GitHub Pages.

## Struktur

- `index.html`: frontend full HTML yang dipakai GitHub Pages.
- `src`: arsip versi modular untuk pengembangan lanjutan bila diperlukan.
- `supabase`: migration dan Edge Function.
- `docs`: catatan roadmap dan deployment.
