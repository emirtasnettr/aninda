import { apiFetch } from "./client";
import type { PayoutRequestRow, PayoutRequestStatus } from "./erp-types";

export function fetchPayoutRequests(
  status?: PayoutRequestStatus,
): Promise<PayoutRequestRow[]> {
  const q = status ? `?status=${status}` : "";
  return apiFetch<PayoutRequestRow[]>(`/payout-requests${q}`);
}

export function fetchPayoutRequest(id: string): Promise<PayoutRequestRow> {
  return apiFetch<PayoutRequestRow>(`/payout-requests/${id}`);
}

export function approvePayoutRequest(id: string): Promise<PayoutRequestRow> {
  return apiFetch<PayoutRequestRow>(`/payout-requests/${id}/approve`, {
    method: "PATCH",
    body: JSON.stringify({}),
  });
}

export function rejectPayoutRequest(id: string): Promise<PayoutRequestRow> {
  return apiFetch<PayoutRequestRow>(`/payout-requests/${id}/reject`, {
    method: "PATCH",
    body: JSON.stringify({}),
  });
}

export function markPayoutPaid(
  id: string,
  receiptUrl?: string,
): Promise<PayoutRequestRow> {
  return apiFetch<PayoutRequestRow>(`/payout-requests/${id}/mark-paid`, {
    method: "PATCH",
    body: JSON.stringify(
      receiptUrl?.trim() ? { receiptUrl: receiptUrl.trim() } : {},
    ),
  });
}
