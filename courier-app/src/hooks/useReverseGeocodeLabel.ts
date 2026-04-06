import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

const cache = new Map<string, string>();

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

function formatPlacemark(
  r: Location.LocationGeocodedAddress | undefined,
): string {
  if (!r) return '';
  const street =
    r.street && r.streetNumber
      ? `${r.street} ${r.streetNumber}`
      : r.street || r.name;
  const area = [r.district, r.subregion, r.city, r.region].filter(Boolean);
  if (street) return [street, area[0]].filter(Boolean).join(' · ');
  return area.slice(0, 2).join(' · ') || 'Konum';
}

/**
 * Kısa adres satırı; sonuçlar koordinat başına önbelleğe alınır.
 */
export function useReverseGeocodeLabel(lat: number, lng: number): string {
  const key = cacheKey(lat, lng);
  const [text, setText] = useState(() => cache.get(key) ?? '');

  useEffect(() => {
    const hit = cache.get(key);
    if (hit) {
      setText(hit);
      return;
    }
    let alive = true;
    setText('…');
    void (async () => {
      try {
        const rows = await Location.reverseGeocodeAsync({
          latitude: lat,
          longitude: lng,
        });
        const line = formatPlacemark(rows[0]) || `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
        if (!alive) return;
        cache.set(key, line);
        setText(line);
      } catch {
        const fb = `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
        if (!alive) return;
        cache.set(key, fb);
        setText(fb);
      }
    })();
    return () => {
      alive = false;
    };
  }, [key, lat, lng]);

  return text;
}
