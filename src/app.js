import { isSupabaseConfigured } from './core/config.js';
import { createRouter } from './core/router.js';
import { store } from './core/store.js';
import { initSessionTimeout } from './core/session.js';
import { initNetworkStatus } from './core/offlineQueue.js';
import { initLocationTracker } from './core/locationTracker.js';
import { initQueueSync } from './core/queueSync.js';
import { initRealtime } from './core/realtime.js';
import { toast } from './core/toast.js';
import { authRepository } from './data/authRepository.js';
import { LoginView } from './features/LoginView.js';
import { EmployeeDashboard } from './features/EmployeeDashboard.js';
import { OwnerDashboard } from './features/OwnerDashboard.js';
import { OperationsView } from './features/OperationsView.js';
import { ShiftFinalView } from './features/ShiftFinalView.js';
import { SettingsView } from './features/SettingsView.js';
import { renderShell } from './ui/layout.js';

const routes = {
  '/employee': EmployeeDashboard,
  '/operations': OperationsView,
  '/shift/final': ShiftFinalView,
  '/owner': OwnerDashboard,
  '/settings': SettingsView,
};

export async function createApp(root) {
  registerServiceWorker();
  initNetworkStatus();
  initQueueSync();
  initSessionTimeout();
  initLocationTracker();
  initRealtime();

  const router = createRouter(async (route) => {
    await render(root, route);
  });

  store.subscribe(() => render(root, router.current()));

  root.innerHTML = renderLoadingApp();

  if (!isSupabaseConfigured()) {
    store.setState({ booted: true, setupRequired: true });
    return;
  }

  try {
    const session = await authRepository.getSession();
    const profile = session ? await authRepository.getCurrentProfile() : null;
    store.setState({ booted: true, session, profile });

    authRepository.onAuthStateChange(async (event, sessionData) => {
      const nextProfile = sessionData ? await authRepository.getCurrentProfile() : null;
      store.setState({ session: sessionData, profile: nextProfile });
      if (event === 'SIGNED_OUT') location.hash = '#/';
    });
  } catch (error) {
    console.error(error);
    toast.error('Gagal memuat sesi aplikasi.');
    store.setState({ booted: true, session: null, profile: null });
  }
}

async function render(root, route = '/') {
  const state = store.getState();

  if (!state.booted) {
    root.innerHTML = renderLoadingApp();
    return;
  }

  if (state.setupRequired) {
    root.innerHTML = SettingsView({ setupOnly: true });
    return;
  }

  if (!state.session || !state.profile) {
    root.innerHTML = LoginView();
    return;
  }

  const defaultRoute = state.profile.role === 'employee' ? '/employee' : '/owner';
  const normalizedRoute = route === '/' ? defaultRoute : route;
  const view = routes[normalizedRoute] || routes[defaultRoute];

  root.innerHTML = renderShell({
    profile: state.profile,
    activeRoute: normalizedRoute,
    body: view(),
  });
}

function renderLoadingApp() {
  return `
    <main class="splash">
      <div class="brand-mark" aria-hidden="true">PS</div>
      <h1>Pentol Surya</h1>
      <p>Menyiapkan aplikasi operasional...</p>
      <div class="skeleton block"></div>
    </main>
  `;
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {
      console.warn('Service worker registration failed.');
    });
  });
}
