import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { FinanceService } from './finance.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('finance')
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get('accounts')
  @Roles(Role.ADMIN, Role.ACCOUNTING_SPECIALIST, Role.OPERATIONS_MANAGER)
  accounts() {
    return this.finance.listAccounts();
  }

  @Get('accounts/:customerId')
  @Roles(Role.ADMIN, Role.ACCOUNTING_SPECIALIST, Role.OPERATIONS_MANAGER)
  account(@Param('customerId') customerId: string) {
    return this.finance.getAccountByCustomerId(customerId);
  }

  @Get('transactions')
  @Roles(Role.ADMIN, Role.ACCOUNTING_SPECIALIST, Role.OPERATIONS_MANAGER)
  transactions(@Query('customerId') customerId?: string) {
    return this.finance.listTransactions(customerId);
  }

  @Post('accounts/:customerId/transactions')
  @Roles(Role.ADMIN, Role.ACCOUNTING_SPECIALIST)
  addTransaction(
    @Param('customerId') customerId: string,
    @Body() dto: CreateTransactionDto,
  ) {
    return this.finance.createTransaction(customerId, dto);
  }
}
