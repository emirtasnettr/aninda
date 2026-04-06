import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CourierPerformanceService } from '../courier-performance/courier-performance.service';
import {
  ErpCustomerType,
  OrderOfferStatus,
  OrderStatus,
  Prisma,
  Role,
} from '@prisma/client';
import { courierMayOperateDeliveries } from '../common/utils/courier-eligibility.util';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { CreateOrderDto } from './dto/create-order.dto';
import { AssignOrderDto } from './dto/assign-order.dto';
import { RateCourierDto } from './dto/rate-courier.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { courierHasActiveOrder } from './courier-active-order.util';
import { OrderMatchingService } from './order-matching.service';
import { RealtimeBroadcasterService } from '../realtime/realtime-broadcaster.service';
import { CustomersService } from '../customers/customers.service';
import { PricingService } from '../pricing/pricing.service';
import { FinanceService } from '../finance/finance.service';
import { CourierEarningsService } from '../courier-earnings/courier-earnings.service';

const orderInclude = {
  customer: { select: { id: true, email: true } },
  courier: { include: { user: { select: { email: true } } } },
  offers: {
    select: {
      id: true,
      courierId: true,
      status: true,
      createdAt: true,
    },
  },
  courierRating: { select: { id: true } },
} satisfies Prisma.OrderInclude;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matching: OrderMatchingService,
    private readonly realtime: RealtimeBroadcasterService,
    private readonly customers: CustomersService,
    private readonly pricing: PricingService,
    private readonly finance: FinanceService,
    private readonly courierEarnings: CourierEarningsService,
    private readonly courierPerformance: CourierPerformanceService,
  ) {}

  private readonly customerRoles: Role[] = [
    Role.INDIVIDUAL_CUSTOMER,
    Role.CORPORATE_CUSTOMER,
  ];

  private readonly opsRoles: Role[] = [
    Role.ADMIN,
    Role.OPERATIONS_MANAGER,
    Role.OPERATIONS_SPECIALIST,
  ];

  /**
   * Bakiye: borç (DEBIT) artırır; pozitif = müşteri borcu, negatif = ön ödeme.
   * Bireysel ve borçsuz kurumsal: işlem sonrası bakiye > 0 olamaz (peşin).
   * Kurumsal + creditEnabled: işlem sonrası bakiye <= creditLimit.
   */
  private assertCustomerMayOpenOrderDebt(
    me: AuthUser,
    customer: {
      type: ErpCustomerType;
      creditEnabled: boolean;
      creditLimit: Prisma.Decimal | null;
    },
    accountBalance: Prisma.Decimal,
    priceDec: Prisma.Decimal,
  ) {
    const projected = accountBalance.plus(priceDec);

    if (me.role === Role.INDIVIDUAL_CUSTOMER) {
      if (projected.gt(0)) {
        throw new BadRequestException(
          'Bireysel müşteriler borç veremez; sipariş öncesi yeterli ön ödeme veya tahsilat gerekir.',
        );
      }
      return;
    }

    if (me.role === Role.CORPORATE_CUSTOMER) {
      const mayUseCreditLine =
        customer.type === ErpCustomerType.CORPORATE && customer.creditEnabled;

      if (!mayUseCreditLine) {
        if (projected.gt(0)) {
          throw new BadRequestException(
            'Bu müşteri cari borç kullanamaz; sipariş öncesi yeterli ön ödeme veya tahsilat gerekir.',
          );
        }
        return;
      }

      if (!customer.creditLimit || customer.creditLimit.lte(0)) {
        throw new BadRequestException(
          'Kurumsal kredi limiti tanımlı değil. Yöneticiden limit tanımlanmasını isteyin.',
        );
      }

      if (projected.gt(customer.creditLimit)) {
        throw new BadRequestException('Bu müşteri kredi limitini aşmıştır');
      }
    }
  }

  async create(me: AuthUser, dto: CreateOrderDto) {
    if (!this.customerRoles.includes(me.role)) {
      throw new ForbiddenException('Only customers can create orders');
    }

    const quote = await this.pricing.quoteForUser(
      me.sub,
      dto.pickupLat,
      dto.pickupLng,
      dto.deliveryLat,
      dto.deliveryLng,
      { isPriority: dto.priority === true, at: new Date() },
    );
    if (quote.total > 0) {
      const relDiff = Math.abs(dto.price - quote.total) / quote.total;
      if (relDiff > 0.05) {
        throw new BadRequestException(
          `Fiyat sunucu hesabıyla uyuşmuyor. Beklenen: ${quote.total} ₺ (yaklaşık ${quote.km} km).`,
        );
      }
    }

    const priceDec = new Prisma.Decimal(quote.total);

    const { order, notifiedCourierIds } = await this.prisma.$transaction(
      async (tx) => {
        const user = await tx.user.findUniqueOrThrow({ where: { id: me.sub } });
        await this.customers.ensureCustomerForUser(tx, user);
        const customer = await tx.customer.findUniqueOrThrow({
          where: { userId: me.sub },
          include: { account: true },
        });
        if (!customer.account) {
          throw new BadRequestException('Cari hesap bulunamadı.');
        }

        this.assertCustomerMayOpenOrderDebt(
          me,
          {
            type: customer.type,
            creditEnabled: customer.creditEnabled,
            creditLimit: customer.creditLimit,
          },
          customer.account.balance,
          priceDec,
        );

        const created = await tx.order.create({
          data: {
            customerId: me.sub,
            pickupLat: dto.pickupLat,
            pickupLng: dto.pickupLng,
            deliveryLat: dto.deliveryLat,
            deliveryLng: dto.deliveryLng,
            price: priceDec,
            status: OrderStatus.SEARCHING_COURIER,
            pricingRuleId: quote.ruleId,
            courierSharePercent: new Prisma.Decimal(quote.courierSharePercent),
            courierEarningAmount: new Prisma.Decimal(
              quote.courierEarningAmount,
            ),
            platformCommissionAmount: new Prisma.Decimal(
              quote.platformCommissionAmount,
            ),
          },
        });

        await this.finance.addOrderDebitInTransaction(
          tx,
          customer.id,
          created.id,
          priceDec,
        );

        const notifiedCourierIds = await this.matching.offerTopCouriersByPickup(
          tx,
          created.id,
          created.pickupLat,
          created.pickupLng,
        );

        const full = await tx.order.findUniqueOrThrow({
          where: { id: created.id },
          include: orderInclude,
        });

        return { order: full, notifiedCourierIds };
      },
    );

    await this.applyFallbackAndNotifyJobRequest(order, notifiedCourierIds);

    return order;
  }

  async findAllForUser(me: AuthUser) {
    if (this.opsRoles.includes(me.role)) {
      return this.prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        include: orderInclude,
      });
    }

    if (me.role === Role.COURIER) {
      const courier = await this.prisma.courier.findUnique({
        where: { userId: me.sub },
      });
      if (!courier) return [];
      if (!courierMayOperateDeliveries(courier)) {
        return [];
      }
      await this.refreshOpenSearchOffers();
      const hasActive = await courierHasActiveOrder(this.prisma, courier.id);
      return this.prisma.order.findMany({
        where: hasActive
          ? { courierId: courier.id }
          : {
              OR: [
                { courierId: courier.id },
                {
                  status: OrderStatus.SEARCHING_COURIER,
                  offers: {
                    some: {
                      courierId: courier.id,
                      status: OrderOfferStatus.PENDING,
                    },
                  },
                },
              ],
            },
        orderBy: { createdAt: 'desc' },
        include: orderInclude,
      });
    }

    if (this.customerRoles.includes(me.role)) {
      return this.prisma.order.findMany({
        where: { customerId: me.sub },
        orderBy: { createdAt: 'desc' },
        include: orderInclude,
      });
    }

    if (me.role === Role.ACCOUNTING_SPECIALIST) {
      return this.prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          price: true,
          createdAt: true,
          customerId: true,
          courierId: true,
        },
      });
    }

    return [];
  }

  async findOne(id: string, me: AuthUser) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: orderInclude,
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    await this.assertCanAccessOrder(order, me);
    return order;
  }

  /**
   * Teklif alan kurye: siparişi kabul eder (yalnızca SEARCHING_COURIER ve kendi PENDING teklifi).
   */
  async acceptByCourier(orderId: string, me: AuthUser) {
    if (me.role !== Role.COURIER) {
      throw new ForbiddenException('Only couriers can accept offers');
    }

    const courier = await this.prisma.courier.findUnique({
      where: { userId: me.sub },
    });
    if (!courier) {
      throw new NotFoundException('Courier profile not found');
    }
    if (!courierMayOperateDeliveries(courier)) {
      throw new ForbiddenException(
        'Evraklar tamamlanana kadar iş kabul edemezsiniz',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const offer = await tx.orderCourierOffer.findFirst({
        where: {
          orderId,
          courierId: courier.id,
          status: OrderOfferStatus.PENDING,
        },
      });
      if (!offer) {
        throw new ForbiddenException('No pending offer for this order');
      }

      if (await courierHasActiveOrder(tx, courier.id)) {
        throw new ConflictException('Kurye zaten aktif bir sipariş taşıyor');
      }

      const locked = await tx.order.updateMany({
        where: { id: orderId, status: OrderStatus.SEARCHING_COURIER },
        data: {
          courierId: courier.id,
          status: OrderStatus.ACCEPTED,
        },
      });

      if (locked.count === 0) {
        throw new ConflictException(
          'Order is no longer in searching_courier state or was taken by another courier',
        );
      }

      await tx.orderCourierOffer.updateMany({
        where: {
          orderId,
          courierId: courier.id,
          status: OrderOfferStatus.PENDING,
        },
        data: { status: OrderOfferStatus.ACCEPTED },
      });

      await tx.orderCourierOffer.updateMany({
        where: { orderId, status: OrderOfferStatus.PENDING },
        data: { status: OrderOfferStatus.SUPERSEDED },
      });

      return tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: orderInclude,
      });
    });
  }

  /** Kurye: bekleyen teklifi reddeder (sipariş başka kuryede kalır). */
  async declineOfferByCourier(orderId: string, me: AuthUser) {
    if (me.role !== Role.COURIER) {
      throw new ForbiddenException('Only couriers can decline offers');
    }
    const courier = await this.prisma.courier.findUnique({
      where: { userId: me.sub },
    });
    if (!courier) {
      throw new NotFoundException('Courier profile not found');
    }
    const updated = await this.prisma.orderCourierOffer.updateMany({
      where: {
        orderId,
        courierId: courier.id,
        status: OrderOfferStatus.PENDING,
      },
      data: { status: OrderOfferStatus.EXPIRED },
    });
    if (updated.count === 0) {
      throw new ConflictException('No pending offer to decline');
    }
    return { ok: true as const };
  }

  /**
   * Operasyon: manuel kurye ataması (bekleyen / arama aşamasındaki siparişler).
   */
  async assignManual(orderId: string, dto: AssignOrderDto, me: AuthUser) {
    if (!this.opsRoles.includes(me.role)) {
      throw new ForbiddenException(
        'Only operations staff can manually assign couriers',
      );
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const allowedForManualAssign: OrderStatus[] = [
      OrderStatus.PENDING,
      OrderStatus.SEARCHING_COURIER,
    ];
    if (!allowedForManualAssign.includes(order.status)) {
      throw new BadRequestException(
        'Manual assign is only allowed for pending or searching_courier orders',
      );
    }

    const courier = await this.prisma.courier.findUnique({
      where: { id: dto.courierId },
    });
    if (!courier) {
      throw new NotFoundException('Courier not found');
    }
    if (!courierMayOperateDeliveries(courier)) {
      throw new BadRequestException(
        'Evrakları tamamlanmamış kuryeye sipariş atanamaz',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (await courierHasActiveOrder(tx, dto.courierId)) {
        throw new BadRequestException('Kurye zaten aktif bir sipariş taşıyor');
      }

      await tx.orderCourierOffer.updateMany({
        where: { orderId, status: OrderOfferStatus.PENDING },
        data: { status: OrderOfferStatus.SUPERSEDED },
      });

      return tx.order.update({
        where: { id: orderId },
        data: {
          courierId: dto.courierId,
          status: OrderStatus.ACCEPTED,
        },
        include: orderInclude,
      });
    });

    this.realtime.notifyOrderAssigned(dto.courierId, {
      orderId: updated.id,
      pickupLat: updated.pickupLat,
      pickupLng: updated.pickupLng,
      deliveryLat: updated.deliveryLat,
      deliveryLng: updated.deliveryLng,
      price: updated.price.toString(),
      status: updated.status,
    });

    return updated;
  }

  async updateStatus(orderId: string, dto: UpdateOrderStatusDto, me: AuthUser) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (this.opsRoles.includes(me.role)) {
      return this.patchStatus(orderId, dto.status);
    }

    if (me.role === Role.COURIER) {
      const courier = await this.prisma.courier.findUnique({
        where: { userId: me.sub },
      });
      if (!courier || order.courierId !== courier.id) {
        throw new ForbiddenException('You can only update your own deliveries');
      }

      const allowedNext: Partial<Record<OrderStatus, OrderStatus[]>> = {
        [OrderStatus.ACCEPTED]: [OrderStatus.PICKED_UP],
        [OrderStatus.PICKED_UP]: [OrderStatus.ON_DELIVERY],
        [OrderStatus.ON_DELIVERY]: [OrderStatus.DELIVERED],
      };

      const next = allowedNext[order.status];
      if (!next?.includes(dto.status)) {
        throw new BadRequestException(
          `Invalid status transition from ${order.status} to ${dto.status} for courier`,
        );
      }

      return this.patchStatus(orderId, dto.status);
    }

    throw new ForbiddenException('Not allowed to update order status');
  }

  private async patchStatus(id: string, status: OrderStatus) {
    const current = await this.prisma.order.findUnique({
      where: { id },
      select: { status: true, courierId: true },
    });
    const data: Prisma.OrderUpdateInput = { status };
    if (
      status === OrderStatus.DELIVERED &&
      current?.status !== OrderStatus.DELIVERED
    ) {
      data.deliveredAt = new Date();
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.order.update({
        where: { id },
        data,
        include: orderInclude,
      });
      if (
        status === OrderStatus.DELIVERED &&
        current?.status !== OrderStatus.DELIVERED
      ) {
        await this.courierEarnings.createForDeliveredOrder(tx, id);
        await this.courierPerformance.onOrderDelivered(tx, {
          id: row.id,
          courierId: row.courierId,
          createdAt: row.createdAt,
          deliveredAt: row.deliveredAt,
        });
      }
      if (
        status === OrderStatus.CANCELLED &&
        current?.courierId &&
        current.status !== OrderStatus.CANCELLED
      ) {
        await this.courierPerformance.onAssignedOrderCancelled(
          tx,
          current.courierId,
        );
      }
      return row;
    });

    if (
      status === OrderStatus.SEARCHING_COURIER &&
      current?.status !== OrderStatus.SEARCHING_COURIER &&
      !updated.courierId
    ) {
      await this.runMatchingAndNotifyJobRequest(updated);
    }

    return updated;
  }

  /** Müşteri: teslim sonrası kurye puanı (sipariş başına bir kez) */
  async rateCourier(orderId: string, me: AuthUser, dto: RateCourierDto) {
    if (!this.customerRoles.includes(me.role)) {
      throw new ForbiddenException('Only customers can rate couriers');
    }
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.customerId !== me.sub) {
      throw new ForbiddenException('You can only rate your own orders');
    }
    if (order.status !== OrderStatus.DELIVERED) {
      throw new BadRequestException('Only delivered orders can be rated');
    }
    if (!order.courierId) {
      throw new BadRequestException('Order had no assigned courier');
    }
    const existing = await this.prisma.courierRating.findUnique({
      where: { orderId },
    });
    if (existing) {
      throw new ConflictException('This order was already rated');
    }
    await this.prisma.$transaction((tx) =>
      this.courierPerformance.applyRating(tx, {
        courierId: order.courierId!,
        orderId,
        customerId: me.sub,
        rating: dto.rating,
        comment: dto.comment,
      }),
    );
    return { ok: true };
  }

  private jobRequestPayloadFromOrder(order: {
    id: string;
    pickupLat: number;
    pickupLng: number;
    deliveryLat: number;
    deliveryLng: number;
    price: Prisma.Decimal;
    status: OrderStatus;
  }) {
    return {
      orderId: order.id,
      pickupLat: order.pickupLat,
      pickupLng: order.pickupLng,
      deliveryLat: order.deliveryLat,
      deliveryLng: order.deliveryLng,
      price: order.price.toString(),
      status: order.status,
    };
  }

  private async applyFallbackAndNotifyJobRequest(
    order: {
      id: string;
      pickupLat: number;
      pickupLng: number;
      deliveryLat: number;
      deliveryLng: number;
      price: Prisma.Decimal;
      status: OrderStatus;
    },
    notifiedCourierIds: string[],
  ): Promise<void> {
    let notifyIds = [...notifiedCourierIds];
    if (notifyIds.length === 0) {
      notifyIds = await this.matching.fallbackOffersWhenNoNearbyMatches(
        order.id,
      );
    }
    const jobPayload = this.jobRequestPayloadFromOrder(order);
    for (const courierId of notifyIds) {
      this.realtime.notifyJobRequest(courierId, jobPayload);
    }
  }

  private async runMatchingAndNotifyJobRequest(order: {
    id: string;
    pickupLat: number;
    pickupLng: number;
    deliveryLat: number;
    deliveryLng: number;
    price: Prisma.Decimal;
    status: OrderStatus;
  }): Promise<void> {
    const notifiedCourierIds = await this.prisma.$transaction(async (tx) => {
      return this.matching.offerTopCouriersByPickup(
        tx,
        order.id,
        order.pickupLat,
        order.pickupLng,
      );
    });
    await this.applyFallbackAndNotifyJobRequest(order, notifiedCourierIds);
  }

  /** Sipariş oluşturulurken çevrimiçi olmayan kuryeler için teklifleri tamamlar (socket yok). */
  private async ensureOffersForOpenSearchOrder(o: {
    id: string;
    pickupLat: number;
    pickupLng: number;
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.matching.offerTopCouriersByPickup(
        tx,
        o.id,
        o.pickupLat,
        o.pickupLng,
      );
    });
    const pending = await this.prisma.orderCourierOffer.count({
      where: {
        orderId: o.id,
        status: OrderOfferStatus.PENDING,
      },
    });
    if (pending === 0) {
      await this.matching.fallbackOffersWhenNoNearbyMatches(o.id);
    }
  }

  private async refreshOpenSearchOffers(): Promise<void> {
    const open = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.SEARCHING_COURIER,
        courierId: null,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        pickupLat: true,
        pickupLng: true,
      },
    });
    for (const o of open) {
      try {
        await this.ensureOffersForOpenSearchOrder(o);
      } catch {
        /* ignore */
      }
    }
  }

  private async assertCanAccessOrder(
    order: { id: string; customerId: string; courierId: string | null },
    me: AuthUser,
  ) {
    if (
      this.opsRoles.includes(me.role) ||
      me.role === Role.ACCOUNTING_SPECIALIST
    ) {
      return;
    }
    if (order.customerId === me.sub) {
      return;
    }
    if (me.role === Role.COURIER) {
      const c = await this.prisma.courier.findUnique({
        where: { userId: me.sub },
      });
      if (c && order.courierId === c.id) {
        return;
      }
      if (c) {
        const offer = await this.prisma.orderCourierOffer.findFirst({
          where: {
            orderId: order.id,
            courierId: c.id,
            status: OrderOfferStatus.PENDING,
          },
        });
        if (offer) {
          return;
        }
      }
    }
    throw new ForbiddenException('Access denied');
  }
}
