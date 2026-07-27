export function validatePin(pin) {
  return /^\d{6}$/.test(String(pin || ''));
}

export function requireField(value, label) {
  if (value === undefined || value === null || String(value).trim() === '') {
    throw new Error(`${label} wajib diisi.`);
  }
}

export function requirePositiveNumber(value, label) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error(`${label} harus angka 0 atau lebih.`);
  }
  return numeric;
}
