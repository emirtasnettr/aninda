"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Banknote,
  MapPin,
  Package,
  RefreshCw,
  Star,
  Truck,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  fetchCourierDetail,
  patchCourierOnline,
} from "@/lib/api/couriers";
import type { CourierDetailResponse, CourierOpsState } from "@/lib/api/types";
import { canViewCouriers } from "@/lib/auth-storage";
import { formatDateTimeTr } from "@/lib/format-date";
import { formatTry } from "@/lib/format-currency";
import { orderStatusLabel } from "@/lib/order-status";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";
import { courierDisplayName } from "@/lib/courier-display-name";
import { useParams, useRouter } from "next/navigation";

function vehicleLabel(type: string): string {
  if (type === "MOTORCYCLE") return "Motosiklet";
  if (type === "CAR") return "Otomobil";
  return type;
}

function StarDisplay({ value }: { value: number | null }) {
  if (value == null || Number.isNaN(value)) {
    return (
      <span className="text-muted-foreground text-sm">Henüz müşteri puanı yok</span>
    );
  }
  const rounded = Math.min(5, Math.max(1, Math.round(value)));
  return (
    <div className="flex items-center gap-1" aria-label={`${value.toFixed(1)} / 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(
            "size-6",
            i <= rounded
              ? "fill-amber-400 text-amber-500"
              : "text-muted-foreground/25",
          )}
        />
      ))}
      <span className="text-muted-foreground ml-2 text-sm tabular-nums">
        {value.toFixed(1)} / 5
      </span>
    </div>
  );
}

function opsStateLabel(s: CourierOpsState): string {
  switch (s) {
    case "offline":
      return "Çevrimdışı";
    case "online_idle":
      return "Çevrimiçi · Boşta";
    case "online_busy":
      return "Çevrimiçi · Teslimatta";
    default:
      return s;
  }
}

export default function CourierDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";
  const { user } = useAuth();
  const allowed = user && canViewCouriers(user.role);

  const [data, setData] = useState<CourierDetailResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggleBusy, setToggleBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id || !allowed) return;
    setLoading(true);
    setErr(null);
    try {
      const d = await fetchCourierDetail(id);
      setData(d);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Yüklenemedi");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [id, allowed]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (user && !allowed) router.replace("/dashboard");
  }, [user, allowed, router]);

  async function onToggleOnline(next: boolean) {
    if (!id) return;
    setToggleBusy(true);
    setErr(null);
    try {
      await patchCourierOnline(id, { isOnline: next });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Güncellenemedi");
    } finally {
      setToggleBusy(false);
    }
  }

  if (!allowed) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const c = data?.courier;

  return (
    <div className="space-y-8 pb-12">
      <PageHeader
        title={c ? courierDisplayName(c) : "Kurye detayı"}
        description={
          c
            ? `${c.user.email} · Profil, aktif işler, geçmiş ve performans`
            : "Profil, aktif işler, geçmiş ve performans"
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/couriers"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "gap-1.5",
            )}
          >
            <ArrowLeft className="size-3.5" />
            Listeye dön
          </Link>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-1.5"
            disabled={loading || !id}
            onClick={() => void load()}
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            Yenile
          </Button>
          {c ? (
            <Link
              href={`/couriers/map?focus=${encodeURIComponent(c.id)}`}
              className={cn(
                buttonVariants({ variant: "secondary", size: "sm" }),
                "gap-1.5",
              )}
            >
              <MapPin className="size-3.5" />
              Haritada göster
            </Link>
          ) : null}
        </div>
      </PageHeader>

      {err ? (
        <p className="text-destructive text-sm">{err}</p>
      ) : null}

      {loading && !data ? (
        <Skeleton className="h-96 w-full rounded-2xl" />
      ) : !data ? (
        <p className="text-muted-foreground text-sm">Kayıt bulunamadı.</p>
      ) : (
        <>
          <div className="grid gap-5 lg:grid-cols-3">
            <Card className="border-border/80 rounded-2xl shadow-sm lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Truck className="size-4 opacity-60" />
                  Profil
                </CardTitle>
                <CardDescription>Temel bilgiler ve çevrimiçi durumu</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground">Ad soyad</dt>
                    <dd className="mt-1 font-medium">
                      {courierDisplayName(data.courier)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">E-posta</dt>
                    <dd className="mt-1 font-medium">{data.courier.user.email}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Araç tipi</dt>
                    <dd className="mt-1">
                      <Badge variant="outline">
                        {vehicleLabel(data.courier.type)}
                      </Badge>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Operasyon durumu</dt>
                    <dd className="mt-1">
                      <Badge
                        variant={
                          data.opsState === "offline" ? "secondary" : "default"
                        }
                        className={cn(
                          data.opsState === "online_idle" &&
                            "border-emerald-600/30 bg-emerald-600 text-white",
                          data.opsState === "online_busy" &&
                            "border-sky-600/30 bg-sky-600 text-white",
                        )}
                      >
                        {opsStateLabel(data.opsState)}
                      </Badge>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Son konum</dt>
                    <dd className="mt-1 font-mono text-xs">
                      {data.courier.lat != null && data.courier.lng != null
                        ? `${data.courier.lat.toFixed(5)}, ${data.courier.lng.toFixed(5)}`
                        : "—"}
                    </dd>
                  </div>
                </dl>
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 px-4 py-3">
                  <span className="text-sm font-medium">Panelden çevrimiçi</span>
                  <Switch
                    checked={data.courier.isOnline}
                    disabled={toggleBusy}
                    onCheckedChange={(v) => void onToggleOnline(v)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/80 rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Banknote className="size-4 opacity-60" />
                  Kazanç özeti
                </CardTitle>
                <CardDescription>Hakediş kayıtları</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Toplam</span>
                  <span className="font-semibold tabular-nums">
                    {formatTry(data.stats.totalEarningsTry)}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Bekleyen ödeme</span>
                  <span className="font-medium tabular-nums text-amber-700 dark:text-amber-400">
                    {formatTry(data.stats.pendingEarningsTry)}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Kayıt adedi</span>
                  <span className="tabular-nums">
                    {data.stats.totalEarningRows}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Aktif sipariş</span>
                  <span className="tabular-nums">
                    {data.stats.activeOrdersCount}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card
            className={cn(
              "border-border/80 rounded-2xl shadow-sm",
              data.isLowPerformance &&
                "border-destructive/60 bg-destructive/[0.04] ring-1 ring-destructive/20",
            )}
          >
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Puan ve operasyon skoru</CardTitle>
                  <CardDescription>
                    Müşteri yıldızları, teslimat metrikleri ve dispatch sıralamasında
                    kullanılan skor (0–100)
                  </CardDescription>
                </div>
                {data.isLowPerformance ? (
                  <Badge variant="destructive">Düşük performans</Badge>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                    Ortalama puan
                  </p>
                  <div className="mt-2">
                    <StarDisplay
                      value={
                        data.ratingSummary.averageRating != null
                          ? Number(data.ratingSummary.averageRating)
                          : null
                      }
                    />
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {data.ratingSummary.totalRatings} değerlendirme
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 bg-card px-4 py-3 text-center sm:min-w-[140px]">
                  <p className="text-muted-foreground text-xs">Dispatch skoru</p>
                  <p className="text-foreground mt-1 text-3xl font-bold tabular-nums">
                    {Number(data.ratingSummary.dispatchScore).toFixed(0)}
                  </p>
                  <p className="text-muted-foreground text-[11px]">100 üzerinden</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
                  <p className="text-muted-foreground text-xs">Toplam kapanan iş</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums">
                    {data.performanceMetrics.totalDeliveries}
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
                  <p className="text-muted-foreground text-xs">Başarılı teslimat</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                    {data.performanceMetrics.successfulDeliveries}
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
                  <p className="text-muted-foreground text-xs">İptal (atanmış)</p>
                  <p
                    className={cn(
                      "mt-1 text-xl font-semibold tabular-nums",
                      data.performanceMetrics.cancelledDeliveries > 0 &&
                        "text-destructive",
                    )}
                  >
                    {data.performanceMetrics.cancelledDeliveries}
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
                  <p className="text-muted-foreground text-xs">Başarı oranı</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums">
                    {data.performanceMetrics.successRate != null
                      ? `${(data.performanceMetrics.successRate * 100).toFixed(0)}%`
                      : "—"}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border/60 px-4 py-3 text-sm">
                  <span className="text-muted-foreground">Ortalama teslim süresi</span>
                  <span className="ml-2 font-semibold tabular-nums">
                    {data.performanceMetrics.averageDeliveryTimeMinutes != null
                      ? `${Number(data.performanceMetrics.averageDeliveryTimeMinutes).toFixed(0)} dk`
                      : "—"}
                  </span>
                </div>
                <div className="rounded-xl border border-border/60 px-4 py-3 text-sm">
                  <span className="text-muted-foreground">Son aktiflik</span>
                  <span className="ml-2 font-medium">
                    {data.performanceMetrics.lastActiveAt
                      ? formatDateTimeTr(data.performanceMetrics.lastActiveAt)
                      : "—"}
                  </span>
                </div>
              </div>

              {data.recentRatings.length > 0 ? (
                <div>
                  <p className="text-muted-foreground mb-2 text-sm font-medium">
                    Son değerlendirmeler
                  </p>
                  <div className="overflow-x-auto rounded-xl border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tarih</TableHead>
                          <TableHead>Puan</TableHead>
                          <TableHead>Sipariş</TableHead>
                          <TableHead>Yorum</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.recentRatings.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className="text-muted-foreground whitespace-nowrap text-xs">
                              {formatDateTimeTr(r.createdAt)}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-0.5">
                                {Array.from({ length: r.rating }, (_, i) => (
                                  <Star
                                    key={i}
                                    className="size-3.5 fill-amber-400 text-amber-500"
                                  />
                                ))}
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {r.orderId.slice(0, 10)}…
                            </TableCell>
                            <TableCell className="max-w-[280px] truncate text-sm">
                              {r.comment ?? "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-border/80 rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Performans (14 gün)</CardTitle>
              <CardDescription>
                Günlük teslimat sayısı ve kazanç (İstanbul günü)
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.performanceSeries}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10 }}
                    tickMargin={8}
                  />
                  <YAxis yAxisId="left" tick={{ fontSize: 10 }} width={32} />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 10 }}
                    width={40}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid hsl(var(--border))",
                    }}
                    formatter={(value: number, name: string) => [
                      name === "earningsTry"
                        ? `${formatTry(String(value))}`
                        : value,
                      name === "earningsTry" ? "Kazanç (₺)" : "Teslimat",
                    ]}
                  />
                  <Legend />
                  <Bar
                    yAxisId="left"
                    dataKey="deliveries"
                    name="Teslimat"
                    fill="hsl(142 76% 36%)"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    yAxisId="right"
                    dataKey="earningsTry"
                    name="Kazanç (₺)"
                    fill="hsl(221 83% 53%)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-border/80 rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="size-4 opacity-60" />
                Aktif siparişler
              </CardTitle>
              <CardDescription>
                Kabul / alındı / yolda durumlarındaki işler
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.activeOrders.length === 0 ? (
                <p className="text-muted-foreground text-sm">Aktif sipariş yok.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sipariş</TableHead>
                        <TableHead>Müşteri</TableHead>
                        <TableHead>Durum</TableHead>
                        <TableHead className="text-right">Tutar</TableHead>
                        <TableHead>Oluşturma</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.activeOrders.map((o) => (
                        <TableRow
                          key={o.id}
                          className="hover:bg-muted/40 transition-colors"
                        >
                          <TableCell className="font-mono text-xs">
                            <Link
                              href={`/orders/${o.id}`}
                              className="text-primary hover:underline"
                            >
                              {o.id.slice(0, 10)}…
                            </Link>
                          </TableCell>
                          <TableCell className="min-w-[10rem] max-w-[240px] truncate text-sm">
                            {o.customer?.email ?? "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {orderStatusLabel(o.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatTry(o.price)}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {formatDateTimeTr(o.createdAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/80 rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Geçmiş siparişler</CardTitle>
              <CardDescription>En son 80 kayıt</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sipariş</TableHead>
                      <TableHead>Müşteri</TableHead>
                      <TableHead>Durum</TableHead>
                      <TableHead className="text-right">Tutar</TableHead>
                      <TableHead>Oluşturma</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.recentOrders.map((o) => (
                      <TableRow
                        key={o.id}
                        className="hover:bg-muted/40 transition-colors"
                      >
                        <TableCell className="font-mono text-xs">
                          <Link
                            href={`/orders/${o.id}`}
                            className="text-primary hover:underline"
                          >
                            {o.id.slice(0, 10)}…
                          </Link>
                        </TableCell>
                        <TableCell className="min-w-[10rem] max-w-[240px] truncate text-sm">
                          {o.customer?.email ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {orderStatusLabel(o.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatTry(o.price)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatDateTimeTr(o.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
