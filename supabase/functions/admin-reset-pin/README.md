# admin-reset-pin

Edge Function untuk reset PIN karyawan oleh owner atau manager.

## Deploy

```bash
supabase functions deploy admin-reset-pin
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...
```

Frontend memanggil function ini memakai session user aktif. `service_role` hanya berada di Supabase Function, tidak pernah dikirim ke browser.
