import { Controller, Get } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ReportsService } from './reports.service';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('erp-overview')
  @Roles(Role.ADMIN, Role.OPERATIONS_MANAGER, Role.ACCOUNTING_SPECIALIST)
  overview() {
    return this.reports.erpOverview();
  }
}
