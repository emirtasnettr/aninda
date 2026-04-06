import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  computeDispatchScore,
  type DispatchScoreInput,
} from './dispatch-score.util';

@Injectable()
export class CourierPerformanceService {
  constructor(private readonly prisma: PrismaService) {}

  async refreshDispatchScore(
    tx: Prisma.TransactionClient,
    courierId: string,
  ): Promise<void> {
    const courier = await tx.courier.findUnique({
      where: { id: courierId },
      include: { performance: true },
    });
    if (!courier) {
      return;
    }
    const input: DispatchScoreInput = {
      averageRating: courier.averageRating,
      totalRatings: courier.totalRatings,
      successfulDeliveries: courier.performance?.successfulDeliveries ?? 0,
      cancelledDeliveries: courier.performance?.cancelledDeliveries ?? 0,
      averageDeliveryTimeMinutes:
        courier.performance?.averageDeliveryTimeMinutes ?? null,
      lastActiveAt: courier.performance?.lastActiveAt ?? null,
    };
    const score = computeDispatchScore(input);
    await tx.courier.update({
      where: { id: courierId },
      data: { dispatchScore: new Prisma.Decimal(score) },
    });
  }

  async onOrderDelivered(
    tx: Prisma.TransactionClient,
    order: {
      id: string;
      courierId: string | null;
      createdAt: Date;
      deliveredAt: Date | null;
    },
  ): Promise<void> {
    if (!order.courierId || !order.deliveredAt) {
      return;
    }
    const minutes =
      (order.deliveredAt.getTime() - order.createdAt.getTime()) / 60_000;
    const safeMins =
      Number.isFinite(minutes) && minutes >= 0 && minutes < 72 * 60
        ? minutes
        : null;

    const before = await tx.courierPerformance.findUnique({
      where: { courierId: order.courierId },
    });

    if (!before) {
      await tx.courierPerformance.create({
        data: {
          courierId: order.courierId,
          totalDeliveries: 1,
          successfulDeliveries: 1,
          cancelledDeliveries: 0,
          averageDeliveryTimeMinutes:
            safeMins != null ? new Prisma.Decimal(safeMins) : null,
        },
      });
    } else {
      const n = before.successfulDeliveries + 1;
      let newAvgDec: Prisma.Decimal | undefined;
      if (safeMins != null) {
        const prevAvg = before.averageDeliveryTimeMinutes
          ? Number(before.averageDeliveryTimeMinutes)
          : null;
        const newAvg =
          prevAvg == null
            ? safeMins
            : (prevAvg * before.successfulDeliveries + safeMins) / n;
        newAvgDec = new Prisma.Decimal(newAvg);
      }
      await tx.courierPerformance.update({
        where: { courierId: order.courierId },
        data: {
          totalDeliveries: { increment: 1 },
          successfulDeliveries: { increment: 1 },
          ...(newAvgDec != null
            ? { averageDeliveryTimeMinutes: newAvgDec }
            : {}),
        },
      });
    }

    await this.refreshDispatchScore(tx, order.courierId);
  }

  async onAssignedOrderCancelled(
    tx: Prisma.TransactionClient,
    courierId: string,
  ): Promise<void> {
    const before = await tx.courierPerformance.findUnique({
      where: { courierId },
    });
    if (!before) {
      await tx.courierPerformance.create({
        data: {
          courierId,
          totalDeliveries: 1,
          successfulDeliveries: 0,
          cancelledDeliveries: 1,
        },
      });
    } else {
      await tx.courierPerformance.update({
        where: { courierId },
        data: {
          totalDeliveries: { increment: 1 },
          cancelledDeliveries: { increment: 1 },
        },
      });
    }
    await this.refreshDispatchScore(tx, courierId);
  }

  async touchLastActive(courierId: string): Promise<void> {
    const now = new Date();
    await this.prisma.courierPerformance.upsert({
      where: { courierId },
      create: {
        courierId,
        lastActiveAt: now,
      },
      update: { lastActiveAt: now },
    });
    await this.refreshDispatchScore(this.prisma, courierId);
  }

  async applyRating(
    tx: Prisma.TransactionClient,
    input: {
      courierId: string;
      orderId: string;
      customerId: string;
      rating: number;
      comment?: string;
    },
  ): Promise<void> {
    const courier = await tx.courier.findUnique({
      where: { id: input.courierId },
    });
    if (!courier) {
      return;
    }
    const prevN = courier.totalRatings;
    const prevAvg =
      courier.averageRating != null ? Number(courier.averageRating) : null;
    const newN = prevN + 1;
    const newAvg =
      prevAvg == null || prevN === 0
        ? input.rating
        : (prevAvg * prevN + input.rating) / newN;

    await tx.courierRating.create({
      data: {
        courierId: input.courierId,
        orderId: input.orderId,
        customerId: input.customerId,
        rating: input.rating,
        comment: input.comment?.trim() || null,
      },
    });

    await tx.courier.update({
      where: { id: input.courierId },
      data: {
        totalRatings: newN,
        averageRating: new Prisma.Decimal(Math.round(newAvg * 100) / 100),
      },
    });

    await this.refreshDispatchScore(tx, input.courierId);
  }

  async backfillPerformanceFromOrders(courierId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const delivered = await tx.order.findMany({
        where: {
          courierId,
          status: 'DELIVERED',
          deliveredAt: { not: null },
        },
        select: { createdAt: true, deliveredAt: true },
      });
      const cancelled = await tx.order.count({
        where: { courierId, status: 'CANCELLED' },
      });

      let sumMins = 0;
      let nMins = 0;
      for (const o of delivered) {
        if (!o.deliveredAt) continue;
        const m = (o.deliveredAt.getTime() - o.createdAt.getTime()) / 60_000;
        if (Number.isFinite(m) && m >= 0 && m < 72 * 60) {
          sumMins += m;
          nMins += 1;
        }
      }
      const succ = delivered.length;
      const total = succ + cancelled;
      const avg = nMins > 0 ? new Prisma.Decimal(sumMins / nMins) : null;

      await tx.courierPerformance.upsert({
        where: { courierId },
        create: {
          courierId,
          totalDeliveries: total,
          successfulDeliveries: succ,
          cancelledDeliveries: cancelled,
          averageDeliveryTimeMinutes: avg,
        },
        update: {
          totalDeliveries: total,
          successfulDeliveries: succ,
          cancelledDeliveries: cancelled,
          averageDeliveryTimeMinutes: avg,
        },
      });
      await this.refreshDispatchScore(tx, courierId);
    });
  }
}
