import type { Order } from './api/types';

export const ACTIVE_DELIVERY_STATUSES = [
  'ACCEPTED',
  'PICKED_UP',
  'ON_DELIVERY',
] as const;

export function isActiveDeliveryStatus(status: string): boolean {
  return (ACTIVE_DELIVERY_STATUSES as readonly string[]).includes(status);
}

/** Kurye bu statülerden birinde atanmış sipariş taşıyorsa yeni iş alamaz */
export function isCourierBusyWithActiveOrders(
  orders: Pick<Order, 'courierId' | 'status'>[],
  courierId: string,
): boolean {
  return orders.some(
    (o) =>
      o.courierId === courierId && isActiveDeliveryStatus(o.status),
  );
}
