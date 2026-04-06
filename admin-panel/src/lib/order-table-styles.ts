import type { OrderStatus } from "@/lib/api/types";

/** Operasyon tablosu / drawer durum rozetleri */
export function orderOpsBadgeClass(status: OrderStatus): string {
  switch (status) {
    case "PENDING":
      return "border-zinc-300 bg-zinc-100 text-zinc-800 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100";
    case "SEARCHING_COURIER":
      return "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100";
    case "ACCEPTED":
    case "PICKED_UP":
    case "ON_DELIVERY":
      return "border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-100";
    case "DELIVERED":
      return "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100";
    case "CANCELLED":
      return "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-100";
    default:
      return "border-border bg-muted text-foreground";
  }
}
