/** Europe/Istanbul saatine göre gece penceresi (varsayılan 22:00–06:00). */
export function isNightEuropeIstanbul(at: Date): boolean {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Istanbul',
      hour: 'numeric',
      hour12: false,
    })
      .formatToParts(at)
      .find((p) => p.type === 'hour')?.value,
  );
  if (!Number.isFinite(hour)) {
    return false;
  }
  const start = Number(process.env.PRICING_NIGHT_START_HOUR ?? '22');
  const end = Number(process.env.PRICING_NIGHT_END_HOUR ?? '6');
  if (start === end) {
    return false;
  }
  if (start > end) {
    return hour >= start || hour < end;
  }
  return hour >= start && hour < end;
}

export type PriceComputationBreakdown = {
  subtotalBeforeMin: number;
  afterMin: number;
  total: number;
  nightApplied: boolean;
  priorityApplied: boolean;
};

/**
 * total = max(base + km*perKm, min) × (gece ? nightM : 1) × (öncelik ? priorityM : 1)
 */
export function computeDeliveryTotal(params: {
  basePrice: number;
  perKmPrice: number;
  minPrice: number;
  nightMultiplier: number;
  priorityMultiplier: number;
  km: number;
  isNight: boolean;
  isPriority: boolean;
}): PriceComputationBreakdown {
  const {
    basePrice,
    perKmPrice,
    minPrice,
    nightMultiplier,
    priorityMultiplier,
    km,
    isNight,
    isPriority,
  } = params;

  let subtotal = basePrice + km * perKmPrice;
  subtotal = Math.round(subtotal * 100) / 100;

  let afterMin = Math.max(subtotal, minPrice);
  afterMin = Math.round(afterMin * 100) / 100;

  let total = afterMin;
  let nightApplied = false;
  let priorityApplied = false;

  if (isNight && nightMultiplier !== 1) {
    total = Math.round(total * nightMultiplier * 100) / 100;
    nightApplied = true;
  }
  if (isPriority && priorityMultiplier !== 1) {
    total = Math.round(total * priorityMultiplier * 100) / 100;
    priorityApplied = true;
  }

  return {
    subtotalBeforeMin: subtotal,
    afterMin,
    total,
    nightApplied,
    priorityApplied,
  };
}

/** Kurye payı (0–1) ile kazanç ve platform komisyonu; yuvarlama TRY iki hane. */
export function splitCourierAndPlatform(
  totalPrice: number,
  courierSharePercent: number,
): { courierEarningAmount: number; platformCommissionAmount: number } {
  const clamped = Math.min(1, Math.max(0, courierSharePercent));
  const courierEarningAmount = Math.round(totalPrice * clamped * 100) / 100;
  const platformCommissionAmount =
    Math.round((totalPrice - courierEarningAmount) * 100) / 100;
  return { courierEarningAmount, platformCommissionAmount };
}
