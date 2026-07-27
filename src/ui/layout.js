import { authRepository } from '../data/authRepository.js';
import { store } from '../core/store.js';

export function renderShell({ profile, activeRoute, body }) {
  const isEmployee = profile.role === 'employee';
  const nav = isEmployee ? employeeNav(activeRoute) : ownerNav(activeRoute);
  const queueCount = store.getState().queueCount;
  const online = store.getState().online;

  queueMicrotask(bindShellEvents);

  return `
    <div class="app-frame">
      <header class="topbar">
        <a class="brand" href="#/${isEmployee ? 'employee' : 'owner'}" aria-label="Pentol Surya">
          <span class="brand-mark small">PS</span>
          <span>
            <strong>Pentol Surya</strong>
            <small>${profile.role}</small>
          </span>
        </a>
        <div class="topbar-actions">
          <span class="status-pill ${online ? 'online' : 'offline'}">${online ? 'Online' : 'Offline'}</span>
          ${queueCount ? `<span class="status-pill warn">${queueCount} antrean</span>` : ''}
          <button class="icon-button" data-action="toggle-theme" title="Dark mode" aria-label="Dark mode">DM</button>
          <button class="icon-button" data-action="logout" title="Keluar" aria-label="Keluar">OUT</button>
        </div>
      </header>
      <main class="page">${body}</main>
      ${isEmployee ? '<a class="fab" href="#/operations" aria-label="Tambah operasional">+</a>' : ''}
      ${nav}
    </div>
  `;
}

function employeeNav(activeRoute) {
  return `
    <nav class="bottom-nav">
      ${navItem('/employee', 'Beranda', 'HM', activeRoute)}
      ${navItem('/operations', 'Operasi', '+', activeRoute)}
      ${navItem('/shift/final', 'Tutup', 'OK', activeRoute)}
      ${navItem('/settings', 'Akun', 'ST', activeRoute)}
    </nav>
  `;
}

function ownerNav(activeRoute) {
  return `
    <nav class="bottom-nav">
      ${navItem('/owner', 'Dashboard', 'HM', activeRoute)}
      ${navItem('/operations', 'Input', '+', activeRoute)}
      ${navItem('/settings', 'Setting', 'ST', activeRoute)}
    </nav>
  `;
}

function navItem(path, label, icon, activeRoute) {
  const active = activeRoute === path ? 'active' : '';
  return `<a class="${active}" href="#${path}"><span>${icon}</span><small>${label}</small></a>`;
}

function bindShellEvents() {
  document.querySelector('[data-action="logout"]')?.addEventListener('click', async () => {
    await authRepository.signOut();
  });

  document.querySelector('[data-action="toggle-theme"]')?.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('pentol-surya:theme', next);
  });

  const savedTheme = localStorage.getItem('pentol-surya:theme');
  if (savedTheme) document.documentElement.dataset.theme = savedTheme;
}
