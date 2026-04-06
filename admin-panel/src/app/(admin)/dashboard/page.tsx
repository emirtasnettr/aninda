"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  MapPin,
  Plus,
  Radio,
  Search,
  UserPlus,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DashboardOverviewMap } from "@/components/maps/dashboard-overview-map";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchCouriers } from "@/lib/api/couriers";
import { fetchOrders } from "@/lib/api/orders";
import type { Courier, Order } from "@/lib/api/types";
import {
  countActiveDeliveries,
  countAwaitingCourier,
  countDelayedOrders,
  listCancelRisk,
  listDelayedOrders,
  listSearchingStuck,
  ordersTrendByDay,
  orderAgeMs,
  revenueByDay,
  todayOrderCount,
  todayRevenueTry,
} from "@/lib/dashboard-analytics";
import { formatTry } from "@/lib/format-currency";
import { formatDateTimeTr } from "@/lib/format-date";
import { formatDurationTr } from "@/lib/format-duration";
import { canViewCouriers, isCustomerRole } from "@/lib/auth-storage";
import { orderStatusLabel } from "@/lib/order-status";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";

function formatAgeShort(ms: number): string {
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m} dk`;
  const h = Math.floor(m / 60);
  return `${h} s ${m % 60} dk`;
}

export default function DashboardPage() {
  const { user, token } = useAuth();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [couriers, setCouriers] = useState<Courier[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const staffOps = user && canViewCouriers(user.role);
  const customer = user && isCustomerRole(user.role);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const o = await fetchOrders();
        if (!cancelled) setOrders(o);
        if (staffOps) {
          const c = await fetchCouriers();
          if (!cancelled) setCouriers(c);
        } else if (!cancelled) {
          setCouriers([]);
        }
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : "Veri alınamadı");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [staffOps]);

  const delayedCount = useMemo(
    () => (orders ? countDelayedOrders(orders) : 0),
    [orders],
  );
  const awaitingCount = useMemo(
    () => (orders ? countAwaitingCourier(orders) : 0),
    [orders],
  );
  const activeCount = useMemo(
    () => (orders ? countActiveDeliveries(orders) : 0),
    [orders],
  );
  const deliveredCount = useMemo(
    () => (orders ? orders.filter((o) => o.status === "DELIVERED").length : 0),
    [orders],
  );

  const delayedList = useMemo(
    () => (orders ? listDelayedOrders(orders) : []),
    [orders],
  );
  const stuckSearching = useMemo(
    () => (orders ? listSearchingStuck(orders) : []),
    [orders],
  );
  const cancelRisk = useMemo(
    () => (orders ? listCancelRisk(orders) : []),
    [orders],
  );

  const trend = useMemo(
    () => (orders ? ordersTrendByDay(orders, 14) : []),
    [orders],
  );
  const revenueTrend = useMemo(
    () => (orders ? revenueByDay(orders, 14) : []),
    [orders],
  );

  const todayRev = useMemo(
    () => (orders ? todayRevenueTry(orders) : 0),
    [orders],
  );
  const todayCnt = useMemo(
    () => (orders ? todayOrderCount(orders) : 0),
    [orders],
  );

  const deliveredWithTime = useMemo(() => {
    if (!orders) return null;
    const rows = orders.filter((o) => o.status === "DELIVERED" && o.deliveredAt);
    if (rows.length === 0) return null;
    const sum = rows.reduce((acc, o) => {
      const a = new Date(o.createdAt).getTime();
      const b = new Date(o.deliveredAt!).getTime();
      return acc + (b - a);
    }, 0);
    return sum / rows.length;
  }, [orders]);

  const systemOk =
    delayedCount === 0 && stuckSearching.length === 0 && cancelRisk.length === 0;

  if (err) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold tracking-tight">Kontrol merkezi</h1>
        <div className="text-destructive rounded-2xl border border-destructive/20 bg-destructive/5 px-5 py-4 text-sm">
          {err}
        </div>
      </div>
    );
  }

  if (orders === null || couriers === null || !user) {
    return (
      <div className="space-y-10">
        <Skeleton className="h-36 w-full rounded-2xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="min-h-[40vh] w-full rounded-2xl" />
      </div>
    );
  }

  if (customer) {
    return (
      <div className="space-y-12 pb-8">
        <header className="space-y-3">
          <p className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
            Müşteri portalı
          </p>
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
            Hoş geldiniz
          </h1>
          <p className="text-muted-foreground max-w-none text-lg leading-relaxed lg:max-w-2xl">
            Siparişlerinizi buradan takip edebilir, yeni teslimat talebi
            oluşturabilirsiniz.
          </p>
        </header>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <MetricTile
            label="Toplam sipariş"
            value={orders.length}
            href="/orders"
          />
          <MetricTile
            label="Bugün"
            value={todayCnt}
            href="/orders"
            hint="Oluşturulan"
          />
          <MetricTile
            label="Aktif"
            value={
              orders.filter((o) =>
                ["PENDING", "SEARCHING_COURIER", "ACCEPTED", "PICKED_UP", "ON_DELIVERY"].includes(
                  o.status,
                ),
              ).length
            }
            href="/orders"
          />
          <MetricTile
            label="Tamamlanan"
            value={orders.filter((o) => o.status === "DELIVERED").length}
            href="/orders?status=DELIVERED"
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/orders/new" className={buttonVariants({ size: "lg" })}>
            <Plus className="size-4" />
            Yeni sipariş
          </Link>
          <Link
            href="/orders"
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            Siparişlerim
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-16 md:space-y-12 md:pb-20">
      {/* Hero — kompakt özet */}
      <section
        className={cn(
          "relative overflow-hidden rounded-2xl border border-white/10 px-4 py-4 shadow-lg sm:px-5 sm:py-5",
          "bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white",
        )}
      >
        <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-indigo-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-10 size-40 rounded-full bg-cyan-500/10 blur-3xl" />

        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-white/75">
              <span
                className={cn(
                  "inline-flex size-2 rounded-full",
                  systemOk ? "bg-emerald-400" : "bg-amber-400",
                )}
              />
              <Radio className="size-3.5 opacity-80" />
              {systemOk ? "Operasyon normal" : "Dikkat gerektiren kayıtlar var"}
            </div>
            <h1 className="text-xl font-semibold leading-tight tracking-tight sm:text-2xl">
              Operasyon kontrol merkezi
            </h1>
            <p className="max-w-xl text-sm leading-snug text-white/65">
              Özet metrikler; detay ve harita aşağıda.
            </p>
          </div>

          <div className="grid w-full shrink-0 grid-cols-2 gap-2 sm:gap-3 lg:max-w-2xl lg:grid-cols-4">
            <HeroStat
              label="Geciken"
              value={delayedCount}
              accent="from-rose-500/30 to-orange-500/20 border-rose-400/30"
              warn={delayedCount > 0}
            />
            <HeroStat
              label="Kurye bekleyen"
              value={awaitingCount}
              accent="from-amber-500/25 to-yellow-500/15 border-amber-400/25"
              warn={awaitingCount > 0}
            />
            <HeroStat
              label="Aktif teslimat"
              value={activeCount}
              accent="from-emerald-500/25 to-teal-500/15 border-emerald-400/25"
            />
            <Link
              href="/orders?status=DELIVERED"
              className="block rounded-xl outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-white/40"
            >
              <HeroStat
                label="Tamamlanan"
                value={deliveredCount}
                accent="from-sky-500/20 to-indigo-500/20 border-sky-400/25"
              />
            </Link>
          </div>
        </div>
      </section>

      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/orders/new" className={buttonVariants({ size: "lg" })}>
          <Plus className="size-4" />
          Yeni sipariş oluştur
        </Link>
        {staffOps ? (
          <>
            <Link
              href="/operations"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              <UserPlus className="size-4" />
              Kurye ata
            </Link>
            <Link
              href="/couriers/map"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              <MapPin className="size-4" />
              Haritayı aç
            </Link>
          </>
        ) : (
          <Link
            href="/orders"
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            Sipariş listesi
            <ArrowRight className="size-4" />
          </Link>
        )}
      </div>

      {/* Canlı saha: harita tam satır */}
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              Canlı saha
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Açık siparişlerin alış noktaları ve kurye konumları (gerçek zamanlı).
            </p>
          </div>
          {staffOps ? (
            <Link
              href="/operations"
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "shrink-0 gap-1 text-muted-foreground",
              )}
            >
              Tam ekran operasyon
              <ArrowRight className="size-4" />
            </Link>
          ) : null}
        </div>
        {token ? (
          <DashboardOverviewMap
            accessToken={token}
            couriers={couriers}
            orders={orders}
          />
        ) : (
          <Skeleton className="min-h-[40vh] w-full rounded-2xl" />
        )}
      </section>

      {/* Acil durumlar: üç kart haritanın altında yan yana */}
      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Acil durumlar
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            SLA eşiklerini aşan veya riskli siparişler.
          </p>
        </div>
        <div className="grid min-w-0 gap-4 md:grid-cols-3 md:gap-5">
          <UrgentBlock
            title="Geciken siparişler"
            icon={AlertTriangle}
            tone="rose"
            empty="Gecikmiş aktif teslimat yok."
            rows={delayedList.slice(0, 8)}
            subtitle="90 dk+ aktif hat"
          />
          <UrgentBlock
            title="Kurye bulunamayanlar"
            icon={Search}
            tone="amber"
            empty="Uzun süredir aranan kayıt yok."
            rows={stuckSearching.slice(0, 8)}
            subtitle="30 dk+ kurye aranıyor"
          />
          <UrgentBlock
            title="İptal riski"
            icon={Activity}
            tone="orange"
            empty="Uzun beklemede sipariş yok."
            rows={cancelRisk.slice(0, 8)}
            subtitle="25 dk+ beklemede"
          />
        </div>
      </section>

      {/* 4 metrics */}
      <div>
        <h2 className="mb-6 text-2xl font-semibold tracking-tight">
          Ana metrikler
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-4 2xl:gap-6">
          <MetricTile
            label="Bugünkü sipariş"
            value={todayCnt}
            href="/orders"
            hint="Oluşturulan"
          />
          <MetricTile
            label="Aktif teslimat"
            value={activeCount}
            href="/orders?status=ACTIVE"
            hint="Kabul / yolda"
          />
          <MetricTile
            label="Kurye bekleyen"
            value={awaitingCount}
            href="/orders?status=SEARCHING_COURIER"
            hint="Beklemede + aranıyor"
          />
          <MetricTile
            label="Günlük ciro"
            value={formatTry(todayRev)}
            href="/orders?status=DELIVERED"
            hint="Bugün teslim edilen"
          />
        </div>
      </div>

      {/* Charts */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold tracking-tight">Trendler</h2>
        <div className="grid gap-6 lg:gap-8 xl:grid-cols-2 2xl:gap-10">
          <ChartCard
            title="Sipariş trendi"
            description="Son 14 gün — oluşturulan sipariş adedi"
          >
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={trend} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  width={36}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--card))",
                  }}
                  labelStyle={{ fontWeight: 600 }}
                />
                <Line
                  type="monotone"
                  dataKey="orders"
                  name="Sipariş"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "#6366f1" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Gelir grafiği"
            description="Son 14 gün — teslim edilen tutar (TRY)"
          >
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={revenueTrend} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(217 91% 60%)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(217 91% 60%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  width={44}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}`}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--card))",
                  }}
                  formatter={(value: number) => [formatTry(value), "Ciro"]}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Ciro"
                  stroke="hsl(217 91% 55%)"
                  strokeWidth={2}
                  fill="url(#revFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </div>

      {deliveredWithTime != null ? (
        <p className="text-muted-foreground text-center text-xs">
          Ortalama teslim süresi (kayıtlı):{" "}
          <span className="text-foreground font-medium">
            {formatDurationTr(deliveredWithTime)}
          </span>
        </p>
      ) : null}
    </div>
  );
}

function HeroStat({
  label,
  value,
  accent,
  warn,
}: {
  label: string;
  value: number;
  accent: string;
  warn?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-gradient-to-br px-3 py-2.5 backdrop-blur-sm sm:px-3.5 sm:py-3",
        accent,
        warn && value > 0 && "ring-1 ring-amber-400/50",
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-white/55">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums leading-none tracking-tight sm:text-[1.65rem]">
        {value}
      </p>
    </div>
  );
}

function MetricTile({
  label,
  value,
  href,
  hint,
}: {
  label: string;
  value: ReactNode;
  href: string;
  hint?: string;
}) {
  return (
    <Link href={href} className="group block">
      <Card
        className={cn(
          "h-full border-border/60 shadow-sm transition-all duration-200",
          "rounded-2xl hover:border-primary/15 hover:shadow-md",
        )}
      >
        <CardContent className="p-6">
          <p className="text-muted-foreground text-sm font-medium">{label}</p>
          <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight">
            {value}
          </p>
          {hint ? (
            <p className="text-muted-foreground mt-3 flex items-center gap-1 text-xs">
              {hint}
              <ArrowRight className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
            </p>
          ) : null}
        </CardContent>
      </Card>
    </Link>
  );
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card className="rounded-2xl border-border/60 shadow-sm">
      <CardContent className="p-6 md:p-8">
        <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
        <p className="text-muted-foreground mt-1 text-sm">{description}</p>
        <div className="mt-6">{children}</div>
      </CardContent>
    </Card>
  );
}

function UrgentBlock({
  title,
  icon: Icon,
  tone,
  empty,
  rows,
  subtitle,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  tone: "rose" | "amber" | "orange";
  empty: string;
  rows: Order[];
  subtitle: string;
}) {
  const border =
    tone === "rose"
      ? "border-rose-200/80 dark:border-rose-900/50"
      : tone === "amber"
        ? "border-amber-200/80 dark:border-amber-900/50"
        : "border-orange-200/80 dark:border-orange-900/50";
  const iconBg =
    tone === "rose"
      ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
      : tone === "amber"
        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
        : "bg-orange-500/10 text-orange-600 dark:text-orange-400";

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col rounded-2xl border bg-card/80 p-5 shadow-sm backdrop-blur-sm",
        border,
      )}
    >
      <div className="flex items-start gap-3">
        <span className={cn("flex size-10 items-center justify-center rounded-xl", iconBg)}>
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold tracking-tight">{title}</h3>
          <p className="text-muted-foreground text-xs">{subtitle}</p>
        </div>
      </div>
      <div className="mt-4 min-h-0 flex-1 space-y-2">
        {rows.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">{empty}</p>
        ) : (
          rows.map((o) => (
            <Link
              key={o.id}
              href={`/orders/${o.id}`}
              className="hover:bg-muted/60 flex items-center justify-between gap-2 rounded-xl border border-transparent px-3 py-2.5 text-sm transition-colors"
            >
              <div className="min-w-0">
                <p className="truncate font-mono text-xs text-muted-foreground">
                  {o.id.slice(0, 10)}…
                </p>
                <p className="truncate text-xs">
                  {o.customer?.email ?? "Müşteri"}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <Badge variant="outline" className="text-[10px]">
                  {orderStatusLabel(o.status)}
                </Badge>
                <p className="text-muted-foreground mt-1 text-[10px]">
                  {formatAgeShort(orderAgeMs(o))}
                </p>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
