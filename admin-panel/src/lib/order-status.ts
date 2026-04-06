import type { OrderStatus } from "@/lib/api/types";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Beklemede",
  SEARCHING_COURIER: "Kurye aranıyor",
  ACCEPTED: "Kabul edildi",
  PICKED_UP: "Alındı",
  ON_DELIVERY: "Yolda",
  DELIVERED: "Teslim edildi",
  CANCELLED: "İptal",
};

export function orderStatusLabel(status: string): string {
  return ORDER_STATUS_LABELS[status as OrderStatus] ?? status;
}
