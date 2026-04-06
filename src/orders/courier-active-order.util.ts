import { OrderStatus, Prisma } from '@prisma/client';

/** assigned / picked_up / on_the_way — tek seferde yalnızca biri taşınabilir */
export const COURIER_ACTIVE_ORDER_STATUSES: readonly OrderStatus[] = [
  OrderStatus.ACCEPTED,
  OrderStatus.PICKED_UP,
  OrderStatus.ON_DELIVERY,
] as const;

type OrderDb = Pick<Prisma.TransactionClient, 'order'>;

export async function courierHasActiveOrder(
  db: OrderDb,
  courierId: string,
  excludeOrderId?: string,
): Promise<boolean> {
  const n = await db.order.count({
    where: {
      courierId,
      status: { in: [...COURIER_ACTIVE_ORDER_STATUSES] },
      ...(excludeOrderId ? { id: { not: excludeOrderId } } : {}),
    },
  });
  return n > 0;
}

export async function loadBusyCourierIdsAmong(
  db: OrderDb,
  courierIds: string[],
): Promise<Set<string>> {
  if (courierIds.length === 0) {
    return new Set();
  }
  const rows = await db.order.findMany({
    where: {
      courierId: { in: courierIds },
      status: { in: [...COURIER_ACTIVE_ORDER_STATUSES] },
    },
    select: { courierId: true },
  });
  return new Set(
    rows.map((r) => r.courierId).filter((id): id is string => id != null),
  );
}
