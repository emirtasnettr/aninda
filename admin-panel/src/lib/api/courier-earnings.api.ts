import { apiFetch } from "./client";
import type { CourierEarning, CourierEarningStatus } from "./erp-types";

export function fetchCourierEarnings(
  status?: CourierEarningStatus,
): Promise<CourierEarning[]> {
  const q = status ? `?status=${status}` : "";
  return apiFetch<CourierEarning[]>(`/courier-earnings${q}`);
}

export function fetchCourierEarning(id: string): Promise<CourierEarning> {
  return apiFetch<CourierEarning>(`/courier-earnings/${id}`);
}

export function fetchWeeklySummary(weekStart: string): Promise<{
  weekStart: string;
  weekEnd: string;
  couriers: {
    courierId: string;
    email: string;
    pending: number;
    requested: number;
    paid: number;
    total: number;
  }[];
  grandTotal: number;
}> {
  return apiFetch(
    `/courier-earnings/weekly-summary?weekStart=${encodeURIComponent(weekStart)}`,
  );
}

export function markEarningsPaid(ids: string[]): Promise<{ updated: number }> {
  return apiFetch<{ updated: number }>("/courier-earnings/mark-paid", {
    method: "PATCH",
    body: JSON.stringify({ ids }),
  });
}
