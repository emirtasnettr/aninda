import type { Order } from './types';
import { api } from './client';

export interface CreateOrderBody {
  pickupLat: number;
  pickupLng: number;
  deliveryLat: number;
  deliveryLng: number;
  price: number;
  priority?: boolean;
}

export async function fetchOrders(): Promise<Order[]> {
  const { data } = await api.get<Order[]>('/orders');
  return data;
}

export async function fetchOrder(orderId: string): Promise<Order> {
  const { data } = await api.get<Order>(`/orders/${orderId}`);
  return data;
}

export async function createOrder(body: CreateOrderBody): Promise<Order> {
  const { data } = await api.post<Order>('/orders', body);
  return data;
}

export async function rateCourierForOrder(
  orderId: string,
  body: { rating: number; comment?: string },
): Promise<{ ok: boolean }> {
  const { data } = await api.post<{ ok: boolean }>(
    `/orders/${orderId}/rating`,
    body,
  );
  return data;
}
