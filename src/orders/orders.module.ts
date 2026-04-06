import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { OrderMatchingService } from './order-matching.service';
import { RealtimeModule } from '../realtime/realtime.module';
import { CustomersModule } from '../customers/customers.module';
import { PricingModule } from '../pricing/pricing.module';
import { FinanceModule } from '../finance/finance.module';
import { CourierEarningsModule } from '../courier-earnings/courier-earnings.module';
import { CourierPerformanceModule } from '../courier-performance/courier-performance.module';

@Module({
  imports: [
    RealtimeModule,
    CustomersModule,
    PricingModule,
    FinanceModule,
    CourierEarningsModule,
    CourierPerformanceModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrderMatchingService],
})
export class OrdersModule {}
