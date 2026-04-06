"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Clock,
  ExternalLink,
  MapPin,
  Navigation,
  Package,
  Route,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { DispatchMap } from "@/components/maps/dispatch-map";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { assignOrder, fetchOrders } from "@/lib/api/orders";
import { fetchCouriers } from "@/lib/api/couriers";
import type { Courier, Order, OrderStatus } from "@/lib/api/types";
import {
  canAssignCourier,
  canViewCouriers,
} from "@/lib/auth-storage";
import {
  courierToPickupKm,
  customerDisplayName,
  findRecommendedCourier,
  formatEtaMinutes,
  formatKm,
  orderRouteKm,
  sortCouriersForDispatch,
  etaPickupMinutes,
} from "@/lib/dispatch";
import { formatDateTimeTr } from "@/lib/format-date";
import { formatTry } from "@/lib/format-currency";
import { openStreetMapLink } from "@/lib/map-links";
import { orderStatusLabel } from "@/lib/order-status";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";
import { courierDisplayName } from "@/lib/courier-display-name";

const ACTIVE: OrderStatus[] = ["ACCEPTED", "PICKED_UP", "ON_DELIVERY"];

type OrderScope = "assign" | "active" | "all";

function statusBadgeClass(status: OrderStatus): string {
  switch (status) {
    case "PENDING":
      return "border-zinc-300 bg-zinc-100 text-zinc-800 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200";
    case "SEARCHING_COURIER":
      return "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200";
    case "DELIVERED":
      return "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200";
    case "CANCELLED":
      return "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200";
    default:
      return "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200";
  }
}

export default function OperationsPage() {
  const { user, token } = useAuth();
  const allowed = user && canViewCouriers(user.role);
  const canAssign = user && canAssignCourier(user.role);

  const [orders, setOrders] = useState<Order[] | null>(null);
  const [couriers, setCouriers] = useState<Courier[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [orderScope, setOrderScope] = useState<OrderScope>("assign");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedCourierId, setSelectedCourierId] = useState<string | null>(
    null,
  );
  const [assigning, setAssigning] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "ok" | "err";
    message: string;
  } | null>(null);

  const lastAutoAssignOrderRef = useRef<string | null>(null);

  useEffect(() => {
    if (!allowed) return;
    let c = false;
    (async () => {
      try {
        const [o, cr] = await Promise.all([fetchOrders(), fetchCouriers()]);
        if (!c) {
          setOrders(
            [...o].sort(
              (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime(),
            ),
          );
          setCouriers(
            [...cr].sort((a, b) => {
              if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
              return a.user.email.localeCompare(b.user.email);
            }),
          );
        }
      } catch (e) {
        if (!c) setErr(e instanceof Error ? e.message : "Veri alınamadı");
      }
    })();
    return () => {
      c = true;
    };
  }, [allowed]);

  const selectedOrder = useMemo(
    () => orders?.find((o) => o.id === selectedOrderId) ?? null,
    [orders, selectedOrderId],
  );

  const assignable =
    selectedOrder &&
    (selectedOrder.status === "PENDING" ||
      selectedOrder.status === "SEARCHING_COURIER");

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    if (orderScope === "assign") {
      return orders.filter(
        (o) => o.status === "PENDING" || o.status === "SEARCHING_COURIER",
      );
    }
    if (orderScope === "active") {
      return orders.filter((o) => ACTIVE.includes(o.status));
    }
    return orders;
  }, [orders, orderScope]);

  const recommended = useMemo(() => {
    if (!selectedOrder || !assignable) return null;
    return findRecommendedCourier(selectedOrder, couriers ?? []);
  }, [selectedOrder, assignable, couriers]);

  const recommendedId = recommended?.courier.id ?? null;

  useEffect(() => {
    if (!assignable || !selectedOrder) {
      setSelectedCourierId(null);
      lastAutoAssignOrderRef.current = null;
      return;
    }
    if (lastAutoAssignOrderRef.current === selectedOrder.id) return;
    lastAutoAssignOrderRef.current = selectedOrder.id;
    const r = findRecommendedCourier(selectedOrder, couriers ?? []);
    setSelectedCourierId(r?.courier.id ?? null);
  }, [assignable, selectedOrder, couriers]);

  const sortedCouriers = useMemo(
    () => sortCouriersForDispatch(selectedOrder, couriers ?? []),
    [selectedOrder, couriers],
  );

  async function onAssign() {
    if (!selectedOrder || !selectedCourierId || !assignable) return;
    setAssigning(true);
    setFeedback(null);
    try {
      const updated = await assignOrder(selectedOrder.id, selectedCourierId);
      setOrders((prev) =>
        prev ? prev.map((o) => (o.id === updated.id ? updated : o)) : prev,
      );
      setFeedback({ type: "ok", message: "Kurye atandı." });
    } catch (e) {
      setFeedback({
        type: "err",
        message: e instanceof Error ? e.message : "Atama başarısız",
      });
    } finally {
      setAssigning(false);
    }
  }

  function selectCourierManual(id: string) {
    lastAutoAssignOrderRef.current = selectedOrder?.id ?? null;
    setSelectedCourierId(id);
    setFeedback(null);
  }

  if (!allowed) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight">
            Dispatch merkezi
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Harita ve kurye ataması.
          </p>
        </header>
        <EmptyState
          title="Erişim yok"
          description="Bu ekran yalnızca operasyon ve yönetim rolleri içindir."
        />
      </div>
    );
  }

  if (err) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold tracking-tight">
          Dispatch merkezi
        </h1>
        <div className="text-destructive rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm">
          {err}
        </div>
      </div>
    );
  }

  if (orders === null || couriers === null || !token) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64 rounded-lg" />
        <Skeleton className="min-h-[70vh] w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-col gap-6 pb-8 md:gap-8 md:pb-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Dispatch merkezi
          </h1>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            Sipariş seçin, en yakın kuryeyi görün, tek tıkla atayın.
          </p>
        </div>
        <Link
          href="/orders"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Sipariş listesi
        </Link>
      </header>

      {feedback ? (
        <div
          className={cn(
            "rounded-xl border px-4 py-3 text-sm",
            feedback.type === "err"
              ? "border-destructive/30 bg-destructive/5 text-destructive"
              : "border-emerald-600/25 bg-emerald-600/5 text-emerald-800 dark:text-emerald-300",
          )}
        >
          {feedback.message}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-5 xl:flex-row xl:items-stretch xl:gap-6 2xl:gap-8">
        {/* SOL — sipariş listesi */}
        <aside className="order-1 flex min-h-0 w-full flex-col xl:order-none xl:w-[min(100%,22rem)] 2xl:w-[min(100%,26rem)] xl:shrink-0">
          <div className="mb-3 flex flex-wrap gap-2">
            {(
              [
                ["assign", "Atama bekleyen"],
                ["active", "Aktif"],
                ["all", "Tümü"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setOrderScope(key)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold transition-all",
                  orderScope === key
                    ? "border-foreground bg-foreground text-background shadow-md"
                    : "bg-background text-muted-foreground border-border hover:border-foreground/25 hover:bg-muted/40",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="border-border/60 bg-card/50 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border shadow-sm backdrop-blur-sm">
            <div className="text-muted-foreground border-b px-4 py-3 text-xs font-semibold tracking-wide uppercase">
              Siparişler · {filteredOrders.length}
            </div>
            <div className="min-h-[280px] flex-1 space-y-2 overflow-y-auto p-3 lg:max-h-[calc(100vh-11rem)]">
              {filteredOrders.length === 0 ? (
                <p className="text-muted-foreground py-12 text-center text-sm">
                  Bu görünümde sipariş yok.
                </p>
              ) : (
                filteredOrders.map((o) => {
                  const routeKm = orderRouteKm(o);
                  const sel = selectedOrderId === o.id;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => {
                        setSelectedOrderId(o.id);
                        setFeedback(null);
                      }}
                      className={cn(
                        "w-full rounded-xl border p-3.5 text-left transition-all duration-200",
                        "hover:border-primary/30 hover:shadow-md",
                        sel
                          ? "border-primary bg-primary/5 shadow-md ring-2 ring-primary/20"
                          : "border-border/80 bg-card",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate font-semibold leading-tight">
                          {customerDisplayName(o)}
                        </p>
                        <span
                          className={cn(
                            "shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-semibold",
                            statusBadgeClass(o.status),
                          )}
                        >
                          {orderStatusLabel(o.status)}
                        </span>
                      </div>
                      <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        <span className="inline-flex items-center gap-1">
                          <Route className="size-3.5 opacity-70" />
                          {formatKm(routeKm)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="size-3.5 opacity-70" />
                          {formatDateTimeTr(o.createdAt)}
                        </span>
                      </div>
                      <p className="text-muted-foreground mt-1 font-mono text-[10px]">
                        {o.id.slice(0, 10)}…
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </aside>

        {/* ORTA — harita (geniş alan) */}
        <div className="order-2 flex min-h-0 min-w-0 w-full flex-1 flex-col xl:order-none xl:min-h-[calc(100dvh-9.25rem)]">
          <DispatchMap
            accessToken={token}
            couriers={couriers}
            pinOrders={filteredOrders}
            selectedOrder={selectedOrder}
            recommendedCourierId={recommendedId}
            layout="dispatchSplit"
          />
        </div>

        {/* SAĞ — detay + kuryeler */}
        <aside className="order-3 flex min-h-0 w-full flex-col gap-4 xl:order-none xl:min-w-[380px] xl:w-[26rem] 2xl:w-[28rem] xl:max-w-[32rem] xl:shrink-0">
          <div className="border-border/60 bg-card flex flex-col overflow-hidden rounded-2xl border shadow-sm lg:max-h-[calc(100vh-11rem)]">
            <div className="text-muted-foreground border-b px-4 py-3 text-xs font-semibold tracking-wide uppercase">
              Seçili sipariş
            </div>
            <div className="min-h-[200px] flex-1 overflow-y-auto p-4">
              {!selectedOrder ? (
                <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 py-10 text-center text-sm">
                  <Package className="size-10 opacity-30" />
                  Soldan bir sipariş seçin.
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="text-2xl font-semibold tracking-tight">
                      {customerDisplayName(selectedOrder)}
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-sm">
                      {selectedOrder.customer?.email ?? "—"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span
                      className={cn(
                        "rounded-md border px-2.5 py-1 text-xs font-semibold",
                        statusBadgeClass(selectedOrder.status),
                      )}
                    >
                      {orderStatusLabel(selectedOrder.status)}
                    </span>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {formatTry(selectedOrder.price)}
                    </Badge>
                  </div>
                  <dl className="grid gap-2 text-sm">
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Güzergâh</dt>
                      <dd className="font-medium tabular-nums">
                        {formatKm(orderRouteKm(selectedOrder))}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Oluşturulma</dt>
                      <dd className="text-right">
                        {formatDateTimeTr(selectedOrder.createdAt)}
                      </dd>
                    </div>
                  </dl>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/orders/${selectedOrder.id}`}
                      className={buttonVariants({
                        variant: "outline",
                        size: "sm",
                        className: "gap-1",
                      })}
                    >
                      Detay
                      <ExternalLink className="size-3.5 opacity-70" />
                    </Link>
                    <a
                      href={openStreetMapLink(
                        selectedOrder.pickupLat,
                        selectedOrder.pickupLng,
                      )}
                      target="_blank"
                      rel="noreferrer"
                      className={buttonVariants({
                        variant: "ghost",
                        size: "sm",
                        className: "gap-1",
                      })}
                    >
                      <MapPin className="size-3.5" />
                      Alış
                    </a>
                    <a
                      href={openStreetMapLink(
                        selectedOrder.deliveryLat,
                        selectedOrder.deliveryLng,
                      )}
                      target="_blank"
                      rel="noreferrer"
                      className={buttonVariants({
                        variant: "ghost",
                        size: "sm",
                        className: "gap-1",
                      })}
                    >
                      <MapPin className="size-3.5" />
                      Teslim
                    </a>
                  </div>

                  {assignable && recommended ? (
                    <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/80 p-3 dark:border-emerald-900 dark:bg-emerald-950/40">
                      <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200">
                        <Sparkles className="size-4 shrink-0" />
                        <span className="text-xs font-bold tracking-wide uppercase">
                          Önerilen kurye
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-semibold">
                        {courierDisplayName(recommended.courier)}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {recommended.courier.user.email}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        Alışa {formatKm(recommended.km)} · tahmini varış{" "}
                        {formatEtaMinutes(recommended.etaMins)}
                      </p>
                    </div>
                  ) : assignable &&
                    !recommended &&
                    canAssign ? (
                    <p className="text-muted-foreground rounded-xl border border-dashed px-3 py-2 text-xs">
                      Çevrimiçi ve konumlu kurye yok; listeden manuel seçin.
                    </p>
                  ) : null}

                  {canAssign && assignable ? (
                    <Button
                      type="button"
                      size="lg"
                      disabled={assigning || !selectedCourierId}
                      className="h-14 w-full gap-2 text-base font-bold tracking-wide shadow-lg transition-transform hover:scale-[1.01] active:scale-[0.99]"
                      onClick={() => void onAssign()}
                    >
                      <UserPlus className="size-5" />
                      {assigning ? "Atanıyor…" : "KURYE ATA"}
                    </Button>
                  ) : selectedOrder && !assignable ? (
                    <p className="text-muted-foreground text-center text-xs">
                      Bu sipariş için manuel atama kapalı (durum uygun değil).
                    </p>
                  ) : !canAssign ? (
                    <p className="text-muted-foreground text-center text-xs">
                      Atama yetkiniz yok; salt izleme.
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          <div className="border-border/60 bg-card flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border shadow-sm">
            <div className="text-muted-foreground border-b px-4 py-3 text-xs font-semibold tracking-wide uppercase">
              Kuryeler
            </div>
            <div className="max-h-[min(420px,45vh)] space-y-2 overflow-y-auto p-3 lg:max-h-[min(380px,40vh)]">
              {sortedCouriers.map((c) => {
                const isRec = c.id === recommendedId;
                const isSel = c.id === selectedCourierId;
                const km =
                  selectedOrder && c.lat != null && c.lng != null
                    ? courierToPickupKm(c, selectedOrder)
                    : null;
                const eta =
                  km != null ? etaPickupMinutes(km) : null;
                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={!canAssign || !assignable}
                    onClick={() => {
                      if (!canAssign || !assignable) return;
                      selectCourierManual(c.id);
                    }}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-all duration-200",
                      !canAssign || !assignable
                        ? "cursor-default opacity-60"
                        : "hover:border-primary/25 hover:bg-muted/30 hover:shadow-sm",
                      isSel &&
                        "border-primary bg-primary/5 ring-2 ring-primary/15",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                        isSel
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/30",
                      )}
                    >
                      {isSel ? <Check className="size-3" strokeWidth={3} /> : null}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold">
                          {courierDisplayName(c)}
                        </p>
                        {isRec ? (
                          <span className="shrink-0 rounded-md bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold text-white uppercase">
                            Önerilen
                          </span>
                        ) : null}
                      </div>
                      <p className="text-muted-foreground truncate text-xs">
                        {c.user.email}
                      </p>
                      {selectedOrder && km != null ? (
                        <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 text-xs">
                          <span className="inline-flex items-center gap-1">
                            <Navigation className="size-3" />
                            Alışa {formatKm(km)}
                          </span>
                          <span className="text-foreground/80 font-medium">
                            ETA {formatEtaMinutes(eta ?? 0)}
                          </span>
                        </p>
                      ) : (
                        <p className="text-muted-foreground mt-1 text-xs">
                          {c.lat != null
                            ? "Sipariş seçin — mesafe hesaplanır"
                            : "Konum yok"}
                        </p>
                      )}
                      <p className="text-muted-foreground mt-0.5 text-[10px]">
                        {c.type}
                      </p>
                    </div>
                    {c.isOnline ? (
                      <Badge className="shrink-0 text-[10px]">Çevrimiçi</Badge>
                    ) : (
                      <Badge variant="secondary" className="shrink-0 text-[10px]">
                        Çevrimdışı
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
