import { api } from './client';

export type PricingQuote = {
  km: number;
  total: number;
  basePrice: number;
  perKmPrice: number;
  minPrice: number;
  ruleId: string | null;
  subtotalBeforeMin: number;
  afterMin: number;
  nightApplied: boolean;
  priorityApplied: boolean;
  nightMultiplier: number;
  priorityMultiplier: number;
  isNight: boolean;
  isPriority: boolean;
  courierSharePercent: number;
  courierEarningAmount: number;
  platformCommissionAmount: number;
};

export async function fetchMyPricingQuote(params: {
  pickupLat: number;
  pickupLng: number;
  deliveryLat: number;
  deliveryLng: number;
  priority?: boolean;
}): Promise<PricingQuote> {
  const sp = new URLSearchParams({
    pickupLat: String(params.pickupLat),
    pickupLng: String(params.pickupLng),
    deliveryLat: String(params.deliveryLat),
    deliveryLng: String(params.deliveryLng),
  });
  if (params.priority) {
    sp.set('priority', 'true');
  }
  const { data } = await api.get<PricingQuote>(`/pricing/me-quote?${sp.toString()}`);
  return data;
}
