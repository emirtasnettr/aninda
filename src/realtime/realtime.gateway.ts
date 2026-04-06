import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { OrderStatus, Role } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { RealtimeBroadcasterService } from './realtime-broadcaster.service';
import {
  OPS_LIVE_MAP_ROOM,
  WS_CLIENT_EVENTS,
  courierRoomName,
  orderRoomName,
} from './realtime.events';
import { CourierLocationDto } from './dto/courier-location.dto';
import { OrderRoomDto } from './dto/order-room.dto';
import { WsAuthData, wsAuth } from './socket-auth.types';

/**
 * Bağlantı: JWT zorunlu (auth.token veya Authorization: Bearer).
 *
 * --- Müşteri örneği (order takibi) ---
 * ```ts
 * const socket = io('http://localhost:3000', {
 *   auth: { token: accessToken },
 * });
 * socket.emit('join_order_tracking', { orderId: '...' });
 * socket.on('courier_location', (p) => console.log(p));
 * ```
 *
 * --- Kurye örneği (konum + iş bildirimi) ---
 * ```ts
 * const socket = io('http://localhost:3000', { auth: { token: accessToken } });
 * // Bağlantıda otomatik courier:{courierId} odasına girer
 * socket.emit('courier_location_update', { courierId, lat, lng });
 * socket.on('job_request', (job) => console.log(job));
 * ```
 *
 * --- Operasyon canlı harita ---
 * ```ts
 * socket.emit('join_ops_map', {});
 * socket.on('ops_courier_location', (p) => console.log(p));
 * ```
 */
@WebSocketGateway({
  cors: { origin: true, credentials: true },
})
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly broadcaster: RealtimeBroadcasterService,
  ) {}

  afterInit(server: Server): void {
    this.broadcaster.bindServer(server);
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client);
      if (!token) {
        client.disconnect(true);
        return;
      }
      const secret = this.config.getOrThrow<string>('JWT_SECRET');
      const payload = this.jwt.verify<JwtPayload>(token, { secret });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, role: true },
      });
      if (!user) {
        client.disconnect(true);
        return;
      }

      const auth: WsAuthData = {
        userId: user.id,
        email: user.email,
        role: user.role,
      };

      if (user.role === Role.COURIER) {
        const courier = await this.prisma.courier.findUnique({
          where: { userId: user.id },
          select: { id: true },
        });
        if (courier) {
          auth.courierId = courier.id;
          await client.join(courierRoomName(courier.id));
        }
      }

      Object.assign(client.data, auth);

      this.logger.debug(
        `WS connected ${client.id} user=${user.id} role=${user.role}`,
      );
    } catch (e) {
      this.logger.warn(
        `WS reject ${client.id}: ${e instanceof Error ? e.message : e}`,
      );
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`WS disconnect ${client.id}`);
  }

  @SubscribeMessage(WS_CLIENT_EVENTS.COURIER_LOCATION_UPDATE)
  async onCourierLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: CourierLocationDto,
  ): Promise<{ ok: true }> {
    const auth = wsAuth(client);
    if (auth.role !== Role.COURIER) {
      throw new WsException('Only couriers can send location updates');
    }
    if (!auth.courierId || body.courierId !== auth.courierId) {
      throw new WsException('courierId does not match authenticated courier');
    }

    await this.prisma.courier.update({
      where: { id: body.courierId },
      data: { lat: body.lat, lng: body.lng },
    });

    const activeStatuses: OrderStatus[] = [
      OrderStatus.ACCEPTED,
      OrderStatus.PICKED_UP,
      OrderStatus.ON_DELIVERY,
    ];

    const orders = await this.prisma.order.findMany({
      where: {
        courierId: body.courierId,
        status: { in: activeStatuses },
      },
      select: { id: true },
    });

    const at = new Date().toISOString();
    for (const o of orders) {
      this.broadcaster.broadcastCourierLocation(o.id, {
        orderId: o.id,
        courierId: body.courierId,
        lat: body.lat,
        lng: body.lng,
        at,
      });
    }

    this.broadcaster.broadcastOpsCourierLocation({
      courierId: body.courierId,
      lat: body.lat,
      lng: body.lng,
      at,
    });

    return { ok: true };
  }

  @SubscribeMessage(WS_CLIENT_EVENTS.JOIN_ORDER_TRACKING)
  async onJoinOrder(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: OrderRoomDto,
  ): Promise<{ room: string }> {
    const auth = wsAuth(client);
    const role = auth.role;
    if (
      role !== Role.INDIVIDUAL_CUSTOMER &&
      role !== Role.CORPORATE_CUSTOMER &&
      role !== Role.ADMIN &&
      role !== Role.OPERATIONS_MANAGER &&
      role !== Role.OPERATIONS_SPECIALIST
    ) {
      throw new WsException('Not allowed to subscribe to order tracking');
    }

    const order = await this.prisma.order.findUnique({
      where: { id: body.orderId },
      select: { id: true, customerId: true },
    });
    if (!order) {
      throw new WsException('Order not found');
    }

    const isCustomer =
      role === Role.INDIVIDUAL_CUSTOMER || role === Role.CORPORATE_CUSTOMER;
    if (isCustomer && order.customerId !== auth.userId) {
      throw new WsException('You can only track your own orders');
    }

    const room = orderRoomName(body.orderId);
    await client.join(room);
    return { room };
  }

  @SubscribeMessage(WS_CLIENT_EVENTS.LEAVE_ORDER_TRACKING)
  async onLeaveOrder(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: OrderRoomDto,
  ): Promise<{ left: string }> {
    const room = orderRoomName(body.orderId);
    await client.leave(room);
    return { left: room };
  }

  @SubscribeMessage(WS_CLIENT_EVENTS.JOIN_OPS_MAP)
  async onJoinOpsMap(
    @ConnectedSocket() client: Socket,
  ): Promise<{ room: string }> {
    const auth = wsAuth(client);
    if (
      auth.role !== Role.ADMIN &&
      auth.role !== Role.OPERATIONS_MANAGER &&
      auth.role !== Role.OPERATIONS_SPECIALIST
    ) {
      throw new WsException('Not allowed to join operations map');
    }
    await client.join(OPS_LIVE_MAP_ROOM);
    return { room: OPS_LIVE_MAP_ROOM };
  }

  @SubscribeMessage(WS_CLIENT_EVENTS.LEAVE_OPS_MAP)
  async onLeaveOpsMap(
    @ConnectedSocket() client: Socket,
  ): Promise<{ ok: true }> {
    await client.leave(OPS_LIVE_MAP_ROOM);
    return { ok: true };
  }

  private extractToken(client: Socket): string | null {
    const fromAuth = client.handshake.auth as { token?: string } | undefined;
    if (fromAuth?.token && typeof fromAuth.token === 'string') {
      return fromAuth.token.replace(/^Bearer\s+/i, '');
    }
    const header = client.handshake.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      return header.slice(7);
    }
    return null;
  }
}
