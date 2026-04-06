"use client";

import type { LatLngExpression } from "leaflet";
import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { Courier, Order } from "@/lib/api/types";
import { formatDateTimeTr } from "@/lib/format-date";
import { orderStatusLabel } from "@/lib/order-status";
import {
  connectRealtimeSocket,
  disconnectRealtimeSocket,
  joinOpsMap,
  leaveOpsMap,
  offOpsCourierLocation,
  onOpsCourierLocation,
  type OpsCourierLocationPayload,
} from "@/lib/socket/realtime-client";
import { cn } from "@/lib/utils";
import { courierDisplayName } from "@/lib/courier-display-name";
import {
  dashboardCourierCarIcon,
  pickupHomeIconForStatus,
} from "./leaflet-div-icons";
import { FitBoundsOnce } from "./fit-bounds-once";

type CourierMarker = {
  courierId: string;
  lat: number;
  lng: number;
  email: string;
  label: string;
  at?: string;
  isOnline: boolean;
};

function buildCourierMarkers(couriers: Courier[]): Record<string, CourierMarker> {
  const m: Record<string, CourierMarker> = {};
  for (const c of couriers) {
    if (c.lat == null || c.lng == null) continue;
    m[c.id] = {
      courierId: c.id,
      lat: c.lat,
      lng: c.lng,
      email: c.user.email,
      label: courierDisplayName(c),
      isOnline: c.isOnline,
    };
  }
  return m;
}

function orderPinColor(status: Order["status"]): {
  border: string;
  fill: string;
} {
  switch (status) {
    case "PENDING":
      return { border: "#71717a", fill: "#a1a1aa" };
    case "SEARCHING_COURIER":
      return { border: "#2563eb", fill: "#3b82f6" };
    case "ACCEPTED":
    case "PICKED_UP":
    case "ON_DELIVERY":
      return { border: "#0d9488", fill: "#14b8a6" };
    default:
      return { border: "#52525b", fill: "#71717a" };
  }
}

type Props = {
  accessToken: string;
  couriers: Courier[];
  orders: Order[];
};

export default function DashboardOverviewMapInner({
  accessToken,
  couriers,
  orders,
}: Props) {
  const [markers, setMarkers] = useState<Record<string, CourierMarker>>(() =>
    buildCourierMarkers(couriers),
  );

  useEffect(() => {
    setMarkers(buildCourierMarkers(couriers));
  }, [couriers]);

  useEffect(() => {
    const sock = connectRealtimeSocket(accessToken);
    joinOpsMap();
    const handler = (p: OpsCourierLocationPayload) => {
      setMarkers((prev) => ({
        ...prev,
        [p.courierId]: {
          courierId: p.courierId,
          lat: p.lat,
          lng: p.lng,
          at: p.at,
          isOnline: true,
          email: prev[p.courierId]?.email ?? "",
          label:
            prev[p.courierId]?.label ||
            prev[p.courierId]?.email?.split("@")[0] ||
            "Kurye",
        },
      }));
    };
    onOpsCourierLocation(handler);
    return () => {
      offOpsCourierLocation(handler);
      leaveOpsMap();
      disconnectRealtimeSocket();
    };
  }, [accessToken]);

  const courierList = useMemo(() => Object.values(markers), [markers]);

  const liveOrders = useMemo(
    () =>
      orders.filter(
        (o) => o.status !== "DELIVERED" && o.status !== "CANCELLED",
      ),
    [orders],
  );

  const boundsPoints: LatLngExpression[] = useMemo(() => {
    const pts: LatLngExpression[] = courierList.map(
      (m) => [m.lat, m.lng] as LatLngExpression,
    );
    for (const o of liveOrders) {
      pts.push([o.pickupLat, o.pickupLng]);
      pts.push([o.deliveryLat, o.deliveryLng]);
    }
    return pts;
  }, [courierList, liveOrders]);

  const fitVersion = `${liveOrders.length}-${courierList.length}-${boundsPoints.length}`;

  return (
    <div
      className={cn(
        "relative z-0 w-full overflow-hidden rounded-2xl border border-border/60 bg-card",
        "shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-8px_rgba(0,0,0,0.12)]",
        "min-h-[40vh] md:min-h-[42vh]",
      )}
    >
      <MapContainer
        center={[41.0082, 28.9784]}
        zoom={11}
        className="size-full min-h-[40vh] md:min-h-[42vh]"
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        <FitBoundsOnce points={boundsPoints} version={fitVersion} />
        {liveOrders.map((o) => {
          const c = orderPinColor(o.status);
          return (
            <Marker
              key={o.id}
              position={[o.pickupLat, o.pickupLng]}
              icon={pickupHomeIconForStatus(c.border, c.fill)}
            >
              <Popup>
                <div className="text-sm font-semibold">
                  Sipariş · {orderStatusLabel(o.status)}
                </div>
                <div className="text-muted-foreground mt-1 font-mono text-[11px]">
                  {o.id.slice(0, 12)}…
                </div>
                <div className="text-muted-foreground mt-1 text-xs">
                  {o.customer?.email ?? "Müşteri"}
                </div>
                <div className="text-muted-foreground text-xs">
                  {formatDateTimeTr(o.createdAt)}
                </div>
              </Popup>
            </Marker>
          );
        })}
        {courierList.map((m) => (
          <Marker
            key={m.courierId}
            position={[m.lat, m.lng]}
            icon={dashboardCourierCarIcon(m.isOnline)}
          >
            <Popup>
              <div className="text-sm font-semibold">
                {m.label || m.email.split("@")[0] || m.email}
              </div>
              {m.email ? (
                <div className="text-muted-foreground text-xs">{m.email}</div>
              ) : null}
              <div className="text-muted-foreground mt-1 text-xs">
                {m.isOnline ? "Çevrimiçi kurye" : "Son konum"}
              </div>
              {m.at ? (
                <div className="text-muted-foreground mt-1 text-[11px]">
                  {formatDateTimeTr(m.at)}
                </div>
              ) : null}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-2 text-[10px] font-medium">
        <span className="rounded-full bg-background/90 px-2 py-1 shadow-sm backdrop-blur-sm">
          Alış · ev
        </span>
        <span className="rounded-full bg-background/90 px-2 py-1 shadow-sm backdrop-blur-sm">
          Kurye · araba
        </span>
      </div>
    </div>
  );
}
