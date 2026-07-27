import { authRepository } from '../data/authRepository.js';
import { toast } from '../core/toast.js';

export function LoginView() {
  queueMicrotask(bindLogin);

  return `
    <main class="auth-screen">
      <section class="auth-panel">
        <div class="brand-mark">PS</div>
        <h1>Pentol Surya</h1>
        <p>Sistem operasional multi outlet.</p>

        <div class="segmented" role="tablist">
          <button class="active" data-login-tab="employee">Karyawan</button>
          <button data-login-tab="owner">Owner / Manager</button>
        </div>

        <form class="stack" data-form="employee-login">
          <label class="field">
            <span>Kode karyawan / nomor HP</span>
            <input name="identifier" autocomplete="username" placeholder="PS001 atau 0812..." required />
          </label>
          <label class="field">
            <span>PIN 6 digit</span>
            <input name="pin" type="password" inputmode="numeric" maxlength="6" autocomplete="current-password" required />
          </label>
          <button class="primary" type="submit">Masuk</button>
        </form>

        <form class="stack hidden" data-form="owner-login">
          <label class="field">
            <span>Email</span>
            <input name="email" type="email" autocomplete="email" required />
          </label>
          <label class="field">
            <span>Password</span>
            <input name="password" type="password" autocomplete="current-password" required />
          </label>
          <button class="primary" type="submit">Masuk Dashboard</button>
        </form>
      </section>
    </main>
  `;
}

function bindLogin() {
  const employeeForm = document.querySelector('[data-form="employee-login"]');
  const ownerForm = document.querySelector('[data-form="owner-login"]');
  const tabs = document.querySelectorAll('[data-login-tab]');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((item) => item.classList.remove('active'));
      tab.classList.add('active');
      const isEmployee = tab.dataset.loginTab === 'employee';
      employeeForm.classList.toggle('hidden', !isEmployee);
      ownerForm.classList.toggle('hidden', isEmployee);
    });
  });

  employeeForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitter = employeeForm.querySelector('button[type="submit"]');
    submitter.disabled = true;
    submitter.textContent = 'Memproses...';
    try {
      const form = new FormData(employeeForm);
      await authRepository.signInEmployee({
        identifier: form.get('identifier'),
        pin: form.get('pin'),
      });
      toast.success('Login berhasil.');
      location.hash = '#/employee';
    } catch (error) {
      toast.error(error.message || 'Login gagal.');
    } finally {
      submitter.disabled = false;
      submitter.textContent = 'Masuk';
    }
  });

  ownerForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitter = ownerForm.querySelector('button[type="submit"]');
    submitter.disabled = true;
    submitter.textContent = 'Memproses...';
    try {
      const form = new FormData(ownerForm);
      await authRepository.signInOwner({
        email: form.get('email'),
        password: form.get('password'),
      });
      toast.success('Login berhasil.');
      location.hash = '#/owner';
    } catch (error) {
      toast.error(error.message || 'Login gagal.');
    } finally {
      submitter.disabled = false;
      submitter.textContent = 'Masuk Dashboard';
    }
  });
}
