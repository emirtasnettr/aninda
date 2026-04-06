import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { haversineDistanceKm } from '../orders/utils/haversine';
import { CreatePricingRuleDto } from './dto/create-pricing-rule.dto';
import { UpdatePricingRuleDto } from './dto/update-pricing-rule.dto';
import {
  computeDeliveryTotal,
  isNightEuropeIstanbul,
  splitCourierAndPlatform,
} from './pricing-engine';

export type PricingQuote = {
  km: number;
  total: number;
  basePrice: number;
  perKmPrice: number;
  minPrice: number;
  ruleId: string | null;
  subtotalBeforeMin: number;
  afterMin: number;
  nightApplied: boolean;
  priorityApplied: boolean;
  nightMultiplier: number;
  priorityMultiplier: number;
  isNight: boolean;
  isPriority: boolean;
  courierSharePercent: number;
  courierEarningAmount: number;
  platformCommissionAmount: number;
};

function envNum(key: string, fallback: number): number {
  const v = process.env[key];
  if (v === undefined || v === '') {
    return fallback;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function defaultCourierShareFromEnv(): number {
  const v =
    process.env.DEFAULT_COURIER_SHARE_PERCENT ??
    process.env.COURIER_EARNING_RATIO ??
    '0.72';
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.72;
}

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveRuleForUserId(userId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (customer) {
      const specific = await this.prisma.pricingRule.findFirst({
        where: { customerId: customer.id },
        orderBy: { updatedAt: 'desc' },
      });
      if (specific) {
        return specific;
      }
    }
    const globalRule = await this.prisma.pricingRule.findFirst({
      where: { customerId: null },
      orderBy: { updatedAt: 'desc' },
    });
    return globalRule;
  }

  async quoteForUser(
    userId: string,
    pickupLat: number,
    pickupLng: number,
    deliveryLat: number,
    deliveryLng: number,
    options?: { isPriority?: boolean; at?: Date },
  ): Promise<PricingQuote> {
    const rule = await this.resolveRuleForUserId(userId);
    const at = options?.at ?? new Date();
    const isPriority = options?.isPriority === true;
    const isNight = isNightEuropeIstanbul(at);

    const basePrice = rule
      ? Number(rule.basePrice)
      : envNum('DEFAULT_BASE_PRICE', 35);
    const perKmPrice = rule
      ? Number(rule.perKmPrice)
      : envNum('DEFAULT_PER_KM_PRICE', 12);
    const minPrice = rule
      ? Number(rule.minPrice)
      : envNum('DEFAULT_MIN_PRICE', 0);
    const nightMultiplier = rule
      ? Number(rule.nightMultiplier)
      : envNum('DEFAULT_NIGHT_MULTIPLIER', 1);
    const priorityMultiplier = rule
      ? Number(rule.priorityMultiplier)
      : envNum('DEFAULT_PRIORITY_MULTIPLIER', 1);

    const km = haversineDistanceKm(
      pickupLat,
      pickupLng,
      deliveryLat,
      deliveryLng,
    );
    const roundedKm = Math.round(km * 100) / 100;

    const breakdown = computeDeliveryTotal({
      basePrice,
      perKmPrice,
      minPrice,
      nightMultiplier,
      priorityMultiplier,
      km: roundedKm,
      isNight,
      isPriority,
    });

    const courierSharePercent =
      rule?.courierSharePercent != null
        ? Math.min(1, Math.max(0, Number(rule.courierSharePercent)))
        : defaultCourierShareFromEnv();

    const { courierEarningAmount, platformCommissionAmount } =
      splitCourierAndPlatform(breakdown.total, courierSharePercent);

    return {
      km: roundedKm,
      total: breakdown.total,
      basePrice,
      perKmPrice,
      minPrice,
      ruleId: rule?.id ?? null,
      subtotalBeforeMin: breakdown.subtotalBeforeMin,
      afterMin: breakdown.afterMin,
      nightApplied: breakdown.nightApplied,
      priorityApplied: breakdown.priorityApplied,
      nightMultiplier,
      priorityMultiplier,
      isNight,
      isPriority,
      courierSharePercent,
      courierEarningAmount,
      platformCommissionAmount,
    };
  }

  findAllRules() {
    return this.prisma.pricingRule.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        customer: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async createRule(dto: CreatePricingRuleDto) {
    if (dto.customerId) {
      const c = await this.prisma.customer.findUnique({
        where: { id: dto.customerId },
      });
      if (!c) {
        throw new NotFoundException('Customer not found');
      }
    }
    const data: Prisma.PricingRuleUncheckedCreateInput = {
      customerId: dto.customerId ?? null,
      basePrice: new Prisma.Decimal(dto.basePrice),
      perKmPrice: new Prisma.Decimal(dto.perKmPrice),
    };
    if (dto.minPrice !== undefined) {
      data.minPrice = new Prisma.Decimal(dto.minPrice);
    }
    if (dto.priorityMultiplier !== undefined) {
      data.priorityMultiplier = new Prisma.Decimal(dto.priorityMultiplier);
    }
    if (dto.nightMultiplier !== undefined) {
      data.nightMultiplier = new Prisma.Decimal(dto.nightMultiplier);
    }
    if (dto.courierSharePercent !== undefined) {
      data.courierSharePercent = new Prisma.Decimal(dto.courierSharePercent);
    }
    return this.prisma.pricingRule.create({
      data,
      include: {
        customer: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async updateRule(id: string, dto: UpdatePricingRuleDto) {
    await this.prisma.pricingRule.findUniqueOrThrow({ where: { id } });
    const keys = Object.keys(dto).filter(
      (k) => (dto as Record<string, unknown>)[k] !== undefined,
    );
    if (keys.length === 0) {
      throw new BadRequestException('Güncellenecek alan yok.');
    }
    const data: Prisma.PricingRuleUpdateInput = {};
    if (dto.basePrice !== undefined) {
      data.basePrice = new Prisma.Decimal(dto.basePrice);
    }
    if (dto.perKmPrice !== undefined) {
      data.perKmPrice = new Prisma.Decimal(dto.perKmPrice);
    }
    if (dto.minPrice !== undefined) {
      data.minPrice = new Prisma.Decimal(dto.minPrice);
    }
    if (dto.priorityMultiplier !== undefined) {
      data.priorityMultiplier = new Prisma.Decimal(dto.priorityMultiplier);
    }
    if (dto.nightMultiplier !== undefined) {
      data.nightMultiplier = new Prisma.Decimal(dto.nightMultiplier);
    }
    if (dto.courierSharePercent !== undefined) {
      data.courierSharePercent =
        dto.courierSharePercent === null
          ? null
          : new Prisma.Decimal(dto.courierSharePercent);
    }
    return this.prisma.pricingRule.update({
      where: { id },
      data,
      include: {
        customer: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async deleteRule(id: string) {
    await this.prisma.pricingRule.delete({ where: { id } });
    return { ok: true };
  }
}
