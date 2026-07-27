# Deployment

## Supabase

1. Buat project Supabase.
2. Aktifkan provider email/password dan phone/password sesuai kebutuhan login.
3. Jalankan migration:

```bash
supabase db push
```

Atau paste isi `supabase/migrations/001_initial_schema.sql` di SQL Editor.

4. Deploy Edge Function:

```bash
supabase functions deploy admin-reset-pin
supabase functions deploy admin-create-employee
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

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
- Reset PIN dan pembuatan user karyawan harus melalui server-side function.
- Untuk fitur finansial sensitif, set JWT expiry Supabase lebih pendek dan aktifkan MFA untuk owner.
