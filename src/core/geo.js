export function getCurrentPosition(options = {}) {
  if (!('geolocation' in navigator)) {
    return Promise.reject(new Error('GPS tidak tersedia di perangkat ini.'));
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
      }),
      () => reject(new Error('Gagal membaca lokasi. Aktifkan izin GPS.')),
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 30000,
        ...options,
      },
    );
  });
}

export function distanceInMeters(a, b) {
  if (!a?.lat || !a?.lng || !b?.lat || !b?.lng) return null;
  const earthRadius = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const value = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function geofenceStatus(point, center, radiusMeters = 120) {
  const distance = distanceInMeters(point, center);
  return {
    distance,
    inside: distance === null ? null : distance <= radiusMeters,
  };
}

function toRad(value) {
  return (Number(value) * Math.PI) / 180;
}
