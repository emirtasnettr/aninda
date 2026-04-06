"use client";

import type { LatLngExpression } from "leaflet";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-markercluster";
import "leaflet/dist/leaflet.css";
import "react-leaflet-markercluster/styles";
import type { Courier, Order, OrderStatus } from "@/lib/api/types";
import { assignOrder } from "@/lib/api/orders";
import {
  formatSlaCell,
  isOrderSlaBreached,
} from "@/lib/order-sla";
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
import { formatDateTimeTr } from "@/lib/format-date";
import { formatTry } from "@/lib/format-currency";
import { canAssignCourier } from "@/lib/auth-storage";
import { FitBoundsOnce } from "./fit-bounds-once";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { courierDisplayName } from "@/lib/courier-display-name";
import {
  opsCommandCourierCarIcon,
  orderDeliveryFinishIcon,
  pickupHomeIconEmphasis,
} from "./leaflet-div-icons";

export type OpsMapCourierMarker = {
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
): Record<string, OpsMapCourierMarker> {
  const m: Record<string, OpsMapCourierMarker> = {};
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

function fmtCoord(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

const ACTIVE_ORDER: OrderStatus[] = [
  "ACCEPTED",
  "PICKED_UP",
  "ON_DELIVERY",
];

function isOperationalOrder(o: Order): boolean {
  return (
    o.status !== "DELIVERED" &&
    o.status !== "CANCELLED"
  );
}

type OrderVisual = "delayed" | "active" | "pending";

function orderVisual(o: Order): OrderVisual {
  if (isOrderSlaBreached(o)) return "delayed";
  if (ACTIVE_ORDER.includes(o.status)) return "active";
  return "pending";
}

function courierStatusLabel(online: boolean, busy: boolean): string {
  if (!online) return "Çevrimdışı";
  if (busy) return "Çevrimiçi · Teslimatta";
  return "Çevrimiçi · Boşta";
}

function SmoothCourierMarker({
  m,
  activeCount,
}: {
  m: OpsMapCourierMarker;
  activeCount: number;
}) {
  const posRef = useRef<[number, number]>([m.lat, m.lng]);
  const [pos, setPos] = useState<[number, number]>(posRef.current);
  const busy = activeCount > 0;
  const icon = useMemo(
    () => opsCommandCourierCarIcon(m.isOnline, busy),
    [m.isOnline, busy],
  );

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const [a, b] = posRef.current;
      const na = a + (m.lat - a) * 0.28;
      const nb = b + (m.lng - b) * 0.28;
      const d = Math.hypot(m.lat - na, m.lng - nb);
      const next: [number, number] =
        d < 0.000025 ? [m.lat, m.lng] : [na, nb];
      posRef.current = next;
      setPos(next);
      if (d >= 0.000025) {
        raf = requestAnimationFrame(loop);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [m.lat, m.lng]);

  return (
    <Marker position={pos} icon={icon}>
      <Popup>
        <div className="min-w-[200px] space-y-1">
          <p className="text-sm font-semibold">
            {m.label || m.email.split("@")[0] || m.email}
          </p>
          {m.email ? (
            <p className="text-muted-foreground text-xs">{m.email}</p>
          ) : null}
          <Badge variant="outline" className="mt-1 text-[10px]">
            {courierStatusLabel(m.isOnline, busy)}
          </Badge>
          <p className="text-muted-foreground text-xs">
            Aktif sipariş:{" "}
            <span className="text-foreground font-medium tabular-nums">
              {activeCount}
            </span>
          </p>
          {m.at ? (
            <p className="text-muted-foreground text-[10px]">
              Konum: {formatDateTimeTr(m.at)}
            </p>
          ) : null}
        </div>
      </Popup>
    </Marker>
  );
}

function MapFlyTo({
  target,
  serial,
  zoom = 14,
}: {
  target: [number, number] | null;
  serial: number;
  zoom?: number;
}) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    map.flyTo(target, zoom, { duration: 0.55 });
  }, [map, target, serial, zoom]);
  return null;
}

export type MapFilterMode = "all" | "online_couriers" | "active_orders";

type OpsCommandMapInnerProps = {
  accessToken: string;
  initialCouriers: Courier[];
  initialOrders: Order[];
  focusCourierId?: string;
  focusOrderId?: string;
  userRole: string;
  onRefetch: () => Promise<void>;
};

export default function OpsCommandMapInner({
  accessToken,
  initialCouriers,
  initialOrders,
  focusCourierId,
  focusOrderId,
  userRole,
  onRefetch,
}: OpsCommandMapInnerProps) {
  const [markers, setMarkers] = useState<Record<string, OpsMapCourierMarker>>(
    () => buildCourierMarkers(initialCouriers),
  );
  const [filterMode, setFilterMode] = useState<MapFilterMode>("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [assignCourierId, setAssignCourierId] = useState("");
  const [assignBusy, setAssignBusy] = useState(false);
  const [assignErr, setAssignErr] = useState<string | null>(null);
  const [flyTo, setFlyTo] = useState<[number, number] | null>(null);
  const [flySerial, setFlySerial] = useState(0);
  const canAssign = canAssignCourier(userRole);

  useEffect(() => {
    setMarkers(buildCourierMarkers(initialCouriers));
  }, [initialCouriers]);

  useEffect(() => {
    if (!focusOrderId) return;
    const o = initialOrders.find((x) => x.id === focusOrderId);
    if (o) setSelectedOrder(o);
  }, [focusOrderId, initialOrders]);

  useEffect(() => {
    setSelectedOrder((cur) => {
      if (!cur) return cur;
      const fresh = initialOrders.find((o) => o.id === cur.id);
      return fresh ?? cur;
    });
  }, [initialOrders]);

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

  const activeByCourierId = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of initialOrders) {
      if (!ACTIVE_ORDER.includes(o.status)) continue;
      const cid = o.courierId;
      if (!cid) continue;
      m.set(cid, (m.get(cid) ?? 0) + 1);
    }
    return m;
  }, [initialOrders]);

  const visibleOrders = useMemo(() => {
    const base = initialOrders.filter(isOperationalOrder);
    if (filterMode === "active_orders") {
      return base.filter((o) => ACTIVE_ORDER.includes(o.status));
    }
    return base;
  }, [initialOrders, filterMode]);

  const courierRows = useMemo(() => {
    return initialCouriers
      .map((c) => ({
        c,
        m: markers[c.id],
        active: activeByCourierId.get(c.id) ?? 0,
      }))
      .sort((a, b) => {
        if (a.c.isOnline !== b.c.isOnline) return a.c.isOnline ? -1 : 1;
        return a.c.user.email.localeCompare(b.c.user.email);
      });
  }, [initialCouriers, markers, activeByCourierId]);

  const visibleCourierMarkers = useMemo(() => {
    return Object.values(markers).filter((m) => {
      if (filterMode === "online_couriers" && !m.isOnline) return false;
      return true;
    });
  }, [markers, filterMode]);

  const fitPoints = useMemo((): LatLngExpression[] => {
    const pts: LatLngExpression[] = [];
    for (const o of visibleOrders) {
      pts.push([o.deliveryLat, o.deliveryLng]);
    }
    for (const m of visibleCourierMarkers) {
      pts.push([m.lat, m.lng]);
    }
    if (focusCourierId) {
      const cm = markers[focusCourierId];
      if (cm) return [[cm.lat, cm.lng]];
      const ic = initialCouriers.find((x) => x.id === focusCourierId);
      if (ic?.lat != null && ic?.lng != null) {
        return [[ic.lat, ic.lng]];
      }
    }
    if (selectedOrder) {
      return [
        [selectedOrder.pickupLat, selectedOrder.pickupLng],
        [selectedOrder.deliveryLat, selectedOrder.deliveryLng],
      ];
    }
    return pts;
  }, [
    visibleOrders,
    visibleCourierMarkers,
    focusCourierId,
    markers,
    initialCouriers,
    selectedOrder,
  ]);

  const fitVersion = `${focusCourierId ?? ""}-${selectedOrder?.id ?? ""}-${filterMode}-${visibleOrders.length}-${visibleCourierMarkers.length}`;

  const assignable =
    selectedOrder &&
    (selectedOrder.status === "PENDING" ||
      selectedOrder.status === "SEARCHING_COURIER");

  const runAssign = useCallback(async () => {
    if (!selectedOrder || !assignCourierId || !canAssign) return;
    setAssignBusy(true);
    setAssignErr(null);
    try {
      await assignOrder(selectedOrder.id, assignCourierId);
      await onRefetch();
      setAssignCourierId("");
    } catch (e) {
      setAssignErr(e instanceof Error ? e.message : "Atama başarısız");
    } finally {
      setAssignBusy(false);
    }
  }, [selectedOrder, assignCourierId, canAssign, onRefetch]);

  const polylinePositions: LatLngExpression[] | null = selectedOrder
    ? [
        [selectedOrder.pickupLat, selectedOrder.pickupLng],
        [selectedOrder.deliveryLat, selectedOrder.deliveryLng],
      ]
    : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
      <div className="border-border/70 relative flex min-h-[min(520px,55vh)] flex-1 flex-col overflow-hidden rounded-xl border shadow-sm lg:min-h-[calc(100dvh-10rem)]">
        <div className="bg-background/95 supports-[backdrop-filter]:bg-background/80 flex flex-wrap items-center gap-2 border-b border-border/60 px-3 py-2 backdrop-blur">
          <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
            Görünüm
          </span>
          {(
            [
              ["all", "Tümü"],
              ["online_couriers", "Çevrimiçi kuryeler"],
              ["active_orders", "Aktif siparişler"],
            ] as const
          ).map(([key, label]) => (
            <Button
              key={key}
              type="button"
              size="sm"
              variant={filterMode === key ? "default" : "outline"}
              className={cn(
                "h-8 text-xs",
                filterMode === key && "shadow-sm",
              )}
              onClick={() => setFilterMode(key)}
            >
              {label}
            </Button>
          ))}
        </div>
        <div className="relative min-h-0 flex-1">
          <MapContainer
            center={[41.0082, 28.9784]}
            zoom={11}
            className="size-full min-h-[min(480px,50vh)] lg:min-h-0"
            scrollWheelZoom
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitBoundsOnce points={fitPoints} version={fitVersion} />
            <MapFlyTo target={flyTo} serial={flySerial} />
            {polylinePositions ? (
              <Polyline
                positions={polylinePositions}
                pathOptions={{
                  color: "#6366f1",
                  weight: 4,
                  opacity: 0.88,
                  dashArray: "10 6",
                }}
              />
            ) : null}
            <MarkerClusterGroup
              chunkedLoading
              animate
              animateAddingMarkers
              maxClusterRadius={72}
              spiderfyOnMaxZoom
            >
              {visibleCourierMarkers.map((m) => (
                <SmoothCourierMarker
                  key={m.courierId}
                  m={m}
                  activeCount={activeByCourierId.get(m.courierId) ?? 0}
                />
              ))}
            </MarkerClusterGroup>
            <MarkerClusterGroup
              chunkedLoading
              animate
              animateAddingMarkers
              maxClusterRadius={64}
              spiderfyOnMaxZoom
            >
              {visibleOrders.map((o) => {
                const vis = orderVisual(o);
                const finishIcon = orderDeliveryFinishIcon(vis);
                const homeIcon = pickupHomeIconEmphasis();
                const orderPopup = (
                  <div className="max-w-[240px] space-y-2">
                    <div>
                      <p className="text-muted-foreground text-[10px] font-semibold uppercase">
                        Sipariş
                      </p>
                      <p className="font-mono text-xs">{o.id.slice(0, 14)}…</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-[10px] font-semibold uppercase">
                        Müşteri
                      </p>
                      <p className="text-sm font-medium">
                        {o.customer?.email ?? "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-[10px] font-semibold uppercase">
                        Adres (koordinat)
                      </p>
                      <p className="text-xs leading-snug">
                        <span className="text-muted-foreground">Alış: </span>
                        {fmtCoord(o.pickupLat, o.pickupLng)}
                        <br />
                        <span className="text-muted-foreground">Teslimat: </span>
                        {fmtCoord(o.deliveryLat, o.deliveryLng)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Badge
                        variant={
                          vis === "delayed" ? "destructive" : "outline"
                        }
                        className="text-[10px]"
                      >
                        {vis === "delayed"
                          ? "Gecikmiş"
                          : vis === "active"
                            ? "Aktif"
                            : "Bekliyor"}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {orderStatusLabel(o.status)}
                      </Badge>
                    </div>
                    {canAssign &&
                    (o.status === "PENDING" ||
                      o.status === "SEARCHING_COURIER") ? (
                      <Button
                        type="button"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          setSelectedOrder(o);
                        }}
                      >
                        Kurye ata
                      </Button>
                    ) : null}
                    <Link
                      href={`/orders/${o.id}`}
                      className={cn(
                        buttonVariants({
                          variant: "outline",
                          size: "sm",
                        }),
                        "inline-flex w-full justify-center",
                      )}
                    >
                      Sipariş detayı
                    </Link>
                  </div>
                );
                return (
                  <Fragment key={o.id}>
                    <Marker
                      position={[o.pickupLat, o.pickupLng]}
                      icon={homeIcon}
                      eventHandlers={{
                        click: () => setSelectedOrder(o),
                      }}
                    >
                      <Popup>
                        <div className="max-w-[200px] space-y-1">
                          <p className="text-sm font-semibold">Alış noktası</p>
                          <p className="text-muted-foreground font-mono text-xs">
                            {fmtCoord(o.pickupLat, o.pickupLng)}
                          </p>
                          <p className="text-muted-foreground text-[10px]">
                            Bu sipariş seçildi; rota ve atama paneli güncellendi.
                          </p>
                        </div>
                      </Popup>
                    </Marker>
                    <Marker
                      position={[o.deliveryLat, o.deliveryLng]}
                      icon={finishIcon}
                      eventHandlers={{
                        click: () => setSelectedOrder(o),
                      }}
                    >
                      <Popup>{orderPopup}</Popup>
                    </Marker>
                  </Fragment>
                );
              })}
            </MarkerClusterGroup>
          </MapContainer>
        </div>
      </div>

      <aside className="border-border/70 bg-card flex w-full min-w-0 shrink-0 flex-col gap-4 rounded-xl border p-4 shadow-sm lg:min-w-[380px] lg:w-[min(100%,26rem)] lg:max-w-xl xl:w-[28rem] xl:max-w-none lg:overflow-y-auto">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">
            Seçili sipariş
          </h2>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Varış (bayrak) veya alış (ev) işaretine tıklayın; rota alış → varış
            çizilir.
          </p>
        </div>
        {selectedOrder ? (
          <div className="space-y-3 rounded-lg border border-border/60 bg-muted/10 p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono text-[10px]">
                {selectedOrder.id.slice(0, 12)}…
              </Badge>
              {orderVisual(selectedOrder) === "delayed" ? (
                <Badge variant="destructive" className="text-[10px]">
                  SLA gecikmesi
                </Badge>
              ) : null}
            </div>
            <p>
              <span className="text-muted-foreground">Müşteri: </span>
              <span className="font-medium">
                {selectedOrder.customer?.email ?? "—"}
              </span>
            </p>
            <p>
              <span className="text-muted-foreground">Durum: </span>
              {orderStatusLabel(selectedOrder.status)}
            </p>
            <p>
              <span className="text-muted-foreground">SLA: </span>
              {formatSlaCell(selectedOrder)}
            </p>
            <p>
              <span className="text-muted-foreground">Tutar: </span>
              {formatTry(selectedOrder.price)}
            </p>
            <div className="text-xs leading-relaxed">
              <p>
                <span className="text-muted-foreground">Alış: </span>
                {fmtCoord(
                  selectedOrder.pickupLat,
                  selectedOrder.pickupLng,
                )}
              </p>
              <p>
                <span className="text-muted-foreground">Teslimat: </span>
                {fmtCoord(
                  selectedOrder.deliveryLat,
                  selectedOrder.deliveryLng,
                )}
              </p>
            </div>
            {assignable && canAssign ? (
              <div className="space-y-2 border-t border-border/50 pt-3">
                <label className="text-xs font-medium" htmlFor="assign-c">
                  Hızlı atama
                </label>
                <select
                  id="assign-c"
                  className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                  value={assignCourierId}
                  onChange={(e) => setAssignCourierId(e.target.value)}
                >
                  <option value="">Kurye seçin</option>
                  {initialCouriers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {courierDisplayName(c)}
                      {c.isOnline ? " · çevrimiçi" : ""}
                    </option>
                  ))}
                </select>
                {assignErr ? (
                  <p className="text-destructive text-xs">{assignErr}</p>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  className="w-full"
                  disabled={!assignCourierId || assignBusy}
                  onClick={() => void runAssign()}
                >
                  {assignBusy ? "Atanıyor…" : "Kurye ata"}
                </Button>
              </div>
            ) : null}
            <Link
              href={`/orders/${selectedOrder.id}`}
              className={cn(
                buttonVariants({ variant: "secondary", size: "sm" }),
                "inline-flex w-full justify-center",
              )}
            >
              Operasyon sayfası
            </Link>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            Henüz seçim yok.
          </p>
        )}

        <div className="border-border/50 border-t pt-2">
          <h2 className="text-sm font-semibold tracking-tight">Kuryeler</h2>
          <p className="text-muted-foreground mt-0.5 mb-2 text-xs">
            Konumu olanlar; tıklayınca haritada odaklanır.
          </p>
          <ul className="max-h-[min(40vh,320px)] space-y-1 overflow-y-auto pr-1">
            {courierRows.map(({ c, m, active }) => (
              <li key={c.id}>
                <button
                  type="button"
                  disabled={!m}
                  onClick={() => {
                    if (!m) return;
                    setFlyTo([m.lat, m.lng]);
                    setFlySerial((s) => s + 1);
                  }}
                  className={cn(
                    "hover:bg-muted/60 flex w-full flex-col items-start rounded-lg border border-transparent px-2 py-2 text-left text-sm transition-colors",
                    m && "cursor-pointer",
                    !m && "opacity-50",
                  )}
                >
                  <span className="font-medium">
                    {courierDisplayName(c)}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {c.isOnline ? (
                      <span className="text-emerald-700 dark:text-emerald-400">
                        Çevrimiçi
                      </span>
                    ) : (
                      "Çevrimdışı"
                    )}
                    {active > 0 ? (
                      <span className="text-foreground">
                        {" "}
                        · {active} aktif sip.
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
