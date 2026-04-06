"use client";

import dynamic from "next/dynamic";
import type { Courier, Order } from "@/lib/api/types";

const Inner = dynamic(() => import("./dispatch-map-inner"), {
  ssr: false,
  loading: () => (
    <div className="bg-muted/40 flex min-h-[calc(100vh-12rem)] w-full items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground">
      Harita yükleniyor…
    </div>
  ),
});

type Props = {
  accessToken: string;
  couriers: Courier[];
  pinOrders: Order[];
  selectedOrder: Order | null;
  recommendedCourierId: string | null;
  /**
   * Operasyon 3 kolon düzeninde: üst konteyner yüksekliğini doldurur (viewport min-height yok).
   */
  layout?: "page" | "dispatchSplit";
};

export function DispatchMap(props: Props) {
  return <Inner {...props} />;
}
