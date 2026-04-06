"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ExternalLink, MapPin, UserPlus } from "lucide-react";
import { OrderLiveMap } from "@/components/maps/order-live-map";
import { OrderStaticMiniMap } from "@/components/maps/order-static-mini-map";
import { Sheet } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { assignOrder as assignOrderApi } from "@/lib/api/orders";
import { fetchCouriers as fetchCouriersApi } from "@/lib/api/couriers";
import type { Courier, Order } from "@/lib/api/types";
import {
  findRecommendedCourier,
  formatEtaMinutes,
  formatKm,
  sortCouriersForDispatch,
  courierToPickupKm,
  etaPickupMinutes,
} from "@/lib/dispatch";
import { formatDateTimeTr } from "@/lib/format-date";
import { formatTry } from "@/lib/format-currency";
import { openStreetMapLink } from "@/lib/map-links";
import { orderStatusLabel } from "@/lib/order-status";
import { orderOpsBadgeClass } from "@/lib/order-table-styles";
import { cn } from "@/lib/utils";
import { courierDisplayName } from "@/lib/courier-display-name";

type Props = {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string | null;
  canAssign: boolean;
  onOrderUpdated: (o: Order) => void;
};

export function OrderOperationsDrawer({
  order,
  open,
  onOpenChange,
  token,
  canAssign,
  onOrderUpdated,
}: Props) {
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [loadingCouriers, setLoadingCouriers] = useState(false);
  const [selectedCourierId, setSelectedCourierId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const assignable =
    order &&
    (order.status === "PENDING" || order.status === "SEARCHING_COURIER");

  const loadCouriers = useCallback(async () => {
    if (!canAssign || !open) return;
    setLoadingCouriers(true);
    setErr(null);
    try {
      const list = await fetchCouriersApi();
      setCouriers(list);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Kuryeler yüklenemedi");
    } finally {
      setLoadingCouriers(false);
    }
  }, [canAssign, open]);

  useEffect(() => {
    void loadCouriers();
  }, [loadCouriers]);

  useEffect(() => {
    if (!order || !assignable) {
      setSelectedCourierId(null);
      return;
    }
    const r = findRecommendedCourier(order, couriers);
    setSelectedCourierId(r?.courier.id ?? null);
  }, [order?.id, assignable, couriers]);

  const sorted = useMemo(
    () => (order ? sortCouriersForDispatch(order, couriers) : []),
    [order, couriers],
  );

  async function onAssign() {
    if (!order || !selectedCourierId || !assignable) return;
    setAssigning(true);
    setErr(null);
    try {
      const updated = await assignOrderApi(order.id, selectedCourierId);
      onOrderUpdated(updated);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Atama başarısız");
    } finally {
      setAssigning(false);
    }
  }

  if (!order) return null;

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Sipariş"
      className="w-full max-w-xl sm:max-w-2xl lg:max-w-[40rem]"
    >
      <div className="space-y-5 p-4 pb-8">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs font-semibold",
                orderOpsBadgeClass(order.status),
              )}
            >
              {orderStatusLabel(order.status)}
            </span>
            <Badge variant="outline" className="font-mono text-[10px]">
              {formatTry(order.price)}
            </Badge>
          </div>
          <p className="mt-2 font-mono text-xs text-muted-foreground break-all">
            {order.id}
          </p>
          <p className="mt-1 text-lg font-semibold">
            {order.customer?.email ?? order.customerId.slice(0, 12)}
          </p>
          <p className="text-muted-foreground text-sm">
            {formatDateTimeTr(order.createdAt)}
          </p>
        </div>

        <div>
          <p className="text-muted-foreground mb-2 text-xs font-semibold uppercase tracking-wide">
            Harita
          </p>
          {token && order.courierId ? (
            <OrderLiveMap
              accessToken={token}
              orderId={order.id}
              pickup={{ lat: order.pickupLat, lng: order.pickupLng }}
              delivery={{ lat: order.deliveryLat, lng: order.deliveryLng }}
              courierId={order.courierId}
              initialCourierPosition={
                order.courier?.lat != null && order.courier?.lng != null
                  ? { lat: order.courier.lat, lng: order.courier.lng }
                  : null
              }
            />
          ) : (
            <OrderStaticMiniMap
              pickupLat={order.pickupLat}
              pickupLng={order.pickupLng}
              deliveryLat={order.deliveryLat}
              deliveryLng={order.deliveryLng}
            />
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/orders/${order.id}`}
            className={buttonVariants({ variant: "outline", size: "sm", className: "gap-1" })}
          >
            Tam detay
            <ExternalLink className="size-3.5 opacity-70" />
          </Link>
          <a
            href={openStreetMapLink(order.pickupLat, order.pickupLng)}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: "ghost", size: "sm", className: "gap-1" })}
          >
            <MapPin className="size-3.5" />
            Alış
          </a>
          <a
            href={openStreetMapLink(order.deliveryLat, order.deliveryLng)}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: "ghost", size: "sm", className: "gap-1" })}
          >
            <MapPin className="size-3.5" />
            Teslim
          </a>
        </div>

        {canAssign && assignable ? (
          <div className="rounded-xl border border-border/80 bg-muted/20 p-4">
            <p className="text-sm font-semibold">Kurye atama</p>
            {err ? (
              <p className="text-destructive mt-2 text-xs">{err}</p>
            ) : null}
            {loadingCouriers ? (
              <p className="text-muted-foreground mt-3 text-sm">Kuryeler yükleniyor…</p>
            ) : (
              <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto">
                {sorted.map((c) => {
                  const sel = c.id === selectedCourierId;
                  const km = courierToPickupKm(c, order);
                  const eta = km != null ? etaPickupMinutes(km) : null;
                  const rec =
                    findRecommendedCourier(order, couriers)?.courier.id === c.id;
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedCourierId(c.id)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                          sel
                            ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                            : "border-border/80 hover:bg-background",
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-4 shrink-0 items-center justify-center rounded-full border",
                            sel ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40",
                          )}
                        >
                          {sel ? <Check className="size-2.5" strokeWidth={3} /> : null}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-medium">
                              {courierDisplayName(c)}
                            </span>
                            {rec ? (
                              <span className="shrink-0 rounded bg-emerald-600 px-1 py-0.5 text-[8px] font-bold text-white uppercase">
                                Önerilen
                              </span>
                            ) : null}
                          </div>
                          {km != null ? (
                            <span className="text-muted-foreground text-xs">
                              {formatKm(km)} · ETA {formatEtaMinutes(eta ?? 0)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">Konum yok</span>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <Button
              type="button"
              className="mt-4 h-11 w-full gap-2 font-semibold"
              disabled={assigning || !selectedCourierId}
              onClick={() => void onAssign()}
            >
              <UserPlus className="size-4" />
              {assigning ? "Atanıyor…" : "KURYE ATA"}
            </Button>
          </div>
        ) : order.courier?.user?.email ? (
          <p className="text-muted-foreground text-sm">
            Kurye:{" "}
            <span className="text-foreground font-medium">
              {courierDisplayName(order.courier as Courier)}
            </span>
            <span className="text-muted-foreground block text-xs">
              {order.courier.user.email}
            </span>
          </p>
        ) : null}
      </div>
    </Sheet>
  );
}
