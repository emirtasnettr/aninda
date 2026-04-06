export type LatLng = { latitude: number; longitude: number };

export type OsrmRouteResult = {
  coordinates: LatLng[];
  distanceMeters: number;
  durationSeconds: number;
};

/** Kuş uçuşu yedek rota (OSRM başarısız olursa). */
export function straightLineRoute(from: LatLng, to: LatLng): LatLng[] {
  return [from, to];
}

/**
 * OSRM public demo sunucusu — üretimde kendi sunucunuz veya Google Directions önerilir.
 */
export async function fetchOsrmDrivingRoute(
  from: LatLng,
  to: LatLng,
): Promise<OsrmRouteResult> {
  const url = `https://router.project-osrm.org/route/v1/driving/${from.longitude},${from.latitude};${to.longitude},${to.latitude}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) {
    const coords = straightLineRoute(from, to);
    const d = haversineMeters(from, to);
    return {
      coordinates: coords,
      distanceMeters: d,
      durationSeconds: Math.max(120, (d / 1000 / 25) * 3600),
    };
  }
  const json = (await res.json()) as {
    routes?: Array<{
      distance?: number;
      duration?: number;
      geometry?: { coordinates?: [number, number][] };
    }>;
  };
  const route = json.routes?.[0];
  const raw = route?.geometry?.coordinates;
  const coords: LatLng[] =
    raw && raw.length > 0
      ? raw.map(([lng, lat]) => ({ latitude: lat, longitude: lng }))
      : straightLineRoute(from, to);
  const distanceMeters = route?.distance ?? haversineMeters(from, to);
  const durationSeconds =
    route?.duration ?? Math.max(60, (distanceMeters / 1000 / 22) * 3600);
  return { coordinates: coords, distanceMeters, durationSeconds };
}

function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
