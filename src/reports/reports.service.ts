import { Injectable } from '@nestjs/common';
import { CourierEarningStatus, OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async erpOverview() {
    const [
      customerCount,
      orderCounts,
      balanceSum,
      pendingEarnings,
      paidEarnings,
      deliveredRevenue,
      deliveredCommission,
      allCourierEarningsSum,
    ] = await Promise.all([
      this.prisma.customer.count(),
      this.prisma.order.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      this.prisma.customerAccount.aggregate({ _sum: { balance: true } }),
      this.prisma.courierEarning.aggregate({
        where: { status: CourierEarningStatus.PENDING },
        _sum: { amount: true },
      }),
      this.prisma.courierEarning.aggregate({
        where: { status: CourierEarningStatus.PAID },
        _sum: { amount: true },
      }),
      this.prisma.order.aggregate({
        where: { status: OrderStatus.DELIVERED },
        _sum: { price: true },
      }),
      this.prisma.order.aggregate({
        where: {
          status: OrderStatus.DELIVERED,
          platformCommissionAmount: { not: null },
        },
        _sum: { platformCommissionAmount: true },
      }),
      this.prisma.courierEarning.aggregate({
        _sum: { amount: true },
      }),
    ]);

    const ordersByStatus: Record<string, number> = Object.fromEntries(
      orderCounts.map((o) => [o.status, o._count.id]),
    );

    return {
      customers: customerCount,
      ordersByStatus,
      totalOrders: orderCounts.reduce((s, o) => s + o._count.id, 0),
      receivablesBalance: balanceSum._sum.balance?.toString() ?? '0',
      courierEarningsPending: pendingEarnings._sum.amount?.toString() ?? '0',
      courierEarningsPaid: paidEarnings._sum.amount?.toString() ?? '0',
      revenueDelivered: deliveredRevenue._sum.price?.toString() ?? '0',
      platformCommissionDelivered:
        deliveredCommission._sum.platformCommissionAmount?.toString() ?? '0',
      courierEarningsTotal:
        allCourierEarningsSum._sum.amount?.toString() ?? '0',
    };
  }
}
