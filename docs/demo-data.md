# Demo Data

Gunakan file ini untuk mengisi data dummy lengkap agar semua layar Pentol Surya bisa dicek cepat.

## Prasyarat

1. Migration `supabase/migrations/001_initial_schema.sql` sudah dijalankan.
2. Owner sudah bisa login.
3. Minimal 1 karyawan sudah dibuat dari sidebar `Karyawan`.

Untuk hasil demo paling lengkap, buat 3 karyawan dari sidebar `Karyawan`:

| Nama | Kode | HP | PIN |
| --- | --- | --- | --- |
| Demo Ari | DEMO-001 | +628110000001 | 111111 |
| Demo Bima | DEMO-002 | +628110000002 | 222222 |
| Demo Citra | DEMO-003 | +628110000003 | 333333 |

Kalau baru ada 1 karyawan, seed tetap jalan. Data shift akan memakai karyawan yang tersedia.

## Cara Menjalankan

1. Buka Supabase Dashboard.
2. Masuk ke `SQL Editor`.
3. Buka file `supabase/seed-demo-data.sql`.
4. Copy semua isi file.
5. Paste ke SQL Editor, lalu klik `Run`.

Jika sukses, SQL Editor akan menampilkan notice:

```text
Demo data Pentol Surya selesai.
```

## Data Yang Dibuat

- 3 outlet demo dengan geofence dan jadwal laporan berbeda.
- 6 produk demo dengan kategori, harga umum, HPP, dan qty default.
- Harga khusus per outlet.
- Assignment outlet ke karyawan.
- Shift aktif, shift sudah tutup, dan shift final report belum absen pulang.
- Absen masuk/pulang dummy dengan path foto contoh.
- Laporan awal dan stok awal.
- Penjualan cash, QRIS, transfer, dan piutang.
- Pengeluaran outlet.
- Supply tambahan.
- Produk terbuang dengan nilai HPP.
- Laporan berkala dengan selisih stok.
- Laporan akhir dan setoran cash.
- Ping lokasi di dalam dan luar radius.
- Pengeluaran umum owner.
- Payroll periode draft dan payroll items.
- Audit log otomatis dari trigger database.

## Catatan

Seed ini aman dijalankan ulang. Script akan membersihkan data transaksi yang bertanda `DEMO:` dan membuat ulang data demo terbaru.

Untuk menghapus tampilan demo secara manual, hapus data yang memakai prefix:

- Outlet: `DEMO -`
- Produk: `DEMO -`
- Catatan transaksi: `DEMO:`
- Periode payroll: `DEMO -`
