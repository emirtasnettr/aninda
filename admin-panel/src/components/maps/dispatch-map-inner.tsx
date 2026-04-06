"use client";

import type { LatLngExpression } from "leaflet";
import L from "leaflet";
import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { Courier, Order } from "@/lib/api/types";
import { openStreetMapLink } from "@/lib/map-links";
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
import { customerDisplayName } from "@/lib/dispatch";
import { courierDisplayName } from "@/lib/courier-display-name";
import {
  deliveryFinishIconStandard,
  dispatchCourierCarIcon,
  pickupHomeIconEmphasis,
  pickupHomeIconMuted,
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

/** Seçili sipariş değişince haritayı odakla (zoom) */
function FlyToSelectedOrder({ order }: { order: Order | null }) {
  const map = useMap();
  useEffect(() => {
    if (!order) return;
    const b = L.latLngBounds(
      [order.pickupLat, order.pickupLng],
      [order.deliveryLat, order.deliveryLng],
    );
    map.fitBounds(b, {
      padding: [72, 72],
      maxZoom: 15,
      animate: true,
    });
  }, [map, order?.id]);
  return null;
}

type Props = {
  accessToken: string;
  couriers: Courier[];
  pinOrders: Order[];
  selectedOrder: Order | null;
  recommendedCourierId: string | null;
  layout?: "page" | "dispatchSplit";
};

export default function DispatchMapInner({
  accessToken,
  couriers,
  pinOrders,
  selectedOrder,
  recommendedCourierId,
  layout = "page",
}: Props) {
  const split = layout === "dispatchSplit";
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

  const boundsPoints: LatLngExpression[] = useMemo(() => {
    const pts: LatLngExpression[] = courierList.map(
      (m) => [m.lat, m.lng] as LatLngExpression,
    );
    for (const o of pinOrders) {
      pts.push([o.pickupLat, o.pickupLng]);
    }
    if (selectedOrder) {
      pts.push(
        [selectedOrder.pickupLat, selectedOrder.pickupLng],
        [selectedOrder.deliveryLat, selectedOrder.deliveryLng],
      );
    }
    return pts;
  }, [courierList, pinOrders, selectedOrder]);

  const fitVersion = `init-${pinOrders.length}-${courierList.length}`;

  const routeLine: LatLngExpression[] | null = selectedOrder
    ? [
        [selectedOrder.pickupLat, selectedOrder.pickupLng],
        [selectedOrder.deliveryLat, selectedOrder.deliveryLng],
      ]
    : null;

  return (
    <div
      className={
        split
          ? "relative z-0 flex h-full min-h-[min(440px,52vh)] w-full min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-[0_8px_30px_-12px_rgba(0,0,0,0.15)] xl:min-h-[calc(100dvh-10rem)] xl:max-h-[calc(100dvh-9rem)]"
          : "relative z-0 h-full min-h-[calc(100vh-12rem)] w-full overflow-hidden rounded-2xl border border-border/60 bg-card shadow-[0_8px_30px_-12px_rgba(0,0,0,0.15)] md:min-h-[calc(100vh-10rem)]"
      }
    >
      <MapContainer
        center={[41.0082, 28.9784]}
        zoom={11}
        className={
          split
            ? "z-0 min-h-0 w-full flex-1 !min-h-[min(400px,48vh)] xl:!min-h-0"
            : "size-full min-h-[calc(100vh-12rem)] md:min-h-[calc(100vh-10rem)]"
        }
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        <FitBoundsOnce points={boundsPoints} version={fitVersion} />
        <FlyToSelectedOrder order={selectedOrder} />

        {pinOrders
          .filter((o) => o.id !== selectedOrder?.id)
          .map((o) => (
            <Marker
              key={o.id}
              position={[o.pickupLat, o.pickupLng]}
              icon={pickupHomeIconMuted()}
            >
              <Popup>
                <div className="text-sm font-semibold">
                  {customerDisplayName(o)}
                </div>
                <div className="text-muted-foreground text-xs">
                  {orderStatusLabel(o.status)}
                </div>
              </Popup>
            </Marker>
          ))}

        {routeLine ? (
          <Polyline
            positions={routeLine}
            pathOptions={{
              color: "#6366f1",
              weight: 3,
              opacity: 0.85,
              dashArray: "8 10",
            }}
          />
        ) : null}

        {selectedOrder ? (
          <>
            <Marker
              position={[selectedOrder.pickupLat, selectedOrder.pickupLng]}
              icon={pickupHomeIconEmphasis()}
            >
              <Popup>
                <div className="text-sm font-semibold">Alış</div>
                <a
                  href={openStreetMapLink(
                    selectedOrder.pickupLat,
                    selectedOrder.pickupLng,
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 text-xs font-medium underline"
                >
                  Haritada aç
                </a>
              </Popup>
            </Marker>
            <Marker
              position={[selectedOrder.deliveryLat, selectedOrder.deliveryLng]}
              icon={deliveryFinishIconStandard()}
            >
              <Popup>
                <div className="text-sm font-semibold">Varış</div>
                <a
                  href={openStreetMapLink(
                    selectedOrder.deliveryLat,
                    selectedOrder.deliveryLng,
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 text-xs font-medium underline"
                >
                  Haritada aç
                </a>
              </Popup>
            </Marker>
          </>
        ) : null}

        {courierList.map((m) => {
          const isRec = m.courierId === recommendedCourierId;
          return (
            <Marker
              key={m.courierId}
              position={[m.lat, m.lng]}
              icon={dispatchCourierCarIcon(isRec, m.isOnline)}
            >
              <Popup>
                <div className="text-sm font-semibold">
                  {m.label || m.email.split("@")[0] || m.email}
                </div>
                {m.email ? (
                  <div className="text-muted-foreground text-xs">{m.email}</div>
                ) : null}
                {isRec ? (
                  <div className="mt-1 text-xs font-semibold text-emerald-700">
                    Önerilen kurye
                  </div>
                ) : null}
                <div className="text-muted-foreground mt-1 text-xs">
                  {m.isOnline ? "Çevrimiçi" : "Son konum"}
                </div>
                {m.at ? (
                  <div className="text-muted-foreground mt-1 text-[11px]">
                    {formatDateTimeTr(m.at)}
                  </div>
                ) : null}
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
      <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-2 text-[10px] font-medium text-foreground/80">
        <span className="rounded-full bg-background/95 px-2.5 py-1 shadow-sm backdrop-blur-sm">
          Alış · ev
        </span>
        <span className="rounded-full bg-background/95 px-2.5 py-1 shadow-sm backdrop-blur-sm">
          Kurye · araba
        </span>
        <span className="rounded-full bg-background/95 px-2.5 py-1 shadow-sm backdrop-blur-sm">
          Varış · bayrak
        </span>
        <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-emerald-800 shadow-sm backdrop-blur-sm dark:text-emerald-200">
          Önerilen
        </span>
      </div>
    </div>
  );
}
