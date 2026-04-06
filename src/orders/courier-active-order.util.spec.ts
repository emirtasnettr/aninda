import { OrderStatus } from '@prisma/client';
import {
  courierHasActiveOrder,
  loadBusyCourierIdsAmong,
} from './courier-active-order.util';

describe('courierHasActiveOrder', () => {
  it('true when count > 0', async () => {
    const db = {
      order: { count: jest.fn().mockResolvedValue(1) },
    };
    await expect(courierHasActiveOrder(db as never, 'c1')).resolves.toBe(true);
    expect(db.order.count).toHaveBeenCalledWith({
      where: {
        courierId: 'c1',
        status: {
          in: [
            OrderStatus.ACCEPTED,
            OrderStatus.PICKED_UP,
            OrderStatus.ON_DELIVERY,
          ],
        },
      },
    });
  });

  it('false when count is 0', async () => {
    const db = { order: { count: jest.fn().mockResolvedValue(0) } };
    await expect(courierHasActiveOrder(db as never, 'c1')).resolves.toBe(false);
  });

  it('excludes order id when provided', async () => {
    const db = { order: { count: jest.fn().mockResolvedValue(0) } };
    await courierHasActiveOrder(db as never, 'c1', 'ord-x');
    expect(db.order.count).toHaveBeenCalledWith({
      where: {
        courierId: 'c1',
        status: {
          in: [
            OrderStatus.ACCEPTED,
            OrderStatus.PICKED_UP,
            OrderStatus.ON_DELIVERY,
          ],
        },
        id: { not: 'ord-x' },
      },
    });
  });
});

describe('loadBusyCourierIdsAmong', () => {
  it('returns empty set for empty ids', async () => {
    const db = { order: { findMany: jest.fn() } };
    await expect(loadBusyCourierIdsAmong(db as never, [])).resolves.toEqual(
      new Set(),
    );
    expect(db.order.findMany).not.toHaveBeenCalled();
  });

  it('collects distinct courier ids with active orders', async () => {
    const db = {
      order: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ courierId: 'a' }, { courierId: 'b' }]),
      },
    };
    const s = await loadBusyCourierIdsAmong(db as never, ['a', 'b', 'c']);
    expect(s).toEqual(new Set(['a', 'b']));
  });
});
