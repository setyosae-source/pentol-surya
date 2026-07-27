import { appConfig } from './config.js';
import { store } from './store.js';
import { shiftRepository } from '../data/shiftRepository.js';

let timer = null;
let trackedShiftId = null;

export function initLocationTracker() {
  store.subscribe((state) => {
    const shift = state.activeShift;
    const shouldTrack = state.profile?.role === 'employee' && shift?.status === 'active';

    if (!shouldTrack) {
      stopTracking();
      return;
    }

    if (trackedShiftId === shift.id && timer) return;

    stopTracking();
    trackedShiftId = shift.id;
    timer = setInterval(() => {
      if (navigator.onLine) {
        shiftRepository.sendLocationPing(store.getState().activeShift).catch(console.warn);
      }
    }, appConfig.locationPingMinutes * 60 * 1000);
  });
}

function stopTracking() {
  if (timer) clearInterval(timer);
  timer = null;
  trackedShiftId = null;
}
