import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ErpCustomerType, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCreditSettingsDto } from './dto/update-credit-settings.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { erpCustomerTypeFromRole, isCustomerRole } from './customer-erp.util';

const customerInclude = {
  user: { select: { id: true, email: true, role: true } },
  account: true,
} satisfies Prisma.CustomerInclude;

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Müşteri kullanıcısı için CRM kartı + cari hesap yoksa oluşturur.
   */
  async ensureCustomerForUser(
    tx: Prisma.TransactionClient,
    user: { id: string; email: string; role: Role },
  ) {
    if (!isCustomerRole(user.role)) {
      return null;
    }
    const existing = await tx.customer.findUnique({
      where: { userId: user.id },
    });
    if (existing) {
      return existing;
    }
    const customer = await tx.customer.create({
      data: {
        userId: user.id,
        name: user.email.split('@')[0] ?? 'Müşteri',
        email: user.email,
        type: erpCustomerTypeFromRole(user.role),
      },
    });
    await tx.customerAccount.create({
      data: {
        customerId: customer.id,
        balance: new Prisma.Decimal(0),
      },
    });
    return customer;
  }

  async findAllForStaff() {
    return this.prisma.customer.findMany({
      include: customerInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const c = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        ...customerInclude,
        pricingRules: { orderBy: { updatedAt: 'desc' } },
      },
    });
    if (!c) {
      throw new NotFoundException('Customer not found');
    }
    return c;
  }

  async update(id: string, dto: UpdateCustomerDto) {
    await this.findOne(id);
    return this.prisma.customer.update({
      where: { id },
      data: {
        ...dto,
        email: dto.email?.toLowerCase().trim(),
        ...(dto.type === ErpCustomerType.INDIVIDUAL
          ? { creditEnabled: false, creditLimit: null }
          : {}),
      },
      include: customerInclude,
    });
  }

  async updateCreditSettings(id: string, dto: UpdateCreditSettingsDto) {
    const c = await this.findOne(id);
    if (c.type !== ErpCustomerType.CORPORATE) {
      throw new BadRequestException(
        'Cari borç ayarları yalnızca kurumsal müşteriler için geçerlidir.',
      );
    }
    if (dto.creditEnabled) {
      if (dto.creditLimit == null) {
        throw new BadRequestException(
          'Borç izni açıkken pozitif bir kredi limiti gerekir.',
        );
      }
    }
    const creditLimit =
      dto.creditEnabled && dto.creditLimit != null
        ? new Prisma.Decimal(dto.creditLimit)
        : null;
    return this.prisma.customer.update({
      where: { id },
      data: {
        creditEnabled: dto.creditEnabled,
        creditLimit,
      },
      include: customerInclude,
    });
  }

  async ordersForCustomer(customerId: string) {
    const c = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { userId: true },
    });
    if (!c) {
      throw new NotFoundException('Customer not found');
    }
    return this.prisma.order.findMany({
      where: { customerId: c.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        courier: { include: { user: { select: { email: true } } } },
      },
    });
  }

  async getByUserId(userId: string) {
    return this.prisma.customer.findUnique({
      where: { userId },
      include: customerInclude,
    });
  }
}
