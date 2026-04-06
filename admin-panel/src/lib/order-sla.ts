import type { Order, OrderStatus } from "@/lib/api/types";

/** Dakika cinsinden sipariş yaşı */
export function orderAgeMinutes(o: Order): number {
  return (Date.now() - new Date(o.createdAt).getTime()) / 60000;
}

function slaThresholdMinutes(status: OrderStatus): number | null {
  switch (status) {
    case "PENDING":
      return 25;
    case "SEARCHING_COURIER":
      return 30;
    case "ACCEPTED":
    case "PICKED_UP":
    case "ON_DELIVERY":
      return 90;
    case "DELIVERED":
    case "CANCELLED":
      return null;
    default:
      return null;
  }
}

/** SLA aşımı (dakika); terminal veya zamanında ise 0 */
export function slaOverdueMinutes(o: Order): number {
  const th = slaThresholdMinutes(o.status);
  if (th == null) return 0;
  const age = orderAgeMinutes(o);
  return Math.max(0, age - th);
}

export function isOrderSlaBreached(o: Order): boolean {
  return slaOverdueMinutes(o) > 0;
}

/** Tablo SLA kolonu metni */
export function formatSlaCell(o: Order): string {
  if (o.status === "DELIVERED" || o.status === "CANCELLED") return "—";
  const th = slaThresholdMinutes(o.status);
  if (th == null) return "—";
  const over = slaOverdueMinutes(o);
  if (over > 0) return `+${Math.round(over)} dk`;
  const remain = th - orderAgeMinutes(o);
  if (remain <= 0) return "Sınırda";
  return `-${Math.floor(remain)} dk`;
}
