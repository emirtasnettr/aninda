"use client";

import dynamic from "next/dynamic";
import type { Courier, Order } from "@/lib/api/types";

const Inner = dynamic(() => import("./dashboard-overview-map-inner"), {
  ssr: false,
  loading: () => (
    <div className="bg-muted/30 flex min-h-[40vh] w-full items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground">
      Harita yükleniyor…
    </div>
  ),
});

type Props = {
  accessToken: string;
  couriers: Courier[];
  orders: Order[];
};

export function DashboardOverviewMap(props: Props) {
  return <Inner {...props} />;
}
