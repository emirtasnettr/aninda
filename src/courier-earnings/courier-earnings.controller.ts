import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { CourierEarningStatus, Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CourierEarningsService } from './courier-earnings.service';
import { MarkPaidDto } from './dto/mark-paid.dto';

@Controller('courier-earnings')
export class CourierEarningsController {
  constructor(private readonly earnings: CourierEarningsService) {}

  @Get('me/summary')
  @Roles(Role.COURIER)
  mySummary(@CurrentUser() me: AuthUser) {
    return this.earnings.summaryForCourierUser(me.sub);
  }

  @Get('me')
  @Roles(Role.COURIER)
  myList(@CurrentUser() me: AuthUser) {
    return this.earnings.listForCourierUser(me.sub);
  }

  @Get('weekly-summary')
  @Roles(Role.ADMIN, Role.ACCOUNTING_SPECIALIST, Role.OPERATIONS_MANAGER)
  weekly(@Query('weekStart') weekStart: string) {
    return this.earnings.weeklySummary(weekStart);
  }

  @Get()
  @Roles(Role.ADMIN, Role.ACCOUNTING_SPECIALIST, Role.OPERATIONS_MANAGER)
  list(@Query('status') status?: CourierEarningStatus) {
    return this.earnings.list(status);
  }

  @Patch('mark-paid')
  @Roles(Role.ADMIN, Role.ACCOUNTING_SPECIALIST)
  markPaid(@Body() body: MarkPaidDto) {
    return this.earnings.markPaid(body.ids);
  }

  @Get(':id')
  @Roles(
    Role.ADMIN,
    Role.ACCOUNTING_SPECIALIST,
    Role.OPERATIONS_MANAGER,
    Role.COURIER,
  )
  findOne(@Param('id') id: string, @CurrentUser() me: AuthUser) {
    return this.earnings.findOne(id, me);
  }
}
