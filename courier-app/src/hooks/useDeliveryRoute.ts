import { useCallback, useEffect, useState } from 'react';
import {
  fetchOsrmDrivingRoute,
  type LatLng,
  straightLineRoute,
} from '../lib/routing/osrmRoute';

type RouteState = {
  coordinates: LatLng[];
  distanceMeters: number;
  durationSeconds: number;
  loading: boolean;
};

const initial: RouteState = {
  coordinates: [],
  distanceMeters: 0,
  durationSeconds: 0,
  loading: true,
};

/**
 * Araç rotası + mesafe/süre; origin veya hedef değişince ve periyodik yenilenir.
 */
export function useDeliveryRoute(
  origin: LatLng | null,
  destination: LatLng | null,
  refreshMs = 45_000,
): RouteState {
  const [state, setState] = useState<RouteState>(initial);

  const load = useCallback(async () => {
    if (!origin || !destination) {
      setState({ ...initial, loading: false, coordinates: [] });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    try {
      const r = await fetchOsrmDrivingRoute(origin, destination);
      setState({
        coordinates: r.coordinates,
        distanceMeters: r.distanceMeters,
        durationSeconds: r.durationSeconds,
        loading: false,
      });
    } catch {
      const coords = straightLineRoute(origin, destination);
      const d =
        Math.hypot(
          (destination.latitude - origin.latitude) * 111_000,
          (destination.longitude - origin.longitude) *
            111_000 *
            Math.cos((origin.latitude * Math.PI) / 180),
        ) || 1;
      setState({
        coordinates: coords,
        distanceMeters: d,
        durationSeconds: Math.max(120, (d / 1000 / 22) * 3600),
        loading: false,
      });
    }
  }, [origin, destination]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!origin || !destination) return;
    const id = setInterval(() => void load(), refreshMs);
    return () => clearInterval(id);
  }, [origin, destination, load, refreshMs]);

  return state;
}
