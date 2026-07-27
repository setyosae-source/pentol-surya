import { flushQueue, getQueue } from './offlineQueue.js';
import { operationsRepository } from '../data/operationsRepository.js';
import { toast } from './toast.js';

let started = false;

export function initQueueSync() {
  if (started) return;
  started = true;

  window.addEventListener('online', syncQueue);
  if (navigator.onLine) queueMicrotask(syncQueue);
}

async function syncQueue() {
  if (!getQueue().length) return;
  await flushQueue(async (item) => {
    switch (item.type) {
      case 'addSale':
        await operationsRepository.addSale(item.payload);
        break;
      case 'addOutletExpense':
        await operationsRepository.addOutletExpense(item.payload);
        break;
      case 'addSupply':
        await operationsRepository.addSupply(item.payload);
        break;
      case 'addWaste':
        await operationsRepository.addWaste(item.payload);
        break;
      case 'addPeriodicReport':
        await operationsRepository.addPeriodicReport(item.payload);
        break;
      default:
        throw new Error(`Unknown queue type: ${item.type}`);
    }
  });
  toast.success('Antrean offline selesai disinkronkan.');
}
