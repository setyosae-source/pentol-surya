# admin-create-employee

Edge Function untuk owner/manager membuat akun karyawan dengan nomor HP/kode karyawan dan PIN 6 digit.

```bash
supabase secrets set SERVICE_ROLE_KEY=...
supabase functions deploy admin-create-employee --no-verify-jwt
```

Function membuat email internal otomatis di Supabase Auth, lalu menyimpan nomor HP dan kode karyawan di profil. Karyawan tetap login memakai nomor HP atau kode karyawan + PIN. PIN disimpan sebagai password hash di Supabase Auth. Frontend hanya mengirim request memakai session owner/manager yang sedang login.

`--no-verify-jwt` diperlukan supaya request CORS `OPTIONS` dari browser tidak ditolak sebelum function berjalan. Function tetap memvalidasi user owner/manager di dalam kode.
