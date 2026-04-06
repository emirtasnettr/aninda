"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ExternalLink, MapPin, Package, RefreshCw, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { OrderLiveMap } from "@/components/maps/order-live-map";
import { assignOrder, fetchOrder, updateOrderStatus } from "@/lib/api/orders";
import { fetchCouriers } from "@/lib/api/couriers";
import type { Courier, Order, OrderStatus } from "@/lib/api/types";
import {
  canAssignCourier,
  canJoinOrderTrackingSocket,
  isCustomerRole,
} from "@/lib/auth-storage";
import { courierDisplayName } from "@/lib/courier-display-name";
import { useAuth } from "@/context/auth-context";
import { formatDateTimeTr } from "@/lib/format-date";
import { formatTry } from "@/lib/format-currency";
import { openStreetMapLink } from "@/lib/map-links";
import { orderStatusLabel } from "@/lib/order-status";
import { cn } from "@/lib/utils";

const ALL_STATUSES: OrderStatus[] = [
  "PENDING",
  "SEARCHING_COURIER",
  "ACCEPTED",
  "PICKED_UP",
  "ON_DELIVERY",
  "DELIVERED",
  "CANCELLED",
];

export default function OrderDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : params.id?.[0];
  const { user, token } = useAuth();

  const [order, setOrder] = useState<Order | null>(null);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedCourier, setSelectedCourier] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusDraft, setStatusDraft] = useState<OrderStatus | null>(null);

  const canAssign = user && canAssignCourier(user.role);
  const customerView = user && isCustomerRole(user.role);
  const showLiveMap =
    Boolean(token && user && canJoinOrderTrackingSocket(user.role));
  const assignable =
    order &&
    (order.status === "PENDING" || order.status === "SEARCHING_COURIER");

  const load = useCallback(async () => {
    if (!id) return;
    setErr(null);
    try {
      const o = await fetchOrder(id);
      setOrder(o);
      setStatusDraft(o.status);
      if (user && canAssignCourier(user.role)) {
        const list = await fetchCouriers();
        setCouriers(list);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onAssign() {
    if (!id || !selectedCourier) return;
    setAssigning(true);
    try {
      const updated = await assignOrder(id, selectedCourier);
      setOrder(updated);
      setStatusDraft(updated.status);
      setAssignOpen(false);
      setSelectedCourier("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Atama başarısız");
    } finally {
      setAssigning(false);
    }
  }

  async function onStatusApply() {
    if (!id || !order || !statusDraft || statusDraft === order.status) return;
    setStatusUpdating(true);
    try {
      const updated = await updateOrderStatus(id, statusDraft);
      setOrder(updated);
      setStatusDraft(updated.status);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Durum güncellenemedi");
    } finally {
      setStatusUpdating(false);
    }
  }

  if (!id) {
    return <p className="text-destructive text-sm">Geçersiz sipariş</p>;
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48 rounded-lg" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (err && !order) {
    return (
      <div className="space-y-4">
        <p className="text-destructive text-sm">{err}</p>
        <Link href="/orders" className={cn(buttonVariants({ variant: "outline" }))}>
          Listeye dön
        </Link>
      </div>
    );
  }

  if (!order || !statusDraft) return null;

  const statusDirty = statusDraft !== order.status;

  return (
    <div className="w-full min-w-0 space-y-8 pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div>
          <Link
            href="/orders"
            className="text-muted-foreground hover:text-foreground mb-2 inline-flex items-center gap-1 text-sm"
          >
            ← Siparişler
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-3xl font-semibold tracking-tight">
              Sipariş detayı
            </h1>
            <Badge className="text-sm">{orderStatusLabel(order.status)}</Badge>
          </div>
          <p className="text-muted-foreground mt-1 font-mono text-xs">{order.id}</p>
        </div>
        {!customerView && canAssign ? (
          <div className="flex flex-wrap gap-2">
            {assignable ? (
              <Button
                type="button"
                className="gap-2 shadow-sm"
                onClick={() => setAssignOpen(true)}
              >
                <UserPlus className="size-4" />
                Kurye ata
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => {
                document
                  .getElementById("order-status-panel")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              <RefreshCw className="size-4" />
              Durum değiştir
            </Button>
          </div>
        ) : null}
      </div>

      {err ? (
        <p className="text-destructive bg-destructive/5 rounded-xl border border-destructive/20 p-4 text-sm">
          {err}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package className="size-5 opacity-70" />
              Müşteri ve tutar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs font-medium uppercase">
                Müşteri
              </p>
              <p className="mt-1 font-medium">
                {order.customer?.email ?? order.customerId}
              </p>
            </div>
            <Separator />
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-muted-foreground text-xs font-medium uppercase">
                  Tutar
                </p>
                <p className="mt-1 text-2xl font-bold tracking-tight">
                  {formatTry(order.price)}
                </p>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                Oluşturulma
                <br />
                <span className="text-foreground font-medium">
                  {formatDateTimeTr(order.createdAt)}
                </span>
              </div>
            </div>
            {order.deliveredAt ? (
              <>
                <Separator />
                <p className="text-muted-foreground text-xs">
                  Teslim zamanı:{" "}
                  <span className="text-foreground font-medium">
                    {formatDateTimeTr(order.deliveredAt)}
                  </span>
                </p>
              </>
            ) : null}
            {order.courierEarningAmount != null ||
            order.platformCommissionAmount != null ? (
              <>
                <Separator />
                <p className="text-muted-foreground text-xs font-medium uppercase">
                  Dağılım (sipariş anı)
                </p>
                <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                  {order.courierEarningAmount != null ? (
                    <div>
                      <p className="text-muted-foreground text-xs">Kurye kazancı</p>
                      <p className="font-semibold tabular-nums">
                        {formatTry(order.courierEarningAmount)}
                      </p>
                    </div>
                  ) : null}
                  {order.platformCommissionAmount != null ? (
                    <div>
                      <p className="text-muted-foreground text-xs">
                        Platform komisyonu
                      </p>
                      <p className="font-semibold tabular-nums">
                        {formatTry(order.platformCommissionAmount)}
                      </p>
                    </div>
                  ) : null}
                  {order.courierSharePercent != null ? (
                    <div className="sm:col-span-2">
                      <p className="text-muted-foreground text-xs">Kurye pay oranı</p>
                      <p className="font-medium tabular-nums">
                        {(Number(order.courierSharePercent) * 100).toFixed(1)}%
                      </p>
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MapPin className="size-5 opacity-70" />
              Adresler (koordinat)
            </CardTitle>
            <CardDescription>
              Adres metni yok; haritada görmek için OpenStreetMap bağlantısı.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
              <p className="text-muted-foreground text-xs font-semibold uppercase">
                Alış
              </p>
              <p className="mt-2 font-mono text-xs leading-relaxed">
                {order.pickupLat.toFixed(5)}, {order.pickupLng.toFixed(5)}
              </p>
              <a
                href={openStreetMapLink(order.pickupLat, order.pickupLng)}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({
                  variant: "link",
                  size: "sm",
                  className: "mt-2 h-auto px-0 text-xs",
                })}
              >
                Haritada aç
                <ExternalLink className="size-3" />
              </a>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
              <p className="text-muted-foreground text-xs font-semibold uppercase">
                Teslimat
              </p>
              <p className="mt-2 font-mono text-xs leading-relaxed">
                {order.deliveryLat.toFixed(5)}, {order.deliveryLng.toFixed(5)}
              </p>
              <a
                href={openStreetMapLink(order.deliveryLat, order.deliveryLng)}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({
                  variant: "link",
                  size: "sm",
                  className: "mt-2 h-auto px-0 text-xs",
                })}
              >
                Haritada aç
                <ExternalLink className="size-3" />
              </a>
            </div>
          </CardContent>
        </Card>
      </div>

      {showLiveMap && token ? (
        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle>Canlı takip</CardTitle>
            <CardDescription>
              {customerView
                ? "Alış, teslimat ve atanmış kuryenin anlık konumu."
                : "Operasyon: WebSocket ile güncellenen kurye konumu."}
            </CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle>Kurye</CardTitle>
            <CardDescription>
              {order.courier
                ? courierDisplayName(order.courier as Courier)
                : "Henüz atanmadı"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {order.courier ? (
              <>
                <p className="text-muted-foreground text-sm">
                  {order.courier.user?.email}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge>
                    {order.courier.isOnline ? "Çevrimiçi" : "Çevrimdışı"}
                  </Badge>
                  <Badge variant="secondary">{order.courier.type}</Badge>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">
                Bekleyen siparişlerde «Kurye ata» ile manuel atama yapılabilir.
              </p>
            )}
            {!customerView && canAssign && assignable ? (
              <Button
                type="button"
                variant="secondary"
                className="gap-2"
                onClick={() => setAssignOpen(true)}
              >
                <UserPlus className="size-4" />
                Kurye ata
              </Button>
            ) : null}
          </CardContent>
        </Card>

        {!customerView ? (
          <Card
            id="order-status-panel"
            className="border-border/80 shadow-sm ring-offset-background scroll-mt-24"
          >
            <CardHeader>
              <CardTitle>Durum</CardTitle>
              <CardDescription>
                Listeden yeni durum seçip «Durumu güncelle» ile kaydedin.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {canAssign ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="status">Sipariş durumu</Label>
                    <select
                      id="status"
                      className="border-input bg-background h-10 w-full max-w-md rounded-lg border px-3 text-sm shadow-sm"
                      disabled={statusUpdating}
                      value={statusDraft}
                      onChange={(e) =>
                        setStatusDraft(e.target.value as OrderStatus)
                      }
                    >
                      {ALL_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {orderStatusLabel(s)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button
                    type="button"
                    disabled={!statusDirty || statusUpdating}
                    className="gap-2"
                    onClick={() => void onStatusApply()}
                  >
                    <RefreshCw
                      className={cn("size-4", statusUpdating && "animate-spin")}
                    />
                    {statusUpdating ? "Kaydediliyor…" : "Durumu güncelle"}
                  </Button>
                </>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Durum değiştirmek için operasyon veya yönetim rolü gerekir.
                </p>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Kurye ata</DialogTitle>
            <DialogDescription>
              Sipariş beklemede veya kurye aranıyor iken atama yapılır; atama
              sonrası durum «Kabul edildi» olur.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="courier">Kurye</Label>
            <select
              id="courier"
              className="border-input bg-background h-10 w-full rounded-lg border px-3 text-sm shadow-sm"
              value={selectedCourier}
              onChange={(e) => setSelectedCourier(e.target.value)}
            >
              <option value="">Seçin…</option>
              {couriers.map((c) => (
                <option key={c.id} value={c.id}>
                  {courierDisplayName(c)}
                  {c.isOnline ? " (çevrimiçi)" : ""} — {c.type} · {c.user.email}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              onClick={() => setAssignOpen(false)}
            >
              İptal
            </Button>
            <Button
              type="button"
              disabled={!selectedCourier || assigning}
              onClick={() => void onAssign()}
            >
              {assigning ? "Atanıyor…" : "Ata"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
