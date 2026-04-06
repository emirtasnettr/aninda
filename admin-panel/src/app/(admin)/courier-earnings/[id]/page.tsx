"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchCourierEarning } from "@/lib/api/courier-earnings.api";
import type { CourierEarning } from "@/lib/api/erp-types";
import { canViewCourierEarnings } from "@/lib/auth-storage";
import { formatDateTimeTr } from "@/lib/format-date";
import { formatTry } from "@/lib/format-currency";
import { orderStatusLabel } from "@/lib/order-status";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";
import { courierDisplayName } from "@/lib/courier-display-name";

export default function CourierEarningDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const router = useRouter();
  const { user } = useAuth();
  const allowed = user && canViewCourierEarnings(user.role);

  const [row, setRow] = useState<CourierEarning | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (user && !allowed) router.replace("/dashboard");
  }, [user, allowed, router]);

  useEffect(() => {
    if (!id || !allowed) return;
    let c = false;
    (async () => {
      try {
        const data = await fetchCourierEarning(id);
        if (!c) setRow(data as CourierEarning);
      } catch (e) {
        if (!c) setErr(e instanceof Error ? e.message : "Yüklenemedi");
      }
    })();
    return () => {
      c = true;
    };
  }, [id, allowed]);

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
      <PageHeader title="Hakediş detayı" description="Kurye ve sipariş bağlantısı">
        <Link
          href="/courier-earnings"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Listeye dön
        </Link>
      </PageHeader>

      {err ? <p className="text-destructive text-sm">{err}</p> : null}

      {!row ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle>Hakediş</CardTitle>
              <CardDescription>Kayıt özeti</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground">Durum</p>
                {row.status === "PAID" ? (
                  <Badge variant="secondary">Ödendi</Badge>
                ) : row.status === "REQUESTED" ? (
                  <Badge
                    variant="outline"
                    className="border-blue-500/50 bg-blue-500/10 text-blue-950 dark:text-blue-50"
                  >
                    Talep edildi
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="border-amber-500/50 bg-amber-500/10 text-amber-950 dark:text-amber-50"
                  >
                    Talep edilebilir
                  </Badge>
                )}
              </div>
              <div>
                <p className="text-muted-foreground">Tutar</p>
                <p className="text-2xl font-semibold tabular-nums">
                  {formatTry(row.amount)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Oluşturulma</p>
                <p>{formatDateTimeTr(row.createdAt)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Kurye</p>
                <p className="font-medium">{courierDisplayName(row.courier)}</p>
                <p className="text-muted-foreground text-xs">
                  {row.courier.user.email}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle>Sipariş</CardTitle>
              <CardDescription>Teslimata bağlı sipariş</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground">Sipariş no</p>
                <p className="font-mono text-xs">{row.orderId}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Durum</p>
                <Badge variant="outline">
                  {orderStatusLabel(row.order.status)}
                </Badge>
              </div>
              <div>
                <p className="text-muted-foreground">Sipariş tutarı</p>
                <p className="tabular-nums">{formatTry(row.order.price)}</p>
              </div>
              {row.order.deliveredAt ? (
                <div>
                  <p className="text-muted-foreground">Teslim</p>
                  <p>{formatDateTimeTr(row.order.deliveredAt)}</p>
                </div>
              ) : null}
              <Link
                href={`/orders/${row.orderId}`}
                className={cn(
                  buttonVariants({ variant: "secondary", size: "sm" }),
                  "mt-2 inline-flex",
                )}
              >
                Siparişe git
              </Link>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
