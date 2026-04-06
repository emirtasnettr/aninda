/** Socket.io room: yönetim / operasyon canlı kurye haritası */
export const OPS_LIVE_MAP_ROOM = 'ops:live_map';

/** İstemci → sunucu */
export const WS_CLIENT_EVENTS = {
  COURIER_LOCATION_UPDATE: 'courier_location_update',
  JOIN_ORDER_TRACKING: 'join_order_tracking',
  LEAVE_ORDER_TRACKING: 'leave_order_tracking',
  JOIN_OPS_MAP: 'join_ops_map',
  LEAVE_OPS_MAP: 'leave_ops_map',
} as const;

/** Sunucu → istemci */
export const WS_SERVER_EVENTS = {
  /** Sipariş odasına: kurye konumu */
  COURIER_LOCATION: 'courier_location',
  /** Operasyon harita odası: çevrimiçi kurye konum güncellemesi */
  OPS_COURIER_LOCATION: 'ops_courier_location',
  /** Kurye odasına: yeni iş teklifi (otomatik eşleştirme) */
  JOB_REQUEST: 'job_request',
  /** Kurye odasına: operasyon tarafından doğrudan atama */
  ORDER_ASSIGNED: 'order_assigned',
} as const;

export function orderRoomName(orderId: string): string {
  return `order:${orderId}`;
}

export function courierRoomName(courierId: string): string {
  return `courier:${courierId}`;
}
