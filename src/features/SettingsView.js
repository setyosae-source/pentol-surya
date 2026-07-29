import { authRepository } from '../data/authRepository.js';
import { appConfig } from '../core/config.js';
import { store } from '../core/store.js';
import { toast } from '../core/toast.js';

export function SettingsView({ setupOnly = false } = {}) {
  queueMicrotask(bindSettings);

  if (setupOnly) {
    return `
      <main class="auth-screen">
        <section class="auth-panel wide">
          <div class="brand-mark">PS</div>
          <h1>Konfigurasi Supabase belum diisi</h1>
          <p>Isi `.env` dari `.env.example`, lalu jalankan ulang build.</p>
          <pre class="code-block">VITE_SUPABASE_URL=https://project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...</pre>
          <a class="primary link-button" href="https://supabase.com/docs/guides/auth/passwords" target="_blank" rel="noreferrer">Buka dokumentasi Auth</a>
        </section>
      </main>
    `;
  }

  const profile = store.getState().profile;

  return `
    <section class="hero-panel">
      <small>Akun & Keamanan</small>
      <h1>Setting</h1>
      <p>Kelola PIN, sesi, dan konfigurasi dasar aplikasi.</p>
    </section>

    <section class="grid two owner-grid">
      ${profile?.role === 'employee' ? `
        <form class="surface stack" data-form="change-pin">
          <div class="section-title">
            <strong>Ganti PIN</strong>
            <small>PIN harus 6 digit</small>
          </div>
          <label class="field">
            <span>PIN lama</span>
            <input name="current_pin" type="password" inputmode="numeric" maxlength="6" required />
          </label>
          <label class="field">
            <span>PIN baru</span>
            <input name="new_pin" type="password" inputmode="numeric" maxlength="6" required />
          </label>
          <button class="primary" type="submit">Simpan PIN</button>
        </form>
      ` : `
        <article class="surface stack">
          <div class="section-title">
            <strong>Password owner</strong>
            <small>Dikelola oleh Supabase Auth</small>
          </div>
          <p class="muted">Owner dan manager memakai login email/password. PIN 6 digit hanya untuk karyawan.</p>
        </article>
      `}

      <article class="surface stack">
        <div class="section-title">
          <strong>Konfigurasi aktif</strong>
          <small>Frontend hanya memakai publishable key</small>
        </div>
        <div class="list-item">
          <span><strong>Supabase URL</strong><small>${appConfig.supabaseUrl || '-'}</small></span>
        </div>
        <div class="list-item">
          <span><strong>Timeout sesi</strong><small>${appConfig.sessionTimeoutMinutes} menit</small></span>
        </div>
        <div class="list-item">
          <span><strong>Ping lokasi</strong><small>${appConfig.locationPingMinutes} menit</small></span>
        </div>
      </article>
    </section>

    ${profile?.role !== 'employee' ? `
      <section class="surface stack">
        <div class="section-title">
          <strong>Manajemen data</strong>
          <small>Dibuka dari sidebar</small>
        </div>
        <div class="action-grid">
          <a class="action-card" href="#/owner/employees"><strong>Karyawan</strong><span>Tambah, edit, nonaktifkan, dan reset PIN.</span></a>
          <a class="action-card" href="#/owner/outlets"><strong>Outlet</strong><span>Kelola lokasi dan aturan outlet.</span></a>
          <a class="action-card" href="#/owner/products"><strong>Produk</strong><span>Kelola produk, harga umum, dan HPP.</span></a>
        </div>
      </section>
    ` : ''}
  `;
}

async function bindSettings() {
  document.querySelector('[data-form="change-pin"]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await submit(event.currentTarget, () => authRepository.updatePin({
      currentPin: form.get('current_pin'),
      newPin: form.get('new_pin'),
    }), 'PIN berhasil diganti.');
  });

}

async function submit(form, action, successMessage) {
  form.querySelectorAll('button, input, select, textarea').forEach((node) => {
    node.disabled = true;
  });
  try {
    await action();
    toast.success(successMessage);
    form.reset();
  } catch (error) {
    toast.error(error.message || 'Gagal menyimpan data.');
  } finally {
    form.querySelectorAll('button, input, select, textarea').forEach((node) => {
      node.disabled = false;
    });
  }
}
