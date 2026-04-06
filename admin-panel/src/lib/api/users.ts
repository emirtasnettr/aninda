import { apiFetch } from "./client";
import type { CreateStaffUserBody, StaffUser } from "./types";

export function fetchStaffUsers(): Promise<StaffUser[]> {
  return apiFetch<StaffUser[]>("/users");
}

export function createStaffUser(body: CreateStaffUserBody): Promise<StaffUser> {
  return apiFetch<StaffUser>("/users", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
