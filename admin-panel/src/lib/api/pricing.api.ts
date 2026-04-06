import { apiFetch } from "./client";
import type { PricingRule } from "./erp-types";

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

export function fetchMyPricingQuote(params: {
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
    sp.set("priority", "true");
  }
  return apiFetch<PricingQuote>(`/pricing/me-quote?${sp.toString()}`);
}

export function fetchPricingRules(): Promise<PricingRule[]> {
  return apiFetch<PricingRule[]>("/pricing/rules");
}

export function createPricingRule(body: {
  customerId?: string;
  basePrice: number;
  perKmPrice: number;
  minPrice?: number;
  priorityMultiplier?: number;
  nightMultiplier?: number;
  courierSharePercent?: number;
}): Promise<PricingRule> {
  return apiFetch<PricingRule>("/pricing/rules", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updatePricingRule(
  id: string,
  body: {
    basePrice?: number;
    perKmPrice?: number;
    minPrice?: number;
    priorityMultiplier?: number;
    nightMultiplier?: number;
    courierSharePercent?: number | null;
  },
): Promise<PricingRule> {
  return apiFetch<PricingRule>(`/pricing/rules/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deletePricingRule(id: string): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/pricing/rules/${id}`, {
    method: "DELETE",
  });
}
