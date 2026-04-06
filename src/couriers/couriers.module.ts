import { Module } from '@nestjs/common';
import { CourierPerformanceModule } from '../courier-performance/courier-performance.module';
import { CourierDocumentsService } from './courier-documents.service';
import { CouriersService } from './couriers.service';
import { CouriersController } from './couriers.controller';

@Module({
  imports: [CourierPerformanceModule],
  controllers: [CouriersController],
  providers: [CouriersService, CourierDocumentsService],
})
export class CouriersModule {}
