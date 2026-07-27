import { authRepository } from '../data/authRepository.js';
import { employeeRepository } from '../data/employeeRepository.js';
import { catalogRepository } from '../data/catalogRepository.js';
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
          <strong>Tambah karyawan</strong>
          <small>Login memakai nomor HP atau kode karyawan dan PIN</small>
        </div>
        <form class="grid three" data-form="create-employee">
          <label class="field">
            <span>Nama lengkap</span>
            <input name="full_name" required />
          </label>
          <label class="field">
            <span>Kode karyawan</span>
            <input name="employee_code" placeholder="PS001" required />
          </label>
          <label class="field">
            <span>Nomor HP</span>
            <input name="phone" inputmode="tel" placeholder="+62812..." required />
          </label>
          <label class="field">
            <span>PIN awal</span>
            <input name="pin" type="password" inputmode="numeric" maxlength="6" required />
          </label>
          <label class="field">
            <span>Outlet default</span>
            <select name="default_outlet_id" data-outlet-select>
              <option value="">Bebas dipilih karyawan</option>
            </select>
          </label>
          <label class="field">
            <span>Upah per jam</span>
            <input name="hourly_rate" type="number" value="5000" min="0" />
          </label>
          <label class="field">
            <span>Uang makan</span>
            <input name="meal_allowance" type="number" value="10000" min="0" />
          </label>
          <label class="field">
            <span>Transport</span>
            <input name="transport_allowance" type="number" value="0" min="0" />
          </label>
          <button class="primary self-end" type="submit">Buat Karyawan</button>
        </form>
      </section>

      <section class="surface stack" data-employee-pin-panel>
        <div class="section-title">
          <strong>Reset PIN karyawan</strong>
          <small>Diproses lewat Edge Function dengan service role di server</small>
        </div>
        <form class="grid three" data-form="reset-pin">
          <label class="field">
            <span>Karyawan</span>
            <select name="user_id" required data-employee-select>
              <option value="">Memuat karyawan...</option>
            </select>
          </label>
          <label class="field">
            <span>PIN baru</span>
            <input name="new_pin" type="password" inputmode="numeric" maxlength="6" required />
          </label>
          <button class="primary self-end" type="submit">Reset PIN</button>
        </form>
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

  const select = document.querySelector('[data-employee-select]');
  const outletSelect = document.querySelector('[data-outlet-select]');
  if (outletSelect) {
    try {
      const outlets = await catalogRepository.loadOutlets();
      outletSelect.innerHTML = '<option value="">Bebas dipilih karyawan</option>' + outlets.map((outlet) => `
        <option value="${outlet.id}">${outlet.name}</option>
      `).join('');
    } catch (error) {
      toast.error(error.message || 'Gagal memuat outlet.');
    }
  }

  if (select) {
    try {
      const employees = await employeeRepository.listEmployees();
      select.innerHTML = '<option value="">Pilih karyawan</option>' + employees.map((employee) => `
        <option value="${employee.user_id}">${employee.employee_code} - ${employee.user_profiles?.full_name || employee.phone}</option>
      `).join('');
    } catch (error) {
      toast.error(error.message || 'Gagal memuat daftar karyawan.');
    }
  }

  document.querySelector('[data-form="create-employee"]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await submit(event.currentTarget, () => authRepository.createEmployee({
      full_name: form.get('full_name'),
      employee_code: form.get('employee_code'),
      phone: form.get('phone'),
      pin: form.get('pin'),
      default_outlet_id: form.get('default_outlet_id') || null,
      hourly_rate: form.get('hourly_rate'),
      meal_allowance: form.get('meal_allowance'),
      transport_allowance: form.get('transport_allowance'),
    }), 'Karyawan berhasil dibuat.');
  });

  document.querySelector('[data-form="reset-pin"]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await submit(event.currentTarget, () => authRepository.resetEmployeePin({
      userId: form.get('user_id'),
      newPin: form.get('new_pin'),
    }), 'PIN karyawan berhasil direset.');
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
