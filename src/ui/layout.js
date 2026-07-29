import { authRepository } from '../data/authRepository.js';
import { store } from '../core/store.js';

export function renderShell({ profile, activeRoute, body }) {
  const isEmployee = profile.role === 'employee';
  const nav = isEmployee ? employeeNav(activeRoute) : ownerNav(activeRoute);
  const queueCount = store.getState().queueCount;
  const online = store.getState().online;

  queueMicrotask(bindShellEvents);

  return `
    <div class="app-frame ${isEmployee ? 'employee-frame' : 'owner-frame'}">
      <header class="topbar">
        ${isEmployee ? '' : `
          <button class="burger" type="button" data-action="toggle-sidebar" aria-label="Buka menu">
            <span></span><span></span><span></span>
          </button>
        `}
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
      ${isEmployee ? '' : '<div class="sidebar-overlay" data-sidebar-overlay></div>'}
      ${isEmployee ? '' : nav}
      <main class="page">${body}</main>
      ${isEmployee ? '<a class="fab" href="#/operations" aria-label="Tambah operasional">+</a>' : ''}
      ${isEmployee ? nav : ''}
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
    <nav class="sidebar" data-sidebar aria-label="Menu owner">
      <div class="sidebar-header">
        <p>Login sebagai</p>
        <strong>Owner / Manager</strong>
      </div>
      <div class="sidebar-scroll">
        ${navGroup('Pantauan', [
          navItem('/owner', 'Dashboard', 'DB', activeRoute),
          navItem('/owner/audit', 'Audit log', 'AU', activeRoute),
        ])}
        ${navGroup('Operasional', [
          navItem('/owner/employees', 'Karyawan', 'KR', activeRoute),
          navItem('/owner/outlets', 'Outlet', 'OT', activeRoute),
          navItem('/owner/products', 'Produk', 'PR', activeRoute),
          navItem('/owner/prices', 'Harga outlet', 'HG', activeRoute),
        ])}
        ${navGroup('Keuangan', [
          navItem('/owner/expenses', 'Biaya umum', 'BY', activeRoute),
          navItem('/owner/payroll', 'Payroll', 'PY', activeRoute),
        ])}
        ${navGroup('Pengaturan', [
          navItem('/settings', 'Setting', 'ST', activeRoute),
        ])}
      </div>
    </nav>
  `;
}

function navGroup(title, items) {
  return `
    <div class="nav-group">
      <button class="nav-group-title" type="button" data-nav-collapse>
        <span>${title}</span><span class="nav-arrow">v</span>
      </button>
      <div class="nav-group-items open">
        ${items.join('')}
      </div>
    </div>
  `;
}

function navItem(path, label, icon, activeRoute) {
  const active = activeRoute === path ? 'active' : '';
  return `<a class="nav-item ${active}" href="#${path}"><span class="ni">${icon}</span><small>${label}</small></a>`;
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

  document.querySelector('[data-action="toggle-sidebar"]')?.addEventListener('click', () => {
    document.querySelector('[data-sidebar]')?.classList.toggle('open');
    document.querySelector('[data-sidebar-overlay]')?.classList.toggle('open');
  });

  document.querySelector('[data-sidebar-overlay]')?.addEventListener('click', closeSidebar);
  document.querySelectorAll('.sidebar .nav-item').forEach((item) => {
    item.addEventListener('click', closeSidebar);
  });

  document.querySelectorAll('[data-nav-collapse]').forEach((button) => {
    button.addEventListener('click', () => {
      const items = button.nextElementSibling;
      items?.classList.toggle('closed');
      button.querySelector('.nav-arrow')?.classList.toggle('closed');
    });
  });
}

function closeSidebar() {
  document.querySelector('[data-sidebar]')?.classList.remove('open');
  document.querySelector('[data-sidebar-overlay]')?.classList.remove('open');
}
