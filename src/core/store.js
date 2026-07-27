const initialState = {
  booted: false,
  setupRequired: false,
  session: null,
  profile: null,
  employee: null,
  activeShift: null,
  outlets: [],
  products: [],
  online: navigator.onLine,
  queueCount: 0,
};

let state = { ...initialState };
const listeners = new Set();

export const store = {
  getState() {
    return state;
  },
  setState(patch) {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener(state));
  },
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  reset() {
    state = { ...initialState, booted: true };
    listeners.forEach((listener) => listener(state));
  },
};
