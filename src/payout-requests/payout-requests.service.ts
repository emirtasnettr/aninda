import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CourierEarningStatus,
  PayoutRequestStatus,
  Prisma,
} from '@prisma/client';
import { hasCompleteBankProfile } from '../common/bank-profile.util';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PayoutRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async createForCourierUser(userId: string) {
    const courier = await this.prisma.courier.findUnique({
      where: { userId },
    });
    if (!courier) {
      throw new NotFoundException('Courier profile not found');
    }
    if (!hasCompleteBankProfile(courier)) {
      throw new BadRequestException(
        'Ödeme talebi için banka adı, hesap sahibi ve geçerli TR IBAN gerekli',
      );
    }

    const pending = await this.prisma.courierEarning.findMany({
      where: {
        courierId: courier.id,
        status: CourierEarningStatus.PENDING,
      },
      orderBy: { createdAt: 'asc' },
    });

    let total = new Prisma.Decimal(0);
    for (const e of pending) {
      total = total.add(e.amount);
    }
    if (total.lte(0) || pending.length === 0) {
      throw new BadRequestException('Talep edilebilir bakiye yok');
    }

    const minStr =
      process.env.PAYOUT_MIN_TRY?.trim() &&
      process.env.PAYOUT_MIN_TRY.trim() !== ''
        ? process.env.PAYOUT_MIN_TRY.trim()
        : '100';
    const minDec = new Prisma.Decimal(minStr);
    if (total.lt(minDec)) {
      throw new BadRequestException(
        `Minimum ödeme tutarı ${minStr} ₺. Talep edilebilir bakiye: ${total.toString()} ₺`,
      );
    }

    const open = await this.prisma.payoutRequest.findFirst({
      where: {
        courierId: courier.id,
        status: {
          in: [PayoutRequestStatus.PENDING, PayoutRequestStatus.APPROVED],
        },
      },
    });
    if (open) {
      throw new ConflictException(
        'Onay veya ödeme bekleyen açık bir talebiniz var',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const pr = await tx.payoutRequest.create({
        data: {
          courierId: courier.id,
          amount: total,
          status: PayoutRequestStatus.PENDING,
        },
      });
      await tx.courierEarning.updateMany({
        where: { id: { in: pending.map((e) => e.id) } },
        data: {
          status: CourierEarningStatus.REQUESTED,
          payoutRequestId: pr.id,
        },
      });
      return tx.payoutRequest.findUniqueOrThrow({
        where: { id: pr.id },
        include: {
          courier: {
            include: { user: { select: { email: true } } },
          },
          earnings: {
            select: { id: true, orderId: true, amount: true, status: true },
          },
        },
      });
    });
  }

  listForCourierUser(userId: string) {
    return this.prisma.payoutRequest.findMany({
      where: { courier: { userId } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        amount: true,
        status: true,
        receiptUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  listAll(status?: PayoutRequestStatus) {
    return this.prisma.payoutRequest.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        courier: {
          select: {
            fullName: true,
            bankName: true,
            accountHolderName: true,
            iban: true,
            user: { select: { email: true } },
          },
        },
      },
    });
  }

  async findOne(id: string) {
    const row = await this.prisma.payoutRequest.findUnique({
      where: { id },
      include: {
        courier: {
          select: {
            fullName: true,
            bankName: true,
            accountHolderName: true,
            iban: true,
            user: { select: { email: true } },
          },
        },
        earnings: {
          orderBy: { createdAt: 'asc' },
          include: {
            order: { select: { id: true, price: true, deliveredAt: true } },
          },
        },
      },
    });
    if (!row) {
      throw new NotFoundException('Talep bulunamadı');
    }
    return row;
  }

  async approve(id: string) {
    const row = await this.prisma.payoutRequest.findUnique({
      where: { id },
    });
    if (!row) {
      throw new NotFoundException('Talep bulunamadı');
    }
    if (row.status !== PayoutRequestStatus.PENDING) {
      throw new BadRequestException('Yalnızca beklemedeki talepler onaylanır');
    }
    return this.prisma.payoutRequest.update({
      where: { id },
      data: { status: PayoutRequestStatus.APPROVED },
      include: {
        courier: {
          select: {
            fullName: true,
            bankName: true,
            accountHolderName: true,
            iban: true,
            user: { select: { email: true } },
          },
        },
      },
    });
  }

  async reject(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.payoutRequest.findUnique({ where: { id } });
      if (!row) {
        throw new NotFoundException('Talep bulunamadı');
      }
      if (
        row.status !== PayoutRequestStatus.PENDING &&
        row.status !== PayoutRequestStatus.APPROVED
      ) {
        throw new BadRequestException('Bu talep reddedilemez');
      }
      await tx.courierEarning.updateMany({
        where: { payoutRequestId: id },
        data: {
          status: CourierEarningStatus.PENDING,
          payoutRequestId: null,
        },
      });
      return tx.payoutRequest.update({
        where: { id },
        data: { status: PayoutRequestStatus.REJECTED },
        include: {
          courier: {
            select: {
              fullName: true,
              bankName: true,
              accountHolderName: true,
              iban: true,
              user: { select: { email: true } },
            },
          },
        },
      });
    });
  }

  async markPaid(id: string, receiptUrl?: string) {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.payoutRequest.findUnique({ where: { id } });
      if (!row) {
        throw new NotFoundException('Talep bulunamadı');
      }
      if (row.status !== PayoutRequestStatus.APPROVED) {
        throw new BadRequestException(
          'Ödeme yalnızca onaylanmış talepler için işaretlenir',
        );
      }
      await tx.courierEarning.updateMany({
        where: { payoutRequestId: id },
        data: { status: CourierEarningStatus.PAID },
      });
      return tx.payoutRequest.update({
        where: { id },
        data: {
          status: PayoutRequestStatus.PAID,
          receiptUrl: receiptUrl?.trim() || null,
        },
        include: {
          courier: {
            select: {
              fullName: true,
              bankName: true,
              accountHolderName: true,
              iban: true,
              user: { select: { email: true } },
            },
          },
          earnings: {
            select: { id: true, orderId: true, amount: true, status: true },
          },
        },
      });
    });
  }
}
