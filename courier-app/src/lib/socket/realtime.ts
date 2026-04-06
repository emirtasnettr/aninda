import { io, type Socket } from 'socket.io-client';
import { getApiBaseUrl } from '../api/config';
import type { JobRequestPayload } from '../api/types';

const WS_CLIENT_EVENTS = {
  COURIER_LOCATION_UPDATE: 'courier_location_update',
} as const;

export const WS_SERVER_EVENTS = {
  JOB_REQUEST: 'job_request',
  ORDER_ASSIGNED: 'order_assigned',
} as const;

let socket: Socket | null = null;

export function connectRealtimeSocket(accessToken: string): Socket {
  disconnectRealtimeSocket();
  socket = io(getApiBaseUrl(), {
    auth: { token: accessToken },
    transports: ['websocket'],
    autoConnect: true,
  });
  if (__DEV__) {
    socket.on('connect', () => {
      console.log('[WS] courier realtime bağlandı');
    });
    socket.on('connect_error', (err: Error) => {
      console.warn('[WS] bağlantı hatası — bildirimler gelmez:', err.message);
    });
  }
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

export function emitCourierLocation(courierId: string, lat: number, lng: number): void {
  socket?.emit(WS_CLIENT_EVENTS.COURIER_LOCATION_UPDATE, { courierId, lat, lng });
}

export function onJobRequest(cb: (payload: JobRequestPayload) => void): void {
  socket?.on('job_request', cb);
}

export function offJobRequest(cb: (payload: JobRequestPayload) => void): void {
  socket?.off('job_request', cb);
}
