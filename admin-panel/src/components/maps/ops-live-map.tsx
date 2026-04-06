"use client";

import dynamic from "next/dynamic";
import type { Courier } from "@/lib/api/types";

const OpsLiveMapInner = dynamic(() => import("./ops-live-map-inner"), {
  ssr: false,
  loading: () => (
    <div className="bg-muted/40 flex h-[min(520px,70vh)] w-full items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
      Harita yükleniyor…
    </div>
  ),
});

type OpsLiveMapProps = {
  accessToken: string;
  couriers: Courier[];
  /** Liste veya detaydan: bu kuryenin konumuna odaklan */
  focusCourierId?: string;
};

export function OpsLiveMap({
  accessToken,
  couriers,
  focusCourierId,
}: OpsLiveMapProps) {
  return (
    <OpsLiveMapInner
      accessToken={accessToken}
      initialCouriers={couriers}
      focusCourierId={focusCourierId}
    />
  );
}
