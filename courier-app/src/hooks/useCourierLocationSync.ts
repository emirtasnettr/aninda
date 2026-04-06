import * as Location from 'expo-location';
import { useEffect, useRef } from 'react';
import { patchCourierMe } from '../lib/api/couriers.api';
import { emitCourierLocation } from '../lib/socket/realtime';

type SyncOptions = {
  /** Teslimat haritası: daha sık güncelleme */
  aggressive?: boolean;
  onPosition?: (lat: number, lng: number) => void;
};

/**
 * Çevrimiçiyken periyodik konum gönderir: REST (PATCH /couriers/me) + Socket.io
 */
export function useCourierLocationSync(
  enabled: boolean,
  courierId: string | undefined,
  options?: SyncOptions,
) {
  const courierIdRef = useRef(courierId);
  courierIdRef.current = courierId;
  const onPositionRef = useRef(options?.onPosition);
  onPositionRef.current = options?.onPosition;
  const aggressive = options?.aggressive ?? false;

  useEffect(() => {
    if (!enabled || !courierId) {
      return;
    }

    let subscription: Location.LocationSubscription | undefined;

    const start = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== Location.PermissionStatus.GRANTED) {
        return;
      }

      subscription = await Location.watchPositionAsync(
        {
          accuracy: aggressive ? Location.Accuracy.High : Location.Accuracy.Balanced,
          distanceInterval: aggressive ? 12 : 30,
          timeInterval: aggressive ? 5000 : 12_000,
        },
        async (pos) => {
          const id = courierIdRef.current;
          if (!id) return;
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          onPositionRef.current?.(lat, lng);
          try {
            await patchCourierMe({ lat, lng });
          } catch {
            /* ağ hatası — sessiz */
          }
          emitCourierLocation(id, lat, lng);
        },
      );
    };

    void start();

    return () => {
      subscription?.remove();
    };
  }, [enabled, courierId, aggressive]);
}
