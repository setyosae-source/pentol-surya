import { appConfig } from './config.js';
import { authRepository } from '../data/authRepository.js';
import { toast } from './toast.js';

let lastActivity = Date.now();
let started = false;

export function initSessionTimeout() {
  if (started) return;
  started = true;

  ['click', 'keydown', 'touchstart', 'visibilitychange'].forEach((eventName) => {
    window.addEventListener(eventName, () => {
      lastActivity = Date.now();
    });
  });

  setInterval(async () => {
    const maxIdleMs = appConfig.sessionTimeoutMinutes * 60 * 1000;
    if (Date.now() - lastActivity <= maxIdleMs) return;

    try {
      await authRepository.signOut();
      toast.info('Sesi berakhir karena tidak ada aktivitas.');
    } catch {
      // No-op; session expiry should not break the UI.
    }
  }, 60_000);
}
