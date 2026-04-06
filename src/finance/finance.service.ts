import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountTransactionType,
  ErpCustomerType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';

/**
 * Bakiye: DEBIT borç artırır (müşteri bize borçlanır), CREDIT tahsilat/azaltma.
 */
@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  async listAccounts() {
    const accounts = await this.prisma.customerAccount.findMany({
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            type: true,
            creditEnabled: true,
            creditLimit: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const lastByCustomer = await this.prisma.customerTransaction.groupBy({
      by: ['customerId'],
      _max: { createdAt: true },
    });
    const lastMap = new Map(
      lastByCustomer.map((r) => [r.customerId, r._max.createdAt]),
    );

    return accounts.map((a) => ({
      ...a,
      lastTransactionAt: lastMap.get(a.customerId) ?? null,
    }));
  }

  async getAccountByCustomerId(customerId: string) {
    const acc = await this.prisma.customerAccount.findUnique({
      where: { customerId },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            type: true,
            phone: true,
            creditEnabled: true,
            creditLimit: true,
          },
        },
      },
    });
    if (!acc) {
      throw new NotFoundException('Account not found');
    }
    return acc;
  }

  listTransactions(customerId?: string) {
    return this.prisma.customerTransaction.findMany({
      where: customerId ? { customerId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: {
        customer: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async createTransaction(customerId: string, dto: CreateTransactionDto) {
    const acc = await this.prisma.customerAccount.findUnique({
      where: { customerId },
    });
    if (!acc) {
      throw new NotFoundException('Account not found');
    }
    const amount = new Prisma.Decimal(dto.amount);
    if (amount.lte(0)) {
      throw new BadRequestException('Amount must be positive');
    }
    return this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({
        where: { id: customerId },
        select: {
          type: true,
          creditEnabled: true,
          creditLimit: true,
        },
      });
      if (!customer) {
        throw new NotFoundException('Customer not found');
      }

      if (dto.type === AccountTransactionType.DEBIT) {
        const projected = acc.balance.plus(amount);
        if (
          customer.type === ErpCustomerType.CORPORATE &&
          customer.creditEnabled &&
          customer.creditLimit &&
          customer.creditLimit.gt(0) &&
          projected.gt(customer.creditLimit)
        ) {
          throw new BadRequestException('Bu müşteri kredi limitini aşmıştır');
        }
      }

      const txRow = await tx.customerTransaction.create({
        data: {
          customerId,
          type: dto.type,
          amount,
          description: dto.description ?? null,
        },
      });
      const delta =
        dto.type === AccountTransactionType.DEBIT ? amount : amount.negated();
      await tx.customerAccount.update({
        where: { customerId },
        data: {
          balance: { increment: delta },
        },
      });
      return txRow;
    });
  }

  /** Sipariş oluşturulurken cari borç kaydı (aynı transaction içinde) */
  async addOrderDebitInTransaction(
    tx: Prisma.TransactionClient,
    customerId: string,
    orderId: string,
    amount: Prisma.Decimal,
  ) {
    await tx.customerTransaction.create({
      data: {
        customerId,
        type: AccountTransactionType.DEBIT,
        amount,
        description: `Sipariş borç kaydı (${orderId.slice(0, 8)}…)`,
      },
    });
    await tx.customerAccount.update({
      where: { customerId },
      data: { balance: { increment: amount } },
    });
  }
}
