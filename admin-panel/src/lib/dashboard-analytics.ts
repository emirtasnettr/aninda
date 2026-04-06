import type { Order, OrderStatus } from "@/lib/api/types";

const MIN_MS = 60_000;

export const DASHBOARD_SLA = {
  /** Aktif hat (kabul/alındı/yolda) bu süreyi aştıysa “gecikmiş” */
  activeLateMs: 90 * MIN_MS,
  /** Kurye aranıyor — panel + acil */
  searchingStuckMs: 30 * MIN_MS,
  /** Beklemede — iptal riski */
  pendingRiskMs: 25 * MIN_MS,
} as const;

const ACTIVE: OrderStatus[] = ["ACCEPTED", "PICKED_UP", "ON_DELIVERY"];
const AWAITING: OrderStatus[] = ["PENDING", "SEARCHING_COURIER"];

export function orderAgeMs(o: Order): number {
  return Date.now() - new Date(o.createdAt).getTime();
}

export function isActiveDelivery(o: Order): boolean {
  return ACTIVE.includes(o.status);
}

export function isAwaitingCourier(o: Order): boolean {
  return AWAITING.includes(o.status);
}

/** Hero: gecikmiş sayısı */
export function countDelayedOrders(orders: Order[]): number {
  return orders.filter(
    (o) => isActiveDelivery(o) && orderAgeMs(o) > DASHBOARD_SLA.activeLateMs,
  ).length;
}

export function listDelayedOrders(orders: Order[]): Order[] {
  return orders.filter(
    (o) => isActiveDelivery(o) && orderAgeMs(o) > DASHBOARD_SLA.activeLateMs,
  );
}

/** Kurye atanmamış / aranıyor */
export function countAwaitingCourier(orders: Order[]): number {
  return orders.filter((o) => isAwaitingCourier(o)).length;
}

export function countActiveDeliveries(orders: Order[]): number {
  return orders.filter((o) => isActiveDelivery(o)).length;
}

export function listSearchingStuck(orders: Order[]): Order[] {
  return orders.filter(
    (o) =>
      o.status === "SEARCHING_COURIER" &&
      orderAgeMs(o) > DASHBOARD_SLA.searchingStuckMs,
  );
}

export function listCancelRisk(orders: Order[]): Order[] {
  return orders.filter(
    (o) =>
      o.status === "PENDING" &&
      orderAgeMs(o) > DASHBOARD_SLA.pendingRiskMs,
  );
}

export type TrendPoint = { day: string; label: string; orders: number };

export function ordersTrendByDay(orders: Order[], days: number): TrendPoint[] {
  const points: TrendPoint[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    const key = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("tr-TR", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
    const count = orders.filter((o) => {
      const t = new Date(o.createdAt).getTime();
      return t >= d.getTime() && t < next.getTime();
    }).length;
    points.push({ day: key, label, orders: count });
  }
  return points;
}

export type RevenuePoint = { day: string; label: string; revenue: number };

/** Teslim edilen siparişlerin tutarı (teslim/oluşturma gününe göre) */
export function revenueByDay(orders: Order[], days: number): RevenuePoint[] {
  const points: RevenuePoint[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    const key = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("tr-TR", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
    let revenue = 0;
    for (const o of orders) {
      if (o.status !== "DELIVERED") continue;
      const ref = o.deliveredAt ?? o.createdAt;
      const t = new Date(ref).getTime();
      if (t >= d.getTime() && t < next.getTime()) {
        revenue += Number(o.price);
      }
    }
    points.push({ day: key, label, revenue: Math.round(revenue * 100) / 100 });
  }
  return points;
}

export function todayRevenueTry(orders: Order[]): number {
  const t0 = new Date();
  t0.setHours(0, 0, 0, 0);
  const t1 = new Date(t0);
  t1.setDate(t1.getDate() + 1);
  let sum = 0;
  for (const o of orders) {
    if (o.status !== "DELIVERED") continue;
    const ref = o.deliveredAt ?? o.createdAt;
    const t = new Date(ref).getTime();
    if (t >= t0.getTime() && t < t1.getTime()) {
      sum += Number(o.price);
    }
  }
  return Math.round(sum * 100) / 100;
}

export function todayOrderCount(orders: Order[]): number {
  const t0 = new Date();
  t0.setHours(0, 0, 0, 0);
  const t1 = new Date(t0);
  t1.setDate(t1.getDate() + 1);
  return orders.filter((o) => {
    const t = new Date(o.createdAt).getTime();
    return t >= t0.getTime() && t < t1.getTime();
  }).length;
}
