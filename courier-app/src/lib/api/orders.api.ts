import type { Order } from './types';
import { api } from './client';

export async function fetchOrders(): Promise<Order[]> {
  const { data } = await api.get<Order[]>('/orders');
  return data;
}

export async function fetchOrder(orderId: string): Promise<Order> {
  const { data } = await api.get<Order>(`/orders/${orderId}`);
  return data;
}

export async function acceptOrder(orderId: string): Promise<Order> {
  const { data } = await api.post<Order>(`/orders/${orderId}/accept`);
  return data;
}

export async function declineOrderOffer(orderId: string): Promise<{ ok: boolean }> {
  const { data } = await api.post<{ ok: boolean }>(`/orders/${orderId}/decline`);
  return data;
}

export async function updateOrderStatus(
  orderId: string,
  status: string,
): Promise<Order> {
  const { data } = await api.patch<Order>(`/orders/${orderId}/status`, { status });
  return data;
}
