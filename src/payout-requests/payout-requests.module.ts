import { Module } from '@nestjs/common';
import { PayoutRequestsController } from './payout-requests.controller';
import { PayoutRequestsService } from './payout-requests.service';

@Module({
  controllers: [PayoutRequestsController],
  providers: [PayoutRequestsService],
})
export class PayoutRequestsModule {}
