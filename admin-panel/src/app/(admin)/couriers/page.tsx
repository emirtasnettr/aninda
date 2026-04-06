"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ExternalLink,
  Eye,
  MapPin,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchCouriers, patchCourierOnline } from "@/lib/api/couriers";
import type { Courier, CourierOpsState } from "@/lib/api/types";
import { canViewCouriers } from "@/lib/auth-storage";
import { formatTry } from "@/lib/format-currency";
import { openStreetMapLink } from "@/lib/map-links";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";
import { courierDisplayName } from "@/lib/courier-display-name";

function vehicleLabel(type: string): string {
  if (type === "MOTORCYCLE") return "Motosiklet";
  if (type === "CAR") return "Otomobil";
  return type;
}

function opsStateLabel(s: CourierOpsState): string {
  switch (s) {
    case "offline":
      return "Çevrimdışı";
    case "online_idle":
      return "Çevrimiçi · Boşta";
    case "online_busy":
      return "Çevrimiçi · Teslimatta";
    default:
      return s;
  }
}

function opsStateBadges(s: CourierOpsState) {
  if (s === "offline") {
    return (
      <Badge
        variant="secondary"
        className="font-medium whitespace-nowrap border-zinc-200 bg-zinc-100 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
      >
        {opsStateLabel(s)}
      </Badge>
    );
  }
  if (s === "online_idle") {
    return (
      <Badge className="whitespace-nowrap border-emerald-600/30 bg-emerald-600 text-white hover:bg-emerald-600">
        {opsStateLabel(s)}
      </Badge>
    );
  }
  return (
    <Badge className="whitespace-nowrap border-sky-600/30 bg-sky-600 text-white hover:bg-sky-600">
      {opsStateLabel(s)}
    </Badge>
  );
}

function recomputeOpsState(
  isOnline: boolean,
  activeCount: number,
): CourierOpsState {
  if (!isOnline) return "offline";
  return activeCount > 0 ? "online_busy" : "online_idle";
}

function courierMatchesSearch(c: Courier, raw: string): boolean {
  const needle = raw.trim().toLowerCase();
  if (!needle) return true;
  const haystacks = [
    c.id,
    c.userId,
    c.user.id,
    c.fullName ?? "",
    c.phone ?? "",
    c.plateNumber ?? "",
    c.user.email,
    courierDisplayName(c),
  ];
  return haystacks.some((s) => String(s).toLowerCase().includes(needle));
}

export default function CouriersPage() {
  const { user } = useAuth();
  const [couriers, setCouriers] = useState<Courier[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filterOnline, setFilterOnline] = useState<string>("all");
  const [filterVehicle, setFilterVehicle] = useState<string>("all");
  const [filterActivity, setFilterActivity] = useState<string>("all");

  const allowed = user && canViewCouriers(user.role);

  const load = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    setErr(null);
    try {
      const data = await fetchCouriers();
      setCouriers(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Liste yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [allowed]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!couriers) return [];
    return couriers.filter((c) => {
      if (!courierMatchesSearch(c, search)) return false;
      if (filterOnline === "online" && !c.isOnline) return false;
      if (filterOnline === "offline" && c.isOnline) return false;
      if (filterVehicle !== "all" && c.type !== filterVehicle) return false;
      const st = c.opsState ?? recomputeOpsState(c.isOnline, c.stats?.activeOrdersCount ?? 0);
      if (filterActivity === "idle" && st !== "online_idle") return false;
      if (filterActivity === "busy" && st !== "online_busy") return false;
      if (filterActivity === "offline" && st !== "offline") return false;
      return true;
    });
  }, [couriers, search, filterOnline, filterVehicle, filterActivity]);

  async function toggleOnline(c: Courier, next: boolean) {
    setRowBusy(c.id);
    setErr(null);
    try {
      await patchCourierOnline(c.id, { isOnline: next });
      setCouriers((prev) =>
        prev
          ? prev.map((row) => {
              if (row.id !== c.id) return row;
              const active = row.stats?.activeOrdersCount ?? 0;
              const opsState = recomputeOpsState(next, active);
              return { ...row, isOnline: next, opsState };
            })
          : null,
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Durum güncellenemedi");
    } finally {
      setRowBusy(null);
    }
  }

  if (!allowed) {
    return (
      <>
        <PageHeader
          title="Kuryeler"
          description="Performans ve operasyon durumu."
        />
        <EmptyState
          title="Erişim yok"
          description="Bu sayfa yalnızca yönetici ve operasyon rolleri içindir."
        />
      </>
    );
  }

  if (err && couriers === null) {
    return (
      <>
        <PageHeader title="Kuryeler" />
        <div className="text-destructive bg-destructive/5 rounded-lg border border-destructive/20 p-4 text-sm">
          {err}
        </div>
      </>
    );
  }

  if (couriers === null) {
    return (
      <>
        <PageHeader title="Kuryeler" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Kurye yönetimi"
        description="Canlı durum, günlük teslimat ve kazanç özeti. Metrikler İstanbul takvim gününe göredir."
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={loading}
          onClick={() => void load()}
        >
          <RefreshCw
            className={cn("size-3.5", loading && "animate-spin")}
          />
          Yenile
        </Button>
      </PageHeader>

      {err ? (
        <p className="text-destructive mb-4 text-sm">{err}</p>
      ) : null}

      <Card className="border-border/80 mb-6 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <SlidersHorizontal className="size-4 opacity-60" />
                Filtreler
              </CardTitle>
              <CardDescription>
                {filtered.length} / {couriers.length} kurye
                {search.trim() ? " · arama uygulanıyor" : ""}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="relative w-full max-w-md">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              type="search"
              placeholder="Ara: ad, e-posta, telefon, plaka, ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 pl-9"
              autoComplete="off"
              aria-label="Kurye ara"
            />
          </div>
          <div className="flex flex-wrap gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs font-medium">
              Bağlantı
            </span>
            <select
              className="border-input bg-background h-9 min-w-[140px] rounded-md border px-2 text-sm"
              value={filterOnline}
              onChange={(e) => setFilterOnline(e.target.value)}
            >
              <option value="all">Tümü</option>
              <option value="online">Çevrimiçi</option>
              <option value="offline">Çevrimdışı</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs font-medium">
              Araç
            </span>
            <select
              className="border-input bg-background h-9 min-w-[140px] rounded-md border px-2 text-sm"
              value={filterVehicle}
              onChange={(e) => setFilterVehicle(e.target.value)}
            >
              <option value="all">Tümü</option>
              <option value="MOTORCYCLE">Motosiklet</option>
              <option value="CAR">Otomobil</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs font-medium">
              Aktivite
            </span>
            <select
              className="border-input bg-background h-9 min-w-[160px] rounded-md border px-2 text-sm"
              value={filterActivity}
              onChange={(e) => setFilterActivity(e.target.value)}
            >
              <option value="all">Tümü</option>
              <option value="idle">Çevrimiçi · boşta</option>
              <option value="busy">Çevrimiçi · teslimatta</option>
              <option value="offline">Çevrimdışı</option>
            </select>
          </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle>Kurye listesi</CardTitle>
          <CardDescription>
            Satır üzerinde gezinince vurgulanır; çevrimiçi durumunu panelden
            değiştirebilirsiniz.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0 sm:px-6">
          {couriers.length === 0 ? (
            <EmptyState
              title="Kayıtlı kurye yok"
              description="Seed veya kullanıcı yönetiminden COURIER rolü ile kullanıcı oluşturun."
            />
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground px-6 py-8 text-center text-sm">
              {search.trim()
                ? "Arama veya filtrelere uyan kurye yok."
                : "Filtrelere uyan kurye yok."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Kurye</TableHead>
                  <TableHead>Araç</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-center tabular-nums">
                    Aktif sip.
                  </TableHead>
                  <TableHead className="text-center tabular-nums">
                    Bugün teslim
                  </TableHead>
                  <TableHead className="text-center">Ort. süre</TableHead>
                  <TableHead className="text-right tabular-nums">
                    Kazanç (bugün)
                  </TableHead>
                  <TableHead>Koordinat</TableHead>
                  <TableHead className="text-right w-[220px]">
                    İşlemler
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => {
                  const st =
                    c.opsState ??
                    recomputeOpsState(
                      c.isOnline,
                      c.stats?.activeOrdersCount ?? 0,
                    );
                  const stats = c.stats;
                  return (
                    <TableRow
                      key={c.id}
                      className="hover:bg-muted/50 border-border/60 transition-colors"
                    >
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {courierDisplayName(c)}
                          </span>
                          <span className="text-muted-foreground min-w-0 max-w-[min(100%,280px)] truncate text-xs">
                            {c.user.email}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal">
                          {vehicleLabel(c.type)}
                        </Badge>
                      </TableCell>
                      <TableCell>{opsStateBadges(st)}</TableCell>
                      <TableCell className="text-center tabular-nums">
                        {stats?.activeOrdersCount ?? "—"}
                      </TableCell>
                      <TableCell className="text-center tabular-nums">
                        {stats?.todayDeliveriesCount ?? "—"}
                      </TableCell>
                      <TableCell className="text-center text-sm tabular-nums">
                        {stats?.avgDeliveryMinutes != null
                          ? `${stats.avgDeliveryMinutes} dk`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium tabular-nums">
                        {stats?.todayEarningsTry != null
                          ? formatTry(stats.todayEarningsTry)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground min-w-[7rem] max-w-[180px] font-mono text-xs">
                        {c.lat != null && c.lng != null
                          ? `${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <Link
                            href={`/couriers/${c.id}`}
                            className={cn(
                              buttonVariants({
                                variant: "secondary",
                                size: "sm",
                              }),
                              "gap-1",
                            )}
                          >
                            <Eye className="size-3.5" />
                            Detay
                          </Link>
                          <div className="flex items-center gap-2 rounded-lg border border-border/70 px-2 py-1">
                            <span className="text-muted-foreground text-[10px] font-semibold uppercase">
                              Çevrimiçi
                            </span>
                            <Switch
                              checked={c.isOnline}
                              disabled={rowBusy === c.id}
                              onCheckedChange={(v) => void toggleOnline(c, v)}
                            />
                          </div>
                          <Link
                            href={`/couriers/map?focus=${encodeURIComponent(c.id)}`}
                            className={cn(
                              buttonVariants({ variant: "outline", size: "sm" }),
                              "gap-1",
                            )}
                          >
                            <MapPin className="size-3.5" />
                            Harita
                          </Link>
                          {c.lat != null && c.lng != null ? (
                            <a
                              href={openStreetMapLink(c.lat, c.lng)}
                              target="_blank"
                              rel="noreferrer"
                              className={cn(
                                buttonVariants({
                                  variant: "ghost",
                                  size: "sm",
                                }),
                                "gap-1 px-2",
                              )}
                            >
                              OSM
                              <ExternalLink className="size-3 opacity-70" />
                            </a>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
