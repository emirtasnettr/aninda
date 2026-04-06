import type { CustomerTransaction } from "@/lib/api/erp-types";
import type { Order } from "@/lib/api/types";

export type OrderStats = {
  count: number;
  lastOrderAt: string | null;
  /** Teslim edilen siparişlerin tutar toplamı */
  revenueDelivered: number;
};

/** Siparişler `customerId` = User.id; CRM `Customer.userId` ile eşleşir */
export function orderStatsByUserId(
  orders: Order[],
  userIds: string[],
): Map<string, OrderStats> {
  const map = new Map<string, OrderStats>();
  for (const id of userIds) {
    map.set(id, { count: 0, lastOrderAt: null, revenueDelivered: 0 });
  }
  for (const o of orders) {
    const s = map.get(o.customerId);
    if (!s) continue;
    s.count += 1;
    const t = o.createdAt;
    if (
      !s.lastOrderAt ||
      new Date(t).getTime() > new Date(s.lastOrderAt).getTime()
    ) {
      s.lastOrderAt = t;
    }
    if (o.status === "DELIVERED") {
      s.revenueDelivered += Number(o.price);
    }
  }
  return map;
}

/** customerId (CRM kart id) → en son işlem */
export function lastTransactionByCustomerId(
  transactions: CustomerTransaction[],
): Map<string, CustomerTransaction> {
  const map = new Map<string, CustomerTransaction>();
  const sorted = [...transactions].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  for (const tx of sorted) {
    if (!map.has(tx.customerId)) {
      map.set(tx.customerId, tx);
    }
  }
  return map;
}

export function parseBalance(balance: string | undefined): number {
  if (balance == null || balance === "") return 0;
  const n = Number(balance);
  return Number.isFinite(n) ? n : 0;
}

/** Pozitif: müşteri borçlu (bizim alacağımız). Negatif: müşteri lehine bakiye. */
export function balanceTone(balance: number): {
  label: string;
  className: string;
} {
  if (balance > 0.009) {
    return {
      label: "Borç",
      className: "text-amber-700 dark:text-amber-400",
    };
  }
  if (balance < -0.009) {
    return {
      label: "Alacak (ön ödeme)",
      className: "text-sky-700 dark:text-sky-400",
    };
  }
  return {
    label: "Kapalı",
    className: "text-emerald-700 dark:text-emerald-400",
  };
}
