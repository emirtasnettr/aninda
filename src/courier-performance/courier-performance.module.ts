import { Module } from '@nestjs/common';
import { CourierPerformanceService } from './courier-performance.service';

@Module({
  providers: [CourierPerformanceService],
  exports: [CourierPerformanceService],
})
export class CourierPerformanceModule {}
