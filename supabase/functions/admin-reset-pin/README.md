# admin-reset-pin

Edge Function untuk reset PIN karyawan oleh owner atau manager.

## Deploy

```bash
supabase secrets set SERVICE_ROLE_KEY=...
supabase functions deploy admin-reset-pin --no-verify-jwt
```

Frontend memanggil function ini memakai session user aktif. `service_role` hanya berada di Supabase Function, tidak pernah dikirim ke browser.

`--no-verify-jwt` diperlukan supaya request CORS `OPTIONS` dari browser tidak ditolak sebelum function berjalan. Function tetap memvalidasi user owner/manager di dalam kode.
