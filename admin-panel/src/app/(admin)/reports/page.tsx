"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchErpOverview } from "@/lib/api/reports.api";
import type { ErpOverview } from "@/lib/api/erp-types";
import { canViewReports } from "@/lib/auth-storage";
import { formatTry } from "@/lib/format-currency";
import { orderStatusLabel } from "@/lib/order-status";
import { useAuth } from "@/context/auth-context";

export default function ReportsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const allowed = user && canViewReports(user.role);

  const [data, setData] = useState<ErpOverview | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (user && !allowed) router.replace("/dashboard");
  }, [user, allowed, router]);

  useEffect(() => {
    if (!allowed) return;
    let c = false;
    (async () => {
      try {
        const o = await fetchErpOverview();
        if (!c) setData(o);
      } catch (e) {
        if (!c) setErr(e instanceof Error ? e.message : "Rapor yüklenemedi");
      }
    })();
    return () => {
      c = true;
    };
  }, [allowed]);

  if (!user || !allowed) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Raporlar"
        description="ERP özet metrikleri: müşteri sayısı, sipariş dağılımı, cari, ciro, komisyon ve kurye hakediş toplamları."
      />

      {err ? <p className="text-destructive text-sm">{err}</p> : null}

      {!data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-2">
                <CardDescription>Müşteriler</CardDescription>
                <CardTitle className="text-3xl tabular-nums">
                  {data.customers}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-2">
                <CardDescription>Toplam sipariş</CardDescription>
                <CardTitle className="text-3xl tabular-nums">
                  {data.totalOrders}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-2">
                <CardDescription>Cari (alacak bakiye)</CardDescription>
                <CardTitle className="text-xl tabular-nums sm:text-2xl">
                  {formatTry(data.receivablesBalance)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-2">
                <CardDescription>Kurye hakediş</CardDescription>
              </CardHeader>
              <CardContent className="text-sm">
                <p>
                  Bekleyen:{" "}
                  <span className="font-medium tabular-nums">
                    {formatTry(data.courierEarningsPending)}
                  </span>
                </p>
                <p>
                  Ödenen:{" "}
                  <span className="font-medium tabular-nums">
                    {formatTry(data.courierEarningsPaid)}
                  </span>
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-2">
                <CardDescription>Teslim ciro (DELIVERED)</CardDescription>
                <CardTitle className="text-xl tabular-nums sm:text-2xl">
                  {formatTry(data.revenueDelivered)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-2">
                <CardDescription>Platform komisyonu (snapshot)</CardDescription>
                <CardTitle className="text-xl tabular-nums sm:text-2xl">
                  {formatTry(data.platformCommissionDelivered)}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground text-xs">
                Yalnızca siparişte komisyon kaydı olan teslimler toplanır; eski
                kayıtlar dahil olmayabilir.
              </CardContent>
            </Card>
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-2">
                <CardDescription>Kurye hakediş (tüm kalemler)</CardDescription>
                <CardTitle className="text-xl tabular-nums sm:text-2xl">
                  {formatTry(data.courierEarningsTotal)}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle>Sipariş durumları</CardTitle>
              <CardDescription>Statü bazlı adet</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(data.ordersByStatus).map(([k, v]) => (
                  <li
                    key={k}
                    className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                  >
                    <span>{orderStatusLabel(k)}</span>
                    <span className="font-semibold tabular-nums">{v}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
