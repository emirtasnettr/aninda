"use client";

import type { LatLngExpression } from "leaflet";
import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
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
import { courierDisplayName } from "@/lib/courier-display-name";
import {
  dashboardCourierCarIcon,
  deliveryFinishIconStandard,
  pickupHomeIconEmphasis,
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

function buildCourierMarkers(
  couriers: Courier[],
): Record<string, CourierMarker> {
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

type OperationsMapInnerProps = {
  accessToken: string;
  couriers: Courier[];
  selectedOrder: Order | null;
};

export default function OperationsMapInner({
  accessToken,
  couriers,
  selectedOrder,
}: OperationsMapInnerProps) {
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
    if (selectedOrder) {
      pts.push(
        [selectedOrder.pickupLat, selectedOrder.pickupLng],
        [selectedOrder.deliveryLat, selectedOrder.deliveryLng],
      );
    }
    return pts;
  }, [courierList, selectedOrder]);

  const fitVersion = `${selectedOrder?.id ?? "none"}-${courierList.length}-${boundsPoints.length}`;

  const routeLine: LatLngExpression[] | null = selectedOrder
    ? [
        [selectedOrder.pickupLat, selectedOrder.pickupLng],
        [selectedOrder.deliveryLat, selectedOrder.deliveryLng],
      ]
    : null;

  return (
    <div className="relative z-0 h-[min(420px,55vh)] w-full overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm md:h-[min(560px,70vh)]">
      <MapContainer
        center={[41.0082, 28.9784]}
        zoom={11}
        className="size-full"
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBoundsOnce points={boundsPoints} version={fitVersion} />
        {routeLine ? (
          <Polyline
            positions={routeLine}
            pathOptions={{
              color: "#a1a1aa",
              weight: 2,
              dashArray: "6 8",
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
                <div className="text-muted-foreground mt-1 max-w-[200px] font-mono text-xs">
                  {selectedOrder.pickupLat.toFixed(5)},{" "}
                  {selectedOrder.pickupLng.toFixed(5)}
                </div>
                <a
                  href={openStreetMapLink(
                    selectedOrder.pickupLat,
                    selectedOrder.pickupLng,
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-xs font-medium underline"
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
                <div className="text-muted-foreground mt-1 max-w-[200px] font-mono text-xs">
                  {selectedOrder.deliveryLat.toFixed(5)},{" "}
                  {selectedOrder.deliveryLng.toFixed(5)}
                </div>
                <a
                  href={openStreetMapLink(
                    selectedOrder.deliveryLat,
                    selectedOrder.deliveryLng,
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-xs font-medium underline"
                >
                  Haritada aç
                </a>
              </Popup>
            </Marker>
          </>
        ) : null}
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
                {m.isOnline ? "Çevrimiçi" : "Çevrimdışı (son konum)"}
              </div>
              {selectedOrder ? (
                <div className="text-muted-foreground mt-1 text-[11px]">
                  Seçili sipariş: {orderStatusLabel(selectedOrder.status)}
                </div>
              ) : null}
              {m.at ? (
                <div className="text-muted-foreground mt-1 text-xs">
                  {formatDateTimeTr(m.at)}
                </div>
              ) : null}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
