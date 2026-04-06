import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PricingService } from './pricing.service';
import { CreatePricingRuleDto } from './dto/create-pricing-rule.dto';
import { UpdatePricingRuleDto } from './dto/update-pricing-rule.dto';
import { QuoteQueryDto } from './dto/quote-query.dto';
import { StaffQuoteQueryDto } from './dto/staff-quote-query.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';

@Controller('pricing')
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  @Get('rules')
  @Roles(
    Role.ADMIN,
    Role.OPERATIONS_MANAGER,
    Role.ACCOUNTING_SPECIALIST,
    Role.OPERATIONS_SPECIALIST,
  )
  listRules() {
    return this.pricing.findAllRules();
  }

  @Post('rules')
  @Roles(Role.ADMIN, Role.OPERATIONS_MANAGER, Role.ACCOUNTING_SPECIALIST)
  createRule(@Body() dto: CreatePricingRuleDto) {
    return this.pricing.createRule(dto);
  }

  @Patch('rules/:id')
  @Roles(Role.ADMIN, Role.OPERATIONS_MANAGER, Role.ACCOUNTING_SPECIALIST)
  updateRule(@Param('id') id: string, @Body() dto: UpdatePricingRuleDto) {
    return this.pricing.updateRule(id, dto);
  }

  @Delete('rules/:id')
  @Roles(Role.ADMIN, Role.OPERATIONS_MANAGER)
  deleteRule(@Param('id') id: string) {
    return this.pricing.deleteRule(id);
  }

  /** Giriş yapmış müşteri: kendi tarifesi + koordinatlarla sunucu fiyatı */
  @Get('me-quote')
  @Roles(Role.INDIVIDUAL_CUSTOMER, Role.CORPORATE_CUSTOMER)
  meQuote(@CurrentUser() me: AuthUser, @Query() q: QuoteQueryDto) {
    return this.pricing.quoteForUser(
      me.sub,
      q.pickupLat,
      q.pickupLng,
      q.deliveryLat,
      q.deliveryLng,
      { isPriority: q.priority === true },
    );
  }

  /** Personel: müşteri userId + koordinat ile fiyat önizleme */
  @Get('quote')
  @Roles(
    Role.ADMIN,
    Role.OPERATIONS_MANAGER,
    Role.OPERATIONS_SPECIALIST,
    Role.ACCOUNTING_SPECIALIST,
  )
  quote(@Query() q: StaffQuoteQueryDto) {
    return this.pricing.quoteForUser(
      q.userId,
      q.pickupLat,
      q.pickupLng,
      q.deliveryLat,
      q.deliveryLng,
      { isPriority: q.priority === true },
    );
  }
}
