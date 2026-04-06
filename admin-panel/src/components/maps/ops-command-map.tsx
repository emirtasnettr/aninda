"use client";

import dynamic from "next/dynamic";
import type { Courier } from "@/lib/api/types";
import type { Order } from "@/lib/api/types";

const OpsCommandMapInner = dynamic(() => import("./ops-command-map-inner"), {
  ssr: false,
  loading: () => (
    <div className="bg-muted/40 flex min-h-[min(520px,55vh)] w-full items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
      Operasyon haritası yükleniyor…
    </div>
  ),
});

type OpsCommandMapProps = {
  accessToken: string;
  initialCouriers: Courier[];
  initialOrders: Order[];
  focusCourierId?: string;
  focusOrderId?: string;
  userRole: string;
  onRefetch: () => Promise<void>;
};

export function OpsCommandMap(props: OpsCommandMapProps) {
  return <OpsCommandMapInner {...props} />;
}
