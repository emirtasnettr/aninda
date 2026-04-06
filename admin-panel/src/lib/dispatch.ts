import type { Courier, Order } from "@/lib/api/types";
import { haversineKm } from "@/lib/pricing/haversine";

/** Sipariş güzergâh uzunluğu (alış → teslim, kuş uçuşu) */
export function orderRouteKm(o: Order): number {
  return haversineKm(
    o.pickupLat,
    o.pickupLng,
    o.deliveryLat,
    o.deliveryLng,
  );
}

/** Kurye → sipariş alış noktası */
export function courierToPickupKm(c: Courier, o: Order): number | null {
  if (c.lat == null || c.lng == null) return null;
  return haversineKm(c.lat, c.lng, o.pickupLat, o.pickupLng);
}

/**
 * Ortalama şehir içi hız (km/s) — ETA tahmini için.
 * Trafik / bekleme dahil kabaca düzeltme.
 */
const DEFAULT_AVG_KMH = 26;

export function etaPickupMinutes(
  courierKm: number,
  avgKmh: number = DEFAULT_AVG_KMH,
): number {
  if (courierKm <= 0 || !Number.isFinite(courierKm)) return 0;
  return Math.max(1, Math.round((courierKm / avgKmh) * 60));
}

export function formatKm(km: number): string {
  if (!Number.isFinite(km)) return "—";
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

export function formatEtaMinutes(mins: number): string {
  if (mins <= 0) return "~0 dk";
  if (mins < 60) return `~${mins} dk`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `~${h} s ${m} dk` : `~${h} s`;
}

export function customerDisplayName(o: Order): string {
  const e = o.customer?.email;
  if (!e) return "Müşteri";
  const local = e.split("@")[0];
  return local && local.length > 0 ? local : e;
}

/** Çevrimiçi ve konumu olan kuryeler arasından alışa en yakın */
export function findRecommendedCourier(
  order: Order,
  couriers: Courier[],
): { courier: Courier; km: number; etaMins: number } | null {
  const candidates = couriers.filter(
    (c) => c.isOnline && c.lat != null && c.lng != null,
  );
  let best: { courier: Courier; km: number } | null = null;
  for (const c of candidates) {
    const km = courierToPickupKm(c, order);
    if (km == null) continue;
    if (!best || km < best.km) best = { courier: c, km };
  }
  if (!best) return null;
  return {
    courier: best.courier,
    km: best.km,
    etaMins: etaPickupMinutes(best.km),
  };
}

export function sortCouriersForDispatch(
  order: Order | null,
  couriers: Courier[],
): Courier[] {
  if (!order) {
    return [...couriers].sort((a, b) => {
      if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
      return a.user.email.localeCompare(b.user.email);
    });
  }
  return [...couriers].sort((a, b) => {
    const da = courierToPickupKm(a, order);
    const db = courierToPickupKm(b, order);
    if (da == null && db == null) {
      if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
      return a.user.email.localeCompare(b.user.email);
    }
    if (da == null) return 1;
    if (db == null) return -1;
    if (Math.abs(da - db) < 0.01) {
      if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
      return a.user.email.localeCompare(b.user.email);
    }
    return da - db;
  });
}
