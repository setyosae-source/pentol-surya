# admin-create-employee

Edge Function untuk owner/manager membuat akun karyawan dengan nomor HP dan PIN 6 digit.

```bash
supabase functions deploy admin-create-employee
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...
```

PIN disimpan sebagai password hash di Supabase Auth. Frontend hanya mengirim request memakai session owner/manager yang sedang login.
