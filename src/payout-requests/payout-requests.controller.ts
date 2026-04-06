import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { PayoutRequestStatus, Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { MarkPayoutPaidDto } from './dto/mark-payout-paid.dto';
import { PayoutRequestsService } from './payout-requests.service';

@Controller('payout-requests')
export class PayoutRequestsController {
  constructor(private readonly payouts: PayoutRequestsService) {}

  @Post()
  @Roles(Role.COURIER)
  create(@CurrentUser() me: AuthUser) {
    return this.payouts.createForCourierUser(me.sub);
  }

  @Get('me')
  @Roles(Role.COURIER)
  listMine(@CurrentUser() me: AuthUser) {
    return this.payouts.listForCourierUser(me.sub);
  }

  @Get()
  @Roles(Role.ADMIN, Role.ACCOUNTING_SPECIALIST, Role.OPERATIONS_MANAGER)
  listAll(@Query('status') status?: PayoutRequestStatus) {
    return this.payouts.listAll(status);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.ACCOUNTING_SPECIALIST, Role.OPERATIONS_MANAGER)
  findOne(@Param('id') id: string) {
    return this.payouts.findOne(id);
  }

  @Patch(':id/approve')
  @Roles(Role.ADMIN, Role.ACCOUNTING_SPECIALIST)
  approve(@Param('id') id: string) {
    return this.payouts.approve(id);
  }

  @Patch(':id/reject')
  @Roles(Role.ADMIN, Role.ACCOUNTING_SPECIALIST)
  reject(@Param('id') id: string) {
    return this.payouts.reject(id);
  }

  @Patch(':id/mark-paid')
  @Roles(Role.ADMIN, Role.ACCOUNTING_SPECIALIST)
  markPaid(@Param('id') id: string, @Body() dto: MarkPayoutPaidDto) {
    return this.payouts.markPaid(id, dto.receiptUrl);
  }
}
