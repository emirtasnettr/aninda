import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CustomersService } from './customers.service';
import { UpdateCreditSettingsDto } from './dto/update-credit-settings.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @Roles(
    Role.ADMIN,
    Role.OPERATIONS_MANAGER,
    Role.OPERATIONS_SPECIALIST,
    Role.ACCOUNTING_SPECIALIST,
  )
  findAll() {
    return this.customers.findAllForStaff();
  }

  @Get(':id')
  @Roles(
    Role.ADMIN,
    Role.OPERATIONS_MANAGER,
    Role.OPERATIONS_SPECIALIST,
    Role.ACCOUNTING_SPECIALIST,
  )
  findOne(@Param('id') id: string) {
    return this.customers.findOne(id);
  }

  @Patch(':id/credit-settings')
  @Roles(Role.ADMIN)
  updateCreditSettings(
    @Param('id') id: string,
    @Body() dto: UpdateCreditSettingsDto,
  ) {
    return this.customers.updateCreditSettings(id, dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.OPERATIONS_MANAGER, Role.ACCOUNTING_SPECIALIST)
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.customers.update(id, dto);
  }

  @Get(':id/orders')
  @Roles(
    Role.ADMIN,
    Role.OPERATIONS_MANAGER,
    Role.OPERATIONS_SPECIALIST,
    Role.ACCOUNTING_SPECIALIST,
  )
  orders(@Param('id') id: string) {
    return this.customers.ordersForCustomer(id);
  }
}
