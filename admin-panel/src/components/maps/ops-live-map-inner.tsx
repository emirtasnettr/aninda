"use client";

import type { LatLngExpression } from "leaflet";
import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { Courier } from "@/lib/api/types";
import {
  connectRealtimeSocket,
  disconnectRealtimeSocket,
  joinOpsMap,
  leaveOpsMap,
  offOpsCourierLocation,
  onOpsCourierLocation,
  type OpsCourierLocationPayload,
} from "@/lib/socket/realtime-client";
import { formatDateTimeTr } from "@/lib/format-date";
import { courierDisplayName } from "@/lib/courier-display-name";
import { opsLiveCourierCarIcon } from "./leaflet-div-icons";
import { FitBoundsOnce } from "./fit-bounds-once";

export type OpsMapMarker = {
  courierId: string;
  lat: number;
  lng: number;
  email: string;
  label: string;
  at?: string;
  /** Son API verisi veya konum güncellemesi */
  isOnline: boolean;
};

function buildInitial(
  couriers: Courier[],
): Record<string, OpsMapMarker> {
  const m: Record<string, OpsMapMarker> = {};
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

type OpsLiveMapInnerProps = {
  accessToken: string;
  initialCouriers: Courier[];
  focusCourierId?: string;
};

export default function OpsLiveMapInner({
  accessToken,
  initialCouriers,
  focusCourierId,
}: OpsLiveMapInnerProps) {
  const [markers, setMarkers] = useState<Record<string, OpsMapMarker>>(() =>
    buildInitial(initialCouriers),
  );

  useEffect(() => {
    setMarkers(buildInitial(initialCouriers));
  }, [initialCouriers]);

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

  const list = useMemo(() => Object.values(markers), [markers]);
  const points: LatLngExpression[] = useMemo(
    () => list.map((m) => [m.lat, m.lng] as LatLngExpression),
    [list],
  );

  const fitPoints: LatLngExpression[] = useMemo(() => {
    if (!focusCourierId) return points;
    const m = markers[focusCourierId];
    if (m) return [[m.lat, m.lng] as LatLngExpression];
    const c = initialCouriers.find((x) => x.id === focusCourierId);
    if (c?.lat != null && c?.lng != null) {
      return [[c.lat, c.lng] as LatLngExpression];
    }
    return points;
  }, [focusCourierId, markers, points, initialCouriers]);

  const fitVersion = focusCourierId ?? "all";

  return (
    <div className="relative z-0 h-[min(520px,70vh)] w-full overflow-hidden rounded-xl border border-border/60">
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
        <FitBoundsOnce points={fitPoints} version={fitVersion} />
        {list.map((m) => (
          <Marker
            key={m.courierId}
            position={[m.lat, m.lng]}
            icon={opsLiveCourierCarIcon(m.isOnline)}
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
