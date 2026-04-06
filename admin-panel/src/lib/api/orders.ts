import { apiFetch } from "./client";
import type { Order, OrderStatus } from "./types";

export type CreateOrderBody = {
  pickupLat: number;
  pickupLng: number;
  deliveryLat: number;
  deliveryLng: number;
  price: number;
  priority?: boolean;
};

export function createOrder(body: CreateOrderBody): Promise<Order> {
  return apiFetch<Order>("/orders", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function fetchOrders(): Promise<Order[]> {
  return apiFetch<Order[]>("/orders");
}

export function fetchOrder(id: string): Promise<Order> {
  return apiFetch<Order>(`/orders/${id}`);
}

export function assignOrder(
  orderId: string,
  courierId: string,
): Promise<Order> {
  return apiFetch<Order>(`/orders/${orderId}/assign`, {
    method: "PATCH",
    body: JSON.stringify({ courierId }),
  });
}

export function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
): Promise<Order> {
  return apiFetch<Order>(`/orders/${orderId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}
