import { Module } from '@nestjs/common';
import { CourierEarningsService } from './courier-earnings.service';
import { CourierEarningsController } from './courier-earnings.controller';

@Module({
  controllers: [CourierEarningsController],
  providers: [CourierEarningsService],
  exports: [CourierEarningsService],
})
export class CourierEarningsModule {}
