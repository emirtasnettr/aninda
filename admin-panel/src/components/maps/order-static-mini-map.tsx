"use client";

import dynamic from "next/dynamic";

const Inner = dynamic(() => import("./order-static-mini-map-inner"), {
  ssr: false,
  loading: () => (
    <div className="bg-muted/40 flex h-[220px] w-full items-center justify-center rounded-xl border border-dashed text-xs text-muted-foreground">
      Harita…
    </div>
  ),
});

type Props = {
  pickupLat: number;
  pickupLng: number;
  deliveryLat: number;
  deliveryLng: number;
};

export function OrderStaticMiniMap(props: Props) {
  return <Inner {...props} />;
}
