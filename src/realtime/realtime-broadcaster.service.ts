import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import {
  OPS_LIVE_MAP_ROOM,
  WS_SERVER_EVENTS,
  courierRoomName,
  orderRoomName,
} from './realtime.events';

@Injectable()
export class RealtimeBroadcasterService {
  private readonly logger = new Logger(RealtimeBroadcasterService.name);
  private server: Server | null = null;

  bindServer(server: Server): void {
    this.server = server;
    this.logger.log('Socket.io server bound to RealtimeBroadcasterService');
  }

  emitToOrderRoom(orderId: string, event: string, payload: unknown): void {
    if (!this.server) {
      return;
    }
    this.server.to(orderRoomName(orderId)).emit(event, payload);
  }

  emitToCourierRoom(courierId: string, event: string, payload: unknown): void {
    if (!this.server) {
      return;
    }
    this.server.to(courierRoomName(courierId)).emit(event, payload);
  }

  /** Yeni sipariş teklifi — hedef kurye odasına */
  notifyJobRequest(
    courierId: string,
    payload: {
      orderId: string;
      pickupLat: number;
      pickupLng: number;
      deliveryLat: number;
      deliveryLng: number;
      price: string;
      status: string;
    },
  ): void {
    this.emitToCourierRoom(courierId, WS_SERVER_EVENTS.JOB_REQUEST, payload);
  }

  /** Manuel atama sonrası — atanan kurye odasına */
  notifyOrderAssigned(
    courierId: string,
    payload: {
      orderId: string;
      pickupLat: number;
      pickupLng: number;
      deliveryLat: number;
      deliveryLng: number;
      price: string;
      status: string;
    },
  ): void {
    this.emitToCourierRoom(courierId, WS_SERVER_EVENTS.ORDER_ASSIGNED, payload);
  }

  /** Takip odasına canlı konum */
  broadcastCourierLocation(
    orderId: string,
    payload: {
      orderId: string;
      courierId: string;
      lat: number;
      lng: number;
      at: string;
    },
  ): void {
    this.emitToOrderRoom(orderId, WS_SERVER_EVENTS.COURIER_LOCATION, payload);
  }

  /** Operasyon canlı harita odasına kurye konumu */
  broadcastOpsCourierLocation(payload: {
    courierId: string;
    lat: number;
    lng: number;
    at: string;
  }): void {
    if (!this.server) {
      return;
    }
    this.server
      .to(OPS_LIVE_MAP_ROOM)
      .emit(WS_SERVER_EVENTS.OPS_COURIER_LOCATION, payload);
  }
}
