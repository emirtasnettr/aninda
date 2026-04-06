import { io, type Socket } from "socket.io-client";
import { getApiBaseUrl } from "@/lib/api/client";

const JOIN_ORDER = "join_order_tracking";
const LEAVE_ORDER = "leave_order_tracking";
const COURIER_LOCATION = "courier_location";
const JOIN_OPS_MAP = "join_ops_map";
const LEAVE_OPS_MAP = "leave_ops_map";
const OPS_COURIER_LOCATION = "ops_courier_location";

let socket: Socket | null = null;

export type CourierLocationPayload = {
  orderId: string;
  courierId: string;
  lat: number;
  lng: number;
  at: string;
};

export type OpsCourierLocationPayload = {
  courierId: string;
  lat: number;
  lng: number;
  at: string;
};

export function connectRealtimeSocket(accessToken: string): Socket {
  disconnectRealtimeSocket();
  socket = io(getApiBaseUrl(), {
    auth: { token: accessToken },
    transports: ["websocket"],
    autoConnect: true,
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

export function joinOrderTracking(orderId: string): void {
  socket?.emit(JOIN_ORDER, { orderId });
}

export function leaveOrderTracking(orderId: string): void {
  socket?.emit(LEAVE_ORDER, { orderId });
}

export function onCourierLocation(
  cb: (p: CourierLocationPayload) => void,
): void {
  socket?.on(COURIER_LOCATION, cb);
}

export function offCourierLocation(
  cb: (p: CourierLocationPayload) => void,
): void {
  socket?.off(COURIER_LOCATION, cb);
}

export function joinOpsMap(): void {
  socket?.emit(JOIN_OPS_MAP, {});
}

export function leaveOpsMap(): void {
  socket?.emit(LEAVE_OPS_MAP, {});
}

export function onOpsCourierLocation(
  cb: (p: OpsCourierLocationPayload) => void,
): void {
  socket?.on(OPS_COURIER_LOCATION, cb);
}

export function offOpsCourierLocation(
  cb: (p: OpsCourierLocationPayload) => void,
): void {
  socket?.off(OPS_COURIER_LOCATION, cb);
}
