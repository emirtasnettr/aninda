import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import {
  CourierEarningStatus,
  OrderStatus,
  Prisma,
  Role,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  endOfIstanbulDay,
  startOfIstanbulDay,
} from '../couriers/courier-day-bounds.util';
import { haversineDistanceKm } from '../orders/utils/haversine';

@Injectable()
export class CourierEarningsService {
  constructor(private readonly prisma: PrismaService) {}

  list(status?: CourierEarningStatus) {
    return this.prisma.courierEarning.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        courier: { include: { user: { select: { email: true } } } },
        order: {
          select: { id: true, price: true, status: true, deliveredAt: true },
        },
      },
    });
  }

  async findOne(id: string, viewer?: { sub: string; role: Role }) {
    const e = await this.prisma.courierEarning.findUnique({
      where: { id },
      include: {
        courier: { include: { user: { select: { email: true, id: true } } } },
        order: true,
      },
    });
    if (!e) {
      throw new NotFoundException('Earning not found');
    }
    if (viewer) {
      const opsRoles: Role[] = [
        Role.ADMIN,
        Role.OPERATIONS_MANAGER,
        Role.OPERATIONS_SPECIALIST,
        Role.ACCOUNTING_SPECIALIST,
      ];
      const isOps = opsRoles.includes(viewer.role);
      const isOwner =
        viewer.role === Role.COURIER && e.courier.user.id === viewer.sub;
      if (!isOps && !isOwner) {
        throw new ForbiddenException('Access denied');
      }
    }
    return e;
  }

  async markPaid(ids: string[]) {
    const result = await this.prisma.courierEarning.updateMany({
      where: {
        id: { in: ids },
        status: CourierEarningStatus.PENDING,
      },
      data: { status: CourierEarningStatus.PAID },
    });
    return { updated: result.count };
  }

  async summaryForCourierUser(userId: string) {
    const courier = await this.prisma.courier.findUnique({
      where: { userId },
    });
    if (!courier) {
      throw new NotFoundException('Courier profile not found');
    }
    const dayStart = startOfIstanbulDay(new Date());
    const dayEnd = endOfIstanbulDay(new Date());
    const yesterdayStart = new Date(dayStart.getTime() - 24 * 60 * 60 * 1000);
    const minPayoutTry =
      process.env.PAYOUT_MIN_TRY?.trim() &&
      process.env.PAYOUT_MIN_TRY.trim() !== ''
        ? process.env.PAYOUT_MIN_TRY.trim()
        : '100';
    const [
      totalAgg,
      pendingAgg,
      paidAgg,
      requestedAgg,
      todayAgg,
      yesterdayAgg,
    ] = await Promise.all([
      this.prisma.courierEarning.aggregate({
        where: { courierId: courier.id },
        _sum: { amount: true },
      }),
      this.prisma.courierEarning.aggregate({
        where: {
          courierId: courier.id,
          status: CourierEarningStatus.PENDING,
        },
        _sum: { amount: true },
      }),
      this.prisma.courierEarning.aggregate({
        where: {
          courierId: courier.id,
          status: CourierEarningStatus.PAID,
        },
        _sum: { amount: true },
      }),
      this.prisma.courierEarning.aggregate({
        where: {
          courierId: courier.id,
          status: CourierEarningStatus.REQUESTED,
        },
        _sum: { amount: true },
      }),
      this.prisma.courierEarning.aggregate({
        where: {
          courierId: courier.id,
          createdAt: { gte: dayStart, lt: dayEnd },
        },
        _sum: { amount: true },
      }),
      this.prisma.courierEarning.aggregate({
        where: {
          courierId: courier.id,
          createdAt: { gte: yesterdayStart, lt: dayStart },
        },
        _sum: { amount: true },
      }),
    ]);
    return {
      totalEarningsTry: totalAgg._sum.amount?.toString() ?? '0',
      withdrawableTry: pendingAgg._sum.amount?.toString() ?? '0',
      requestedTry: requestedAgg._sum.amount?.toString() ?? '0',
      paidTry: paidAgg._sum.amount?.toString() ?? '0',
      todayEarningsTry: todayAgg._sum.amount?.toString() ?? '0',
      yesterdayEarningsTry: yesterdayAgg._sum.amount?.toString() ?? '0',
      minPayoutTry,
    };
  }

  async listForCourierUser(userId: string) {
    const courier = await this.prisma.courier.findUnique({
      where: { userId },
    });
    if (!courier) {
      throw new NotFoundException('Courier profile not found');
    }
    const rows = await this.prisma.courierEarning.findMany({
      where: { courierId: courier.id },
      orderBy: { createdAt: 'desc' },
      include: {
        order: {
          select: {
            id: true,
            price: true,
            status: true,
            deliveredAt: true,
            pickupLat: true,
            pickupLng: true,
            deliveryLat: true,
            deliveryLng: true,
          },
        },
      },
    });

    return rows.map((r) => {
      const o = r.order;
      const routeKm =
        Math.round(
          haversineDistanceKm(
            o.pickupLat,
            o.pickupLng,
            o.deliveryLat,
            o.deliveryLng,
          ) * 10,
        ) / 10;
      return {
        id: r.id,
        courierId: r.courierId,
        orderId: r.orderId,
        amount: r.amount.toString(),
        status: r.status,
        createdAt: r.createdAt,
        order: {
          id: o.id,
          price: o.price.toString(),
          status: o.status,
          deliveredAt: o.deliveredAt,
          routeKm,
        },
      };
    });
  }

  /**
   * ISO haftası (Pazartesi başlangıç) — weekStart = YYYY-MM-DD veya Date string
   */
  async weeklySummary(weekStart: string) {
    const start = new Date(weekStart);
    if (Number.isNaN(start.getTime())) {
      throw new NotFoundException('Invalid weekStart');
    }
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    const rows = await this.prisma.courierEarning.findMany({
      where: {
        createdAt: { gte: start, lt: end },
      },
      include: {
        courier: { include: { user: { select: { email: true } } } },
      },
    });

    const byCourier = new Map<
      string,
      {
        email: string;
        pending: number;
        requested: number;
        paid: number;
        total: number;
      }
    >();
    for (const r of rows) {
      const email = r.courier.user.email;
      const cur = byCourier.get(r.courierId) ?? {
        email,
        pending: 0,
        requested: 0,
        paid: 0,
        total: 0,
      };
      const amt = Number(r.amount);
      cur.total += amt;
      if (r.status === CourierEarningStatus.PENDING) {
        cur.pending += amt;
      } else if (r.status === CourierEarningStatus.REQUESTED) {
        cur.requested += amt;
      } else {
        cur.paid += amt;
      }
      byCourier.set(r.courierId, cur);
    }

    return {
      weekStart: start.toISOString(),
      weekEnd: end.toISOString(),
      couriers: [...byCourier.entries()].map(([courierId, v]) => ({
        courierId,
        ...v,
      })),
      grandTotal: rows.reduce((s, r) => s + Number(r.amount), 0),
    };
  }

  async createForDeliveredOrder(
    tx: Prisma.TransactionClient,
    orderId: string,
  ): Promise<void> {
    const existing = await tx.courierEarning.findUnique({
      where: { orderId },
    });
    if (existing) {
      return;
    }
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        courierId: true,
        price: true,
        status: true,
        courierEarningAmount: true,
      },
    });
    if (!order?.courierId || order.status !== OrderStatus.DELIVERED) {
      return;
    }
    const ratio = Number(process.env.COURIER_EARNING_RATIO ?? '0.72');
    const amount =
      order.courierEarningAmount != null
        ? order.courierEarningAmount
        : new Prisma.Decimal(
            Math.round(Number(order.price) * ratio * 100) / 100,
          );
    await tx.courierEarning.create({
      data: {
        courierId: order.courierId,
        orderId,
        amount,
        status: CourierEarningStatus.PENDING,
      },
    });
  }
}
