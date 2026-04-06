"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { OpsCommandMap } from "@/components/maps/ops-command-map";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchCouriers } from "@/lib/api/couriers";
import { fetchOrders } from "@/lib/api/orders";
import type { Courier } from "@/lib/api/types";
import type { Order } from "@/lib/api/types";
import { canViewCouriers } from "@/lib/auth-storage";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";

function CouriersMapContent() {
  const searchParams = useSearchParams();
  const focusCourier = searchParams.get("focus") ?? undefined;
  const focusOrder = searchParams.get("order") ?? undefined;

  const { user, token } = useAuth();
  const [couriers, setCouriers] = useState<Courier[] | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const allowed = user && canViewCouriers(user.role);

  const reload = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    setErr(null);
    try {
      const [c, o] = await Promise.all([fetchCouriers(), fetchOrders()]);
      setCouriers(c);
      setOrders(o);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [allowed]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (!allowed) {
    return (
      <>
        <PageHeader
          title="Operasyon haritası"
          description="Canlı kurye ve sipariş görünümü."
        />
        <EmptyState
          title="Erişim yok"
          description="Bu sayfa yalnızca yönetici ve operasyon rolleri içindir."
        />
      </>
    );
  }

  if (err && (couriers === null || orders === null)) {
    return (
      <>
        <PageHeader title="Operasyon haritası" />
        <div className="text-destructive bg-destructive/5 rounded-lg border border-destructive/20 p-4 text-sm">
          {err}
        </div>
      </>
    );
  }

  if (couriers === null || orders === null || !token || !user) {
    return (
      <>
        <PageHeader title="Operasyon haritası" />
        <Skeleton className="h-[min(560px,72vh)] w-full rounded-2xl" />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Operasyon haritası"
        description="Kurye ve sipariş markerları; WebSocket ile canlı konum. Sipariş seçilince alış → teslim rotası çizilir."
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={loading}
          onClick={() => void reload()}
        >
          <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          Verileri yenile
        </Button>
      </PageHeader>
      {err ? (
        <p className="text-destructive mb-2 text-sm">{err}</p>
      ) : null}
      <OpsCommandMap
        accessToken={token}
        initialCouriers={couriers}
        initialOrders={orders}
        focusCourierId={focusCourier}
        focusOrderId={focusOrder}
        userRole={user.role}
        onRefetch={reload}
      />
    </>
  );
}

export default function CouriersMapPage() {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="Operasyon haritası" />
          <Skeleton className="h-[min(560px,72vh)] w-full rounded-2xl" />
        </>
      }
    >
      <CouriersMapContent />
    </Suspense>
  );
}
