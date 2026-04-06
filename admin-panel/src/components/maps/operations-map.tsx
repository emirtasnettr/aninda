"use client";

import dynamic from "next/dynamic";
import type { Courier, Order } from "@/lib/api/types";

const OperationsMapInner = dynamic(() => import("./operations-map-inner"), {
  ssr: false,
  loading: () => (
    <div className="bg-muted/40 flex h-[min(420px,55vh)] w-full items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground md:h-[min(560px,70vh)]">
      Harita yükleniyor…
    </div>
  ),
});

type OperationsMapProps = {
  accessToken: string;
  couriers: Courier[];
  selectedOrder: Order | null;
};

export function OperationsMap(props: OperationsMapProps) {
  return <OperationsMapInner {...props} />;
}
