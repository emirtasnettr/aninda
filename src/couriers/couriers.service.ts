import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CourierEarningStatus, OrderStatus, Prisma } from '@prisma/client';
import { COURIER_STATUS } from '../common/constants/courier-workflow';
import { courierMayOperateDeliveries } from '../common/utils/courier-eligibility.util';
import { CourierPerformanceService } from '../courier-performance/courier-performance.service';
import { PrismaService } from '../prisma/prisma.service';
import { CourierDocumentsService } from './courier-documents.service';
import {
  COURIER_ACTIVE_ORDER_STATUSES,
  courierHasActiveOrder,
} from '../orders/courier-active-order.util';
import { OpsCourierPatchDto } from './dto/ops-courier-patch.dto';
import { UpdateCourierDto } from './dto/update-courier.dto';
import {
  endOfIstanbulDay,
  startOfIstanbulDay,
} from './courier-day-bounds.util';

type CourierMeRow = Prisma.CourierGetPayload<{
  include: {
    user: { select: { id: true; email: true; role: true } };
    performance: {
      select: {
        totalDeliveries: true;
        successfulDeliveries: true;
        cancelledDeliveries: true;
        averageDeliveryTimeMinutes: true;
      };
    };
    documents: true;
  };
}>;

@Injectable()
export class CouriersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly courierPerformance: CourierPerformanceService,
    private readonly courierDocs: CourierDocumentsService,
  ) {}

  private toCourierMeResponse(courier: CourierMeRow, busy: boolean) {
    const { documents: rawDocs, ...rest } = courier;
    return {
      ...rest,
      documents: this.courierDocs.mergeDocumentSlots(rawDocs),
      busy,
    };
  }

  async findByUserId(userId: string) {
    const courier = await this.prisma.courier.findUnique({
      where: { userId },
      include: {
        user: { select: { id: true, email: true, role: true } },
        performance: {
          select: {
            totalDeliveries: true,
            successfulDeliveries: true,
            cancelledDeliveries: true,
            averageDeliveryTimeMinutes: true,
          },
        },
        documents: true,
      },
    });
    if (!courier) {
      throw new NotFoundException('Courier profile not found');
    }
    const busy = await courierHasActiveOrder(this.prisma, courier.id);
    return this.toCourierMeResponse(courier, busy);
  }

  async updateByUserId(userId: string, dto: UpdateCourierDto) {
    const current = await this.findByUserId(userId);
    if (dto.isOnline === true && !courierMayOperateDeliveries(current)) {
      throw new BadRequestException(
        'Evraklar tamamlanana kadar çevrimiçi olamaz ve iş alamazsınız',
      );
    }
    const updated = await this.prisma.courier.update({
      where: { userId },
      data: dto,
      include: {
        user: { select: { id: true, email: true, role: true } },
        performance: {
          select: {
            totalDeliveries: true,
            successfulDeliveries: true,
            cancelledDeliveries: true,
            averageDeliveryTimeMinutes: true,
          },
        },
        documents: true,
      },
    });
    if (
      dto.isOnline === true ||
      dto.lat !== undefined ||
      dto.lng !== undefined
    ) {
      void this.courierPerformance.touchLastActive(updated.id);
    }
    const busy = await courierHasActiveOrder(this.prisma, updated.id);
    return this.toCourierMeResponse(updated, busy);
  }

  async findAllForOps() {
    return this.findAllForOpsWithStats();
  }

  async findAllForOpsWithStats() {
    const couriers = await this.prisma.courier.findMany({
      include: { user: { select: { id: true, email: true, role: true } } },
      orderBy: { user: { email: 'asc' } },
    });
    const ids = couriers.map((c) => c.id);
    if (ids.length === 0) {
      return [];
    }

    const dayStart = startOfIstanbulDay(new Date());
    const dayEnd = endOfIstanbulDay(new Date());

    const [activeGroups, todayDelGroups, todayEarnGroups, deliveredSamples] =
      await Promise.all([
        this.prisma.order.groupBy({
          by: ['courierId'],
          where: {
            courierId: { in: ids },
            status: { in: [...COURIER_ACTIVE_ORDER_STATUSES] },
          },
          _count: { _all: true },
        }),
        this.prisma.order.groupBy({
          by: ['courierId'],
          where: {
            courierId: { in: ids },
            status: OrderStatus.DELIVERED,
            deliveredAt: { gte: dayStart, lt: dayEnd },
          },
          _count: { _all: true },
        }),
        this.prisma.courierEarning.groupBy({
          by: ['courierId'],
          where: {
            courierId: { in: ids },
            createdAt: { gte: dayStart, lt: dayEnd },
          },
          _sum: { amount: true },
        }),
        this.prisma.order.findMany({
          where: {
            courierId: { in: ids },
            status: OrderStatus.DELIVERED,
            deliveredAt: { not: null },
          },
          select: {
            courierId: true,
            createdAt: true,
            deliveredAt: true,
          },
          orderBy: { deliveredAt: 'desc' },
          take: 4000,
        }),
      ]);

    const activeMap = new Map(
      activeGroups.map((g) => [g.courierId, g._count._all]),
    );
    const todayDelMap = new Map(
      todayDelGroups.map((g) => [g.courierId, g._count._all]),
    );
    const todayEarnMap = new Map(
      todayEarnGroups.map((g) => [
        g.courierId,
        g._sum.amount ?? new Prisma.Decimal(0),
      ]),
    );

    const avgAccum = new Map<string, { sum: number; n: number }>();
    for (const row of deliveredSamples) {
      if (!row.courierId || !row.deliveredAt) continue;
      const mins =
        (row.deliveredAt.getTime() - row.createdAt.getTime()) / 60_000;
      if (!Number.isFinite(mins) || mins < 0 || mins > 36 * 60) continue;
      const cur = avgAccum.get(row.courierId) ?? { sum: 0, n: 0 };
      cur.sum += mins;
      cur.n += 1;
      avgAccum.set(row.courierId, cur);
    }

    return couriers.map((c) => {
      const activeCount = activeMap.get(c.id) ?? 0;
      const opsState = !c.isOnline
        ? 'offline'
        : activeCount > 0
          ? 'online_busy'
          : 'online_idle';
      const avg = avgAccum.get(c.id);
      return {
        ...c,
        stats: {
          activeOrdersCount: activeCount,
          todayDeliveriesCount: todayDelMap.get(c.id) ?? 0,
          avgDeliveryMinutes:
            avg && avg.n > 0 ? Math.round((avg.sum / avg.n) * 10) / 10 : null,
          todayEarningsTry: (
            todayEarnMap.get(c.id) ?? new Prisma.Decimal(0)
          ).toString(),
        },
        opsState,
      };
    });
  }

  async findOneForOps(id: string) {
    const courier = await this.prisma.courier.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, email: true, role: true, createdAt: true },
        },
        documents: true,
      },
    });
    if (!courier) {
      throw new NotFoundException('Courier not found');
    }

    const [activeOrders, recentOrders, earningTotals, earnings14d, del14d] =
      await Promise.all([
        this.prisma.order.findMany({
          where: {
            courierId: id,
            status: { in: [...COURIER_ACTIVE_ORDER_STATUSES] },
          },
          orderBy: { createdAt: 'desc' },
          include: {
            customer: { select: { id: true, email: true } },
          },
        }),
        this.prisma.order.findMany({
          where: { courierId: id },
          orderBy: { createdAt: 'desc' },
          take: 80,
          include: {
            customer: { select: { id: true, email: true } },
          },
        }),
        this.prisma.courierEarning.aggregate({
          where: { courierId: id },
          _sum: { amount: true },
          _count: true,
        }),
        this.prisma.courierEarning.findMany({
          where: {
            courierId: id,
            createdAt: {
              gte: new Date(
                startOfIstanbulDay(new Date()).getTime() -
                  13 * 24 * 60 * 60 * 1000,
              ),
            },
          },
          select: { amount: true, createdAt: true },
        }),
        this.prisma.order.findMany({
          where: {
            courierId: id,
            status: OrderStatus.DELIVERED,
            deliveredAt: {
              gte: new Date(
                startOfIstanbulDay(new Date()).getTime() -
                  13 * 24 * 60 * 60 * 1000,
              ),
            },
          },
          select: { deliveredAt: true },
        }),
      ]);

    const pendingSum = await this.prisma.courierEarning.aggregate({
      where: {
        courierId: id,
        status: CourierEarningStatus.PENDING,
      },
      _sum: { amount: true },
    });

    const dayKey = (d: Date) =>
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Istanbul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d);

    const chartKeys: string[] = [];
    const today0 = startOfIstanbulDay(new Date());
    for (let i = 13; i >= 0; i--) {
      const t = new Date(today0.getTime() - i * 24 * 60 * 60 * 1000);
      chartKeys.push(dayKey(t));
    }

    const chartMap = new Map<
      string,
      { deliveries: number; earningsTry: number }
    >();
    for (const k of chartKeys) {
      chartMap.set(k, { deliveries: 0, earningsTry: 0 });
    }

    for (const o of del14d) {
      if (!o.deliveredAt) continue;
      const k = dayKey(o.deliveredAt);
      const row = chartMap.get(k);
      if (row) row.deliveries += 1;
    }

    for (const e of earnings14d) {
      const k = dayKey(e.createdAt);
      const row = chartMap.get(k);
      if (row) row.earningsTry += Number(e.amount);
    }

    const performanceSeries = chartKeys.map((date) => {
      const v = chartMap.get(date)!;
      return {
        date,
        deliveries: v.deliveries,
        earningsTry: Math.round(v.earningsTry * 100) / 100,
      };
    });

    const activeCount = activeOrders.length;
    const opsState = !courier.isOnline
      ? 'offline'
      : activeCount > 0
        ? 'online_busy'
        : 'online_idle';

    const [perfRow, recentRatings] = await Promise.all([
      this.prisma.courierPerformance.findUnique({
        where: { courierId: id },
      }),
      this.prisma.courierRating.findMany({
        where: { courierId: id },
        orderBy: { createdAt: 'desc' },
        take: 15,
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
          orderId: true,
        },
      }),
    ]);

    const totalClosed = perfRow
      ? perfRow.successfulDeliveries + perfRow.cancelledDeliveries
      : 0;
    const successRate =
      totalClosed > 0 ? perfRow!.successfulDeliveries / totalClosed : null;

    const avgR =
      courier.averageRating != null ? Number(courier.averageRating) : null;
    const dispatchN = Number(courier.dispatchScore ?? 50);
    const isLowPerformance =
      dispatchN < 45 ||
      (successRate != null && totalClosed >= 5 && successRate < 0.75) ||
      (courier.totalRatings >= 3 && avgR != null && avgR < 3.5);

    const { documents: opsDocs, ...courierRest } = courier;
    return {
      courier: {
        ...courierRest,
        documents: this.courierDocs.mergeDocumentSlots(opsDocs),
      },
      opsState,
      stats: {
        activeOrdersCount: activeCount,
        totalEarningsTry: earningTotals._sum.amount?.toString() ?? '0',
        totalEarningRows: earningTotals._count,
        pendingEarningsTry: pendingSum._sum.amount?.toString() ?? '0',
      },
      activeOrders,
      recentOrders,
      performanceSeries,
      performanceMetrics: perfRow
        ? {
            totalDeliveries: perfRow.totalDeliveries,
            successfulDeliveries: perfRow.successfulDeliveries,
            cancelledDeliveries: perfRow.cancelledDeliveries,
            averageDeliveryTimeMinutes:
              perfRow.averageDeliveryTimeMinutes?.toString() ?? null,
            successRate,
            lastActiveAt: perfRow.lastActiveAt?.toISOString() ?? null,
          }
        : {
            totalDeliveries: 0,
            successfulDeliveries: 0,
            cancelledDeliveries: 0,
            averageDeliveryTimeMinutes: null,
            successRate: null,
            lastActiveAt: null,
          },
      ratingSummary: {
        averageRating: courier.averageRating?.toString() ?? null,
        totalRatings: courier.totalRatings,
        dispatchScore: courier.dispatchScore.toString(),
      },
      recentRatings,
      isLowPerformance,
    };
  }

  async patchByIdForOps(id: string, dto: OpsCourierPatchDto) {
    const exists = await this.prisma.courier.findUnique({ where: { id } });
    if (!exists) {
      throw new NotFoundException('Courier not found');
    }
    if (dto.isOnline === true && !courierMayOperateDeliveries(exists)) {
      throw new BadRequestException(
        'Evrakları tamamlanmamış kurye çevrimiçi yapılamaz',
      );
    }
    return this.prisma.courier.update({
      where: { id },
      data: { isOnline: dto.isOnline },
      include: { user: { select: { id: true, email: true, role: true } } },
    });
  }

  listPendingRegistrations() {
    return this.prisma.courier.findMany({
      where: { workflowStatus: COURIER_STATUS.PENDING },
      include: { user: { select: { id: true, email: true } } },
      orderBy: { id: 'asc' },
    });
  }

  /** Evrak yükleme / düzeltme aşamasındaki kuryeler */
  async listAwaitingDocuments() {
    const rows = await this.prisma.courier.findMany({
      where: {
        workflowStatus: {
          in: [COURIER_STATUS.PRE_APPROVED, COURIER_STATUS.DOCUMENT_PENDING],
        },
      },
      include: {
        user: { select: { id: true, email: true } },
        documents: true,
      },
      orderBy: { id: 'asc' },
    });
    return rows.map((c) => {
      const { documents, ...rest } = c;
      return {
        ...rest,
        documents: this.courierDocs.mergeDocumentSlots(documents),
      };
    });
  }

  /** Evrak inceleme kuyruğu */
  async listDocumentReviewQueue() {
    const rows = await this.prisma.courier.findMany({
      where: { workflowStatus: COURIER_STATUS.DOCUMENT_REVIEW },
      include: {
        user: { select: { id: true, email: true } },
        documents: true,
      },
      orderBy: { id: 'asc' },
    });
    return rows.map((c) => {
      const { documents, ...rest } = c;
      return {
        ...rest,
        documents: this.courierDocs.mergeDocumentSlots(documents),
      };
    });
  }

  async uploadMyDocument(
    userId: string,
    typeParam: string,
    file: Express.Multer.File | undefined,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Dosya gerekli (file)');
    }
    const docType = this.courierDocs.parseDocumentTypeParam(typeParam);
    const row = await this.courierDocs.uploadMyDocument(userId, docType, file);
    const busy = await courierHasActiveOrder(this.prisma, row.id);
    return this.toCourierMeResponse(row as CourierMeRow, busy);
  }

  async submitMyDocumentsForReview(userId: string) {
    const row = await this.courierDocs.submitForReview(userId);
    const busy = await courierHasActiveOrder(this.prisma, row.id);
    return this.toCourierMeResponse(row as CourierMeRow, busy);
  }

  async approveCourierDocument(courierId: string, typeParam: string) {
    const docType = this.courierDocs.parseDocumentTypeParam(typeParam);
    const c = await this.courierDocs.approveDocument(courierId, docType);
    const { documents, ...rest } = c;
    return {
      ...rest,
      documents: this.courierDocs.mergeDocumentSlots(documents),
    };
  }

  async rejectCourierDocument(
    courierId: string,
    typeParam: string,
    reason?: string,
  ) {
    const docType = this.courierDocs.parseDocumentTypeParam(typeParam);
    const c = await this.courierDocs.rejectDocument(courierId, docType, reason);
    const { documents, ...rest } = c;
    return {
      ...rest,
      documents: this.courierDocs.mergeDocumentSlots(documents),
    };
  }

  async approveRegistration(courierId: string) {
    const c = await this.prisma.courier.findUnique({
      where: { id: courierId },
    });
    if (!c) {
      throw new NotFoundException('Courier not found');
    }
    if (c.workflowStatus !== COURIER_STATUS.PENDING) {
      throw new BadRequestException('Bu başvuru beklemede değil');
    }
    return this.prisma.courier.update({
      where: { id: courierId },
      data: {
        workflowStatus: COURIER_STATUS.PRE_APPROVED,
        rejectionReason: null,
      },
      include: { user: { select: { id: true, email: true, role: true } } },
    });
  }

  async rejectRegistration(courierId: string, reason?: string) {
    const c = await this.prisma.courier.findUnique({
      where: { id: courierId },
    });
    if (!c) {
      throw new NotFoundException('Courier not found');
    }
    if (c.workflowStatus !== COURIER_STATUS.PENDING) {
      throw new BadRequestException('Bu başvuru beklemede değil');
    }
    return this.prisma.courier.update({
      where: { id: courierId },
      data: {
        workflowStatus: COURIER_STATUS.REJECTED,
        rejectionReason: reason?.trim() || null,
        isOnline: false,
      },
      include: { user: { select: { id: true, email: true, role: true } } },
    });
  }
}
