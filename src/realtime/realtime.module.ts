import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeBroadcasterService } from './realtime-broadcaster.service';

@Module({
  imports: [AuthModule],
  providers: [RealtimeGateway, RealtimeBroadcasterService],
  exports: [RealtimeBroadcasterService],
})
export class RealtimeModule {}
