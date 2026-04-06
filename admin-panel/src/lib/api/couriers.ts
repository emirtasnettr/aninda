import { apiFetch } from "./client";
import type { Courier, CourierDetailResponse } from "./types";

export function fetchCouriers(): Promise<Courier[]> {
  return apiFetch<Courier[]>("/couriers");
}

export function fetchCourierDetail(id: string): Promise<CourierDetailResponse> {
  return apiFetch<CourierDetailResponse>(`/couriers/${id}`);
}

export function patchCourierOnline(
  id: string,
  body: { isOnline: boolean },
): Promise<Courier> {
  return apiFetch<Courier>(`/couriers/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
