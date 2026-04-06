"use client";

import Link from "next/link";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import { Ban, ChevronDown, Search, UserPlus } from "lucide-react";
import { OrderOperationsDrawer } from "@/components/orders/order-operations-drawer";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchOrders, updateOrderStatus } from "@/lib/api/orders";
import type { Order, OrderStatus } from "@/lib/api/types";
import {
  canAssignCourier,
  isCustomerRole,
} from "@/lib/auth-storage";
import { formatDateTimeTr } from "@/lib/format-date";
import { formatTry } from "@/lib/format-currency";
import { haversineKm } from "@/lib/pricing/haversine";
import {
  formatSlaCell,
  isOrderSlaBreached,
} from "@/lib/order-sla";
import { orderOpsBadgeClass } from "@/lib/order-table-styles";
import { orderStatusLabel } from "@/lib/order-status";
import { useAuth } from "@/context/auth-context";
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

function orderRouteKm(o: Order): number {
  return haversineKm(
    o.pickupLat,
    o.pickupLng,
    o.deliveryLat,
    o.deliveryLng,
  );
}

function formatKmShort(km: number): string {
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

function startOfDay(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function endOfDay(d: Date): number {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x.getTime();
}

function OrdersListContent() {
  const { user, token } = useAuth();
  const searchParams = useSearchParams();
  const qFromUrl = searchParams.get("q") ?? "";
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState(qFromUrl);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [customerFilter, setCustomerFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [drawerOrderId, setDrawerOrderId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const customerUser = user && isCustomerRole(user.role);
  const canOps = user && canAssignCourier(user.role);

  useEffect(() => {
    const q = searchParams.get("q");
    if (q) setSearch(q);
  }, [searchParams]);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const data = await fetchOrders();
        if (!c) {
          setOrders(
            [...data].sort(
              (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime(),
            ),
          );
        }
      } catch (e) {
        if (!c) setErr(e instanceof Error ? e.message : "Liste yüklenemedi");
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  const customerOptions = useMemo(() => {
    if (!orders) return [];
    const emails = new Set<string>();
    for (const o of orders) {
      const e = o.customer?.email;
      if (e) emails.add(e);
    }
    return [...emails].sort();
  }, [orders]);

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (customerFilter !== "all") {
        const em = o.customer?.email ?? "";
        if (em !== customerFilter) return false;
      }
      if (dateFrom) {
        const t = new Date(dateFrom);
        if (Number.isNaN(t.getTime())) return false;
        if (new Date(o.createdAt).getTime() < startOfDay(t)) return false;
      }
      if (dateTo) {
        const t = new Date(dateTo);
        if (Number.isNaN(t.getTime())) return false;
        if (new Date(o.createdAt).getTime() > endOfDay(t)) return false;
      }
      if (q) {
        const idMatch = o.id.toLowerCase().includes(q);
        const em = (o.customer?.email ?? "").toLowerCase();
        if (!idMatch && !em.includes(q)) return false;
      }
      return true;
    });
  }, [orders, search, statusFilter, customerFilter, dateFrom, dateTo]);

  const drawerOrder = useMemo(
    () => orders?.find((o) => o.id === drawerOrderId) ?? null,
    [orders, drawerOrderId],
  );

  const patchOrderInList = useCallback((updated: Order) => {
    setOrders((prev) =>
      prev ? prev.map((x) => (x.id === updated.id ? updated : x)) : prev,
    );
  }, []);

  function openDrawer(o: Order) {
    setDrawerOrderId(o.id);
    setDrawerOpen(true);
  }

  async function handleStatusChange(o: Order, next: OrderStatus) {
    if (!canOps) return;
    setRowBusy(o.id);
    try {
      const updated = await updateOrderStatus(o.id, next);
      patchOrderInList(updated);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Durum güncellenemedi");
    } finally {
      setRowBusy(null);
    }
  }

  async function handleCancel(o: Order) {
    if (!canOps) return;
    if (!window.confirm("Bu sipariş iptal edilsin mi?")) return;
    await handleStatusChange(o, "CANCELLED");
  }

  async function bulkCancel() {
    if (!canOps || selectedIds.size === 0) return;
    if (
      !window.confirm(
        `${selectedIds.size} sipariş iptal edilecek. Onaylıyor musunuz?`,
      )
    ) {
      return;
    }
    setBulkBusy(true);
    try {
      for (const id of selectedIds) {
        const o = orders?.find((x) => x.id === id);
        if (
          !o ||
          o.status === "CANCELLED" ||
          o.status === "DELIVERED"
        ) {
          continue;
        }
        const updated = await updateOrderStatus(id, "CANCELLED");
        patchOrderInList(updated);
      }
      setSelectedIds(new Set());
    } catch (e) {
      alert(e instanceof Error ? e.message : "Toplu iptal başarısız");
    } finally {
      setBulkBusy(false);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function toggleSelectAllVisible() {
    const ids = filteredOrders.map((o) => o.id);
    const allSelected = ids.every((id) => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds((prev) => {
        const n = new Set(prev);
        for (const id of ids) n.delete(id);
        return n;
      });
    } else {
      setSelectedIds((prev) => {
        const n = new Set(prev);
        for (const id of ids) n.add(id);
        return n;
      });
    }
  }

  if (err) {
    return (
      <>
        <PageHeader title="Siparişler" />
        <div className="text-destructive rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm">
          {err}
        </div>
      </>
    );
  }

  if (orders === null) {
    return (
      <>
        <PageHeader title="Siparişler" />
        <Skeleton className="h-[480px] w-full rounded-2xl" />
      </>
    );
  }

  if (customerUser) {
    return (
      <>
        <PageHeader
          title="Siparişlerim"
          description="Teslimat talepleriniz."
        >
          <Link href="/orders/new" className={buttonVariants()}>
            Yeni sipariş
          </Link>
        </PageHeader>
        <Card className="rounded-2xl border-border/60 shadow-sm">
          <CardContent className="overflow-x-auto p-0">
            {orders.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  title="Henüz sipariş yok"
                  description="Yeni sipariş oluşturabilirsiniz."
                />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Durum</TableHead>
                    <TableHead>Tutar</TableHead>
                    <TableHead>Tarih</TableHead>
                    <TableHead className="text-right">İşlem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell>
                        <span
                          className={cn(
                            "rounded-md border px-2 py-0.5 text-xs font-semibold",
                            orderOpsBadgeClass(o.status),
                          )}
                        >
                          {orderStatusLabel(o.status)}
                        </span>
                      </TableCell>
                      <TableCell>{formatTry(o.price)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDateTimeTr(o.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/orders/${o.id}`}
                          className={buttonVariants({ size: "sm" })}
                        >
                          Detay
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </>
    );
  }

  const allVisibleSelected =
    filteredOrders.length > 0 &&
    filteredOrders.every((o) => selectedIds.has(o.id));

  return (
    <>
      <PageHeader
        title="Siparişler"
        description="Operasyon tablosu — filtre, toplu işlem ve hızlı atama."
      >
        <Link href="/orders/new" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Yeni sipariş
        </Link>
      </PageHeader>

      <Card className="mb-6 rounded-2xl border-border/60 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Filtreler</CardTitle>
          <CardDescription>
            {filteredOrders.length} / {orders.length} kayıt
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="q">Arama</Label>
            <div className="relative">
              <Search className="text-muted-foreground absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
              <Input
                id="q"
                placeholder="ID veya e-posta…"
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="st">Durum</Label>
            <select
              id="st"
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as OrderStatus | "all")
              }
            >
              <option value="all">Tüm durumlar</option>
              {ALL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {orderStatusLabel(s)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cust">Müşteri</Label>
            <select
              id="cust"
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
            >
              <option value="all">Tüm müşteriler</option>
              {customerOptions.map((em) => (
                <option key={em} value={em}>
                  {em}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:col-span-2 lg:col-span-1">
            <div className="space-y-2">
              <Label htmlFor="df">Başlangıç</Label>
              <Input
                id="df"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dt">Bitiş</Label>
              <Input
                id="dt"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {canOps && selectedIds.size > 0 ? (
        <div className="bg-destructive/5 border-destructive/20 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3">
          <p className="text-sm font-medium">
            {selectedIds.size} sipariş seçili
          </p>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={bulkBusy}
            onClick={() => void bulkCancel()}
          >
            <Ban className="size-3.5" />
            {bulkBusy ? "İşleniyor…" : "Seçilenleri iptal et"}
          </Button>
        </div>
      ) : null}

      <Card className="rounded-2xl border-border/60 shadow-sm">
        <CardContent className="overflow-x-auto p-0">
          {filteredOrders.length === 0 ? (
            <div className="p-10">
              <EmptyState
                title="Kayıt yok"
                description="Filtreleri değiştirin veya aramayı temizleyin."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {canOps ? (
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        className="size-4 rounded border-input"
                        checked={allVisibleSelected}
                        onChange={toggleSelectAllVisible}
                        aria-label="Tümünü seç"
                      />
                    </TableHead>
                  ) : null}
                  <TableHead>ID</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Müşteri</TableHead>
                  <TableHead>Kurye</TableHead>
                  <TableHead>Mesafe</TableHead>
                  <TableHead>SLA</TableHead>
                  <TableHead>Tutar</TableHead>
                  <TableHead>Tarih</TableHead>
                  <TableHead className="text-right min-w-[280px]">
                    İşlemler
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((o) => {
                  const delayed = isOrderSlaBreached(o);
                  const slaText = formatSlaCell(o);
                  const km = orderRouteKm(o);
                  const busy = rowBusy === o.id;
                  const assignable =
                    o.status === "PENDING" || o.status === "SEARCHING_COURIER";
                  return (
                    <TableRow
                      key={o.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openDrawer(o)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openDrawer(o);
                        }
                      }}
                      className={cn(
                        "cursor-pointer transition-colors",
                        drawerOrderId === o.id && "bg-primary/5",
                        delayed && "bg-red-50/80 dark:bg-red-950/25",
                        "hover:bg-muted/50",
                      )}
                    >
                      {canOps ? (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="size-4 rounded border-input"
                            checked={selectedIds.has(o.id)}
                            onChange={() => toggleSelect(o.id)}
                            aria-label="Seç"
                          />
                        </TableCell>
                      ) : null}
                      <TableCell className="font-mono text-[11px]">
                        {o.id.slice(0, 10)}…
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold",
                            orderOpsBadgeClass(o.status),
                          )}
                        >
                          {orderStatusLabel(o.status)}
                        </span>
                      </TableCell>
                      <TableCell className="min-w-[9rem] max-w-[240px] truncate text-sm">
                        {o.customer?.email ?? "—"}
                      </TableCell>
                      <TableCell className="min-w-[7rem] max-w-[180px] truncate text-sm">
                        {o.courier?.user?.email ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap text-sm tabular-nums">
                        {formatKmShort(km)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "whitespace-nowrap text-sm tabular-nums",
                          delayed && "font-semibold text-red-600 dark:text-red-400",
                        )}
                      >
                        {slaText}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm font-medium tabular-nums">
                        {formatTry(o.price)}
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap text-xs">
                        {formatDateTimeTr(o.createdAt)}
                      </TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          {canOps && assignable ? (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="h-8 gap-1 text-xs"
                              onClick={() => openDrawer(o)}
                            >
                              <UserPlus className="size-3.5" />
                              Kurye ata
                            </Button>
                          ) : null}
                          {canOps ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                className={cn(
                                  buttonVariants({
                                    variant: "outline",
                                    size: "sm",
                                    className: "h-8 gap-1 text-xs",
                                  }),
                                )}
                                disabled={busy}
                              >
                                Durum
                                <ChevronDown className="size-3.5 opacity-60" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="min-w-[200px]">
                                {ALL_STATUSES.map((s) => (
                                  <DropdownMenuItem
                                    key={s}
                                    disabled={s === o.status}
                                    onClick={() => void handleStatusChange(o, s)}
                                  >
                                    {orderStatusLabel(s)}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : null}
                          {canOps &&
                          o.status !== "CANCELLED" &&
                          o.status !== "DELIVERED" ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="text-destructive hover:bg-destructive/10 h-8 text-xs"
                              disabled={busy}
                              onClick={() => void handleCancel(o)}
                            >
                              <Ban className="size-3.5" />
                              İptal
                            </Button>
                          ) : null}
                          <Link
                            href={`/orders/${o.id}`}
                            className={buttonVariants({
                              variant: "default",
                              size: "sm",
                              className: "h-8 text-xs",
                            })}
                          >
                            Detay
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <OrderOperationsDrawer
        order={drawerOrder}
        open={drawerOpen && drawerOrder != null}
        onOpenChange={(v) => {
          setDrawerOpen(v);
          if (!v) setDrawerOrderId(null);
        }}
        token={token}
        canAssign={!!canOps}
        onOrderUpdated={patchOrderInList}
      />
    </>
  );
}

export default function OrdersListPage() {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="Siparişler" />
          <Skeleton className="h-[480px] w-full rounded-2xl" />
        </>
      }
    >
      <OrdersListContent />
    </Suspense>
  );
}
