# Deployment

## Supabase

1. Buat project Supabase.
2. Aktifkan provider email/password untuk owner dan manager. Phone Auth tidak wajib untuk karyawan karena akun karyawan dibuat memakai email internal, lalu login nomor HP/kode karyawan diselesaikan oleh resolver database.
3. Jalankan migration:

```bash
supabase db push
```

Atau paste isi `supabase/migrations/001_initial_schema.sql` di SQL Editor.

4. Deploy Edge Function:

```bash
supabase secrets set SERVICE_ROLE_KEY=your-service-role-key
supabase functions deploy admin-reset-pin --no-verify-jwt
supabase functions deploy admin-create-employee --no-verify-jwt
```

`--no-verify-jwt` diperlukan agar browser bisa melewati request CORS `OPTIONS`. Function tetap aman karena kode function memvalidasi session owner/manager sebelum memakai `service_role`.
Deploy ulang dua function ini setiap mengambil ZIP terbaru yang mengubah folder `supabase/functions`.

5. Buat user owner pertama di Supabase Auth.
6. Tambahkan record `tenants` dan `user_profiles` role `owner`.

## Frontend GitHub Pages

1. Isi repository secret:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

2. Jalankan build:

```bash
npm install
npm run build
```

3. Publish folder `dist`.

## Catatan Keamanan

- Jangan taruh `service_role` di `src`, `.env`, atau GitHub Pages.
- Karyawan tidak boleh melihat HPP dan laba di UI. RLS tetap membatasi tenant dan role, tetapi untuk produksi lanjut sebaiknya buat view khusus karyawan tanpa kolom HPP.
- Reset PIN dan pembuatan user karyawan harus melalui server-side Edge Function.
- Untuk fitur finansial sensitif, set JWT expiry Supabase lebih pendek dan aktifkan MFA untuk owner.
