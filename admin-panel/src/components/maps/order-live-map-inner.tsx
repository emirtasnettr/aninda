"use client";

import type { LatLngExpression } from "leaflet";
import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import {
  connectRealtimeSocket,
  disconnectRealtimeSocket,
  joinOrderTracking,
  leaveOrderTracking,
  offCourierLocation,
  onCourierLocation,
  type CourierLocationPayload,
} from "@/lib/socket/realtime-client";
import { formatDateTimeTr } from "@/lib/format-date";
import {
  deliveryFinishIconStandard,
  orderLiveCourierCarIcon,
  pickupHomeIconEmphasis,
} from "./leaflet-div-icons";
import { FitBoundsOnce } from "./fit-bounds-once";

type OrderLiveMapInnerProps = {
  accessToken: string;
  orderId: string;
  pickup: { lat: number; lng: number };
  delivery: { lat: number; lng: number };
  courierId: string | null;
  /** Sunucudan gelen son bilinen kurye konumu (socket öncesi) */
  initialCourierPosition?: { lat: number; lng: number } | null;
};

export default function OrderLiveMapInner({
  accessToken,
  orderId,
  pickup,
  delivery,
  courierId,
  initialCourierPosition,
}: OrderLiveMapInnerProps) {
  const [live, setLive] = useState<CourierLocationPayload | null>(null);

  useEffect(() => {
    const sock = connectRealtimeSocket(accessToken);
    joinOrderTracking(orderId);

    const handler = (p: CourierLocationPayload) => {
      if (p.orderId === orderId) {
        setLive(p);
      }
    };
    onCourierLocation(handler);

    return () => {
      leaveOrderTracking(orderId);
      offCourierLocation(handler);
      disconnectRealtimeSocket();
      setLive(null);
    };
  }, [accessToken, orderId]);

  const courierPos =
    live != null
      ? { lat: live.lat, lng: live.lng }
      : initialCourierPosition ?? null;

  const points: LatLngExpression[] = useMemo(() => {
    const pts: LatLngExpression[] = [
      [pickup.lat, pickup.lng],
      [delivery.lat, delivery.lng],
    ];
    if (courierPos) {
      pts.push([courierPos.lat, courierPos.lng]);
    }
    return pts;
  }, [pickup, delivery, courierPos]);

  return (
    <div className="relative z-0 h-[340px] w-full overflow-hidden rounded-xl border border-border/60 md:h-[400px]">
      <MapContainer
        center={[pickup.lat, pickup.lng]}
        zoom={12}
        className="size-full"
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBoundsOnce
          points={points}
          version={courierPos ? `c-${courierId}` : "no-courier"}
        />
        <Marker
          position={[pickup.lat, pickup.lng]}
          icon={pickupHomeIconEmphasis()}
        >
          <Popup>Alış noktası</Popup>
        </Marker>
        <Marker
          position={[delivery.lat, delivery.lng]}
          icon={deliveryFinishIconStandard()}
        >
          <Popup>Varış noktası</Popup>
        </Marker>
        {courierId && courierPos ? (
          <Marker
            key={`${courierPos.lat}-${courierPos.lng}`}
            position={[courierPos.lat, courierPos.lng]}
            icon={orderLiveCourierCarIcon()}
          >
            <Popup>
              <span className="text-sm font-medium">Kurye</span>
              {live?.at ? (
                <div className="text-muted-foreground mt-1 text-xs">
                  {formatDateTimeTr(live.at)}
                </div>
              ) : (
                <div className="text-muted-foreground mt-1 text-xs">
                  Son bilinen konum
                </div>
              )}
            </Popup>
          </Marker>
        ) : null}
      </MapContainer>
    </div>
  );
}
