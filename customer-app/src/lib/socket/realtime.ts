import { io, type Socket } from 'socket.io-client';
import { getApiBaseUrl } from '../api/config';
import type { CourierLocationPayload } from '../api/types';

const JOIN = 'join_order_tracking';
const LEAVE = 'leave_order_tracking';
const LOCATION = 'courier_location';

let socket: Socket | null = null;

export function connectRealtimeSocket(accessToken: string): Socket {
  if (socket?.connected) {
    return socket;
  }
  disconnectRealtimeSocket();
  socket = io(getApiBaseUrl(), {
    auth: { token: accessToken },
    transports: ['websocket'],
  });
  return socket;
}

export function disconnectRealtimeSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}

export function getRealtimeSocket(): Socket | null {
  return socket;
}

export function joinOrderTracking(orderId: string): void {
  socket?.emit(JOIN, { orderId });
}

export function leaveOrderTracking(orderId: string): void {
  socket?.emit(LEAVE, { orderId });
}

export function onCourierLocation(cb: (p: CourierLocationPayload) => void): void {
  socket?.on(LOCATION, cb);
}

export function offCourierLocation(cb: (p: CourierLocationPayload) => void): void {
  socket?.off(LOCATION, cb);
}
