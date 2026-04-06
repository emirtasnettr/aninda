"use client";

import dynamic from "next/dynamic";

const OrderLiveMapInner = dynamic(() => import("./order-live-map-inner"), {
  ssr: false,
  loading: () => (
    <div className="bg-muted/40 flex h-[340px] w-full items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground md:h-[400px]">
      Harita yükleniyor…
    </div>
  ),
});

type OrderLiveMapProps = {
  accessToken: string;
  orderId: string;
  pickup: { lat: number; lng: number };
  delivery: { lat: number; lng: number };
  courierId: string | null;
  initialCourierPosition?: { lat: number; lng: number } | null;
};

export function OrderLiveMap(props: OrderLiveMapProps) {
  return <OrderLiveMapInner {...props} />;
}
