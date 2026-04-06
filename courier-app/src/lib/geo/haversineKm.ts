const R = 6371;

function toRad(d: number): number {
  return (d * Math.PI) / 180;
}

/** İki koordinat arası kuş uçuşu mesafe (km). */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Şehir içi rota için kaba tahmini süre (dakika). */
export function estRouteMinutes(km: number): number {
  return Math.max(8, Math.round(km * 2.4 + 6));
}
