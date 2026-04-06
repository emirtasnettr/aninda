import { haversineKm } from "./haversine";

function numEnv(key: string, fallback: number): number {
  const v = process.env[key];
  if (v === undefined || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Müşteri uygulamasıyla aynı mantık (sabit ücret + km başına).
 * `.env.local`: NEXT_PUBLIC_BASE_FEE, NEXT_PUBLIC_PRICE_PER_KM
 */
export function calculateDeliveryPrice(
  pickupLat: number,
  pickupLng: number,
  deliveryLat: number,
  deliveryLng: number,
): { km: number; total: number } {
  const km = haversineKm(pickupLat, pickupLng, deliveryLat, deliveryLng);
  const base = numEnv("NEXT_PUBLIC_BASE_FEE", 35);
  const perKm = numEnv("NEXT_PUBLIC_PRICE_PER_KM", 12);
  const raw = base + km * perKm;
  const total = Math.round(raw * 100) / 100;
  return { km: Math.round(km * 100) / 100, total };
}
