const ensureHost = () => {
  let host = document.querySelector('[data-toast-host]');
  if (!host) {
    host = document.createElement('div');
    host.className = 'toast-host';
    host.dataset.toastHost = 'true';
    document.body.append(host);
  }
  return host;
};

function show(message, variant = 'default') {
  const host = ensureHost();
  const item = document.createElement('div');
  item.className = `toast toast-${variant}`;
  item.textContent = message;
  host.append(item);
  setTimeout(() => item.remove(), 4200);
}

export const toast = {
  info: (message) => show(message, 'default'),
  success: (message) => show(message, 'success'),
  error: (message) => show(message, 'error'),
};
