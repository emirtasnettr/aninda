import { apiFetch } from "./client";
import type { Customer } from "./erp-types";
import type { Order } from "./types";

export function fetchCustomers(): Promise<Customer[]> {
  return apiFetch<Customer[]>("/customers");
}

export function fetchCustomer(id: string): Promise<Customer> {
  return apiFetch<Customer>(`/customers/${id}`);
}

export function updateCustomer(
  id: string,
  body: Partial<{
    name: string;
    type: string;
    phone: string;
    email: string;
    address: string;
    taxNumber: string;
  }>,
): Promise<Customer> {
  return apiFetch<Customer>(`/customers/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function patchCustomerCreditSettings(
  id: string,
  body: { creditEnabled: boolean; creditLimit?: number },
): Promise<Customer> {
  return apiFetch<Customer>(`/customers/${id}/credit-settings`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function fetchCustomerOrders(id: string): Promise<Order[]> {
  return apiFetch<Order[]>(`/customers/${id}/orders`);
}
