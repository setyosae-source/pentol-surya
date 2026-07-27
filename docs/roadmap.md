# Roadmap Development Pentol Surya

## Tahap 1 - Foundation

- Supabase schema, RLS, storage policies, audit log.
- Auth owner, manager, karyawan.
- PWA shell, routing, layout mobile first.
- Shift lifecycle: absen masuk, laporan awal, operasional, laporan akhir, absen pulang.

## Tahap 2 - Operasional Outlet

- Penjualan item per transaksi dan rekonsiliasi selisih stok.
- Pengeluaran outlet tanpa approval.
- Supply tambahan dengan sumber supply.
- Produk terbuang dengan HPP dan foto opsional.
- Laporan berkala fleksibel atau jadwal tertentu.

## Tahap 3 - Owner Dashboard

- KPI penjualan, cash, QRIS, transfer, pengeluaran, HPP, laba, setoran, gaji.
- Grafik tren harian.
- Monitoring lokasi 15 menit.
- Outlet belum laporan, selisih stok, selisih cash, produk terlaris, top outlet.

## Tahap 4 - Payroll

- Periode gaji fleksibel.
- Draft, Final, Sudah Dibayar.
- Komponen upah per jam, uang makan, transport, bonus manual.
- Rekap jam kerja dari absen masuk sampai absen pulang, istirahat tetap dibayar.

## Tahap 5 - Hardening

- Edge Function untuk create employee dan reset PIN.
- Rate limit login berbasis database dan Supabase Auth.
- Monitoring error.
- Backup dan migration workflow.
- E2E test Playwright untuk alur karyawan dan owner.
