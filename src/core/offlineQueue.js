import { store } from './store.js';
import { toast } from './toast.js';

const QUEUE_KEY = 'pentol-surya:offline-queue';

export function initNetworkStatus() {
  const syncState = () => store.setState({ online: navigator.onLine, queueCount: getQueue().length });
  window.addEventListener('online', () => {
    syncState();
    toast.info('Koneksi kembali online. Data antrean siap disinkronkan.');
  });
  window.addEventListener('offline', () => {
    syncState();
    toast.info('Mode offline aktif. Data akan diantrikan.');
  });
  syncState();
}

export function getQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function queueMutation(type, payload) {
  const queue = getQueue();
  queue.push({
    id: crypto.randomUUID(),
    type,
    payload,
    createdAt: new Date().toISOString(),
  });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  store.setState({ queueCount: queue.length });
}

export async function flushQueue(handler) {
  if (!navigator.onLine) return;
  const queue = getQueue();
  const remaining = [];

  for (const item of queue) {
    try {
      await handler(item);
    } catch (error) {
      console.warn('Queue item failed', item, error);
      remaining.push(item);
    }
  }

  localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  store.setState({ queueCount: remaining.length });
}
