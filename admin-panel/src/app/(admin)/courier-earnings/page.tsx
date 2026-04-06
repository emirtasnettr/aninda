"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  fetchCourierEarnings,
  fetchWeeklySummary,
  markEarningsPaid,
} from "@/lib/api/courier-earnings.api";
import type { CourierEarning } from "@/lib/api/erp-types";
import {
  canMarkCourierPaid,
  canViewCourierEarnings,
} from "@/lib/auth-storage";
import { formatDateTimeTr } from "@/lib/format-date";
import { formatTry } from "@/lib/format-currency";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";
import { courierDisplayName } from "@/lib/courier-display-name";

function defaultWeekStartIso(): string {
  const x = new Date();
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const d = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function CourierEarningsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const allowed = user && canViewCourierEarnings(user.role);
  const canMark = user && canMarkCourierPaid(user.role);

  const [rows, setRows] = useState<CourierEarning[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<
    "" | "PENDING" | "REQUESTED" | "PAID"
  >("PENDING");
  const [err, setErr] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState(defaultWeekStartIso);
  const [summary, setSummary] = useState<Awaited<
    ReturnType<typeof fetchWeeklySummary>
  > | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [marking, setMarking] = useState(false);

  const loadList = useCallback(async () => {
    if (!allowed) return;
    setErr(null);
    try {
      const data = await fetchCourierEarnings(
        statusFilter || undefined,
      );
      setRows(data);
      setSelected(new Set());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Liste yüklenemedi");
    }
  }, [allowed, statusFilter]);

  useEffect(() => {
    if (user && !allowed) router.replace("/dashboard");
  }, [user, allowed, router]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const loadSummary = useCallback(async () => {
    if (!allowed || !weekStart) return;
    setSummaryLoading(true);
    setErr(null);
    try {
      const s = await fetchWeeklySummary(weekStart);
      setSummary(s);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Özet yüklenemedi");
      setSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  }, [allowed, weekStart]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const pendingSelected = useMemo(() => {
    if (!rows) return [];
    return rows.filter((r) => selected.has(r.id) && r.status === "PENDING");
  }, [rows, selected]);

  function toggle(id: string, st: string) {
    if (st !== "PENDING" || !canMark) return;
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function onMarkPaid() {
    if (!canMark || pendingSelected.length === 0) return;
    setMarking(true);
    setErr(null);
    try {
      await markEarningsPaid(pendingSelected.map((r) => r.id));
      await loadList();
      await loadSummary();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Güncellenemedi");
    } finally {
      setMarking(false);
    }
  }

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
      <PageHeader
        title="Kurye hakedişleri"
        description="Teslimata bağlı kazançlar; haftalık ödeme özeti ve ödendi işaretleme."
      />

      {err ? <p className="text-destructive text-sm">{err}</p> : null}

      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle>Haftalık özet</CardTitle>
          <CardDescription>
            Pazartesi başlangıç tarihi seçin; o hafta içindeki tüm hakedişler
            kurye bazında gruplanır.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="ws">Hafta başı</Label>
              <Input
                id="ws"
                type="date"
                value={weekStart}
                onChange={(e) => setWeekStart(e.target.value)}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void loadSummary()}
              disabled={summaryLoading}
            >
              {summaryLoading ? "Yükleniyor…" : "Yenile"}
            </Button>
          </div>
          {summary ? (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kurye</TableHead>
                    <TableHead className="text-right">Talep edilebilir</TableHead>
                    <TableHead className="text-right">Talep edilmiş</TableHead>
                    <TableHead className="text-right">Ödenen</TableHead>
                    <TableHead className="text-right">Toplam</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.couriers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-muted-foreground">
                        Bu hafta kayıt yok.
                      </TableCell>
                    </TableRow>
                  ) : (
                    summary.couriers.map((c) => (
                      <TableRow key={c.courierId}>
                        <TableCell className="font-medium">{c.email}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatTry(c.pending)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatTry(c.requested)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatTry(c.paid)}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatTry(c.total)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <p className="text-muted-foreground border-t px-3 py-2 text-sm">
                Hafta toplamı:{" "}
                <span className="text-foreground font-semibold tabular-nums">
                  {formatTry(summary.grandTotal)}
                </span>
              </p>
            </div>
          ) : summaryLoading ? (
            <Skeleton className="h-24 w-full rounded-lg" />
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-md">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>Kazanç listesi</CardTitle>
            <CardDescription>
              Durum filtresi; bekleyen satırları seçip toplu ödendi
              işaretleyebilirsiniz.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value as
                    | ""
                    | "PENDING"
                    | "REQUESTED"
                    | "PAID",
                )
              }
            >
              <option value="">Tümü</option>
              <option value="PENDING">Talep edilebilir</option>
              <option value="REQUESTED">Ödeme talebinde</option>
              <option value="PAID">Ödenen</option>
            </select>
            {canMark ? (
              <Button
                type="button"
                disabled={marking || pendingSelected.length === 0}
                onClick={() => void onMarkPaid()}
              >
                {marking
                  ? "İşleniyor…"
                  : `Seçilenleri ödendi yap (${pendingSelected.length})`}
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {rows === null ? (
            <Skeleton className="h-48 w-full rounded-lg" />
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">Kayıt yok.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {canMark ? <TableHead className="w-10" /> : null}
                    <TableHead>Tarih</TableHead>
                    <TableHead>Kurye</TableHead>
                    <TableHead>Sipariş</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead className="text-right">Tutar</TableHead>
                    <TableHead className="w-[90px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      {canMark ? (
                        <TableCell>
                          <input
                            type="checkbox"
                            className="size-4"
                            disabled={r.status !== "PENDING"}
                            checked={selected.has(r.id)}
                            onChange={() => toggle(r.id, r.status)}
                            aria-label="Seç"
                          />
                        </TableCell>
                      ) : null}
                      <TableCell className="text-muted-foreground whitespace-nowrap text-sm">
                        {formatDateTimeTr(r.createdAt)}
                      </TableCell>
                      <TableCell className="min-w-[12rem] max-w-[min(100%,320px)] truncate text-sm">
                        <span className="font-medium">
                          {courierDisplayName(r.courier)}
                        </span>
                        <span className="text-muted-foreground block truncate text-xs">
                          {r.courier.user.email}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {r.orderId.slice(0, 10)}…
                      </TableCell>
                      <TableCell>
                        {r.status === "PAID" ? (
                          <Badge variant="secondary">Ödendi</Badge>
                        ) : r.status === "REQUESTED" ? (
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
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatTry(r.amount)}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/courier-earnings/${r.id}`}
                          className={cn(
                            buttonVariants({ variant: "ghost", size: "sm" }),
                          )}
                        >
                          Detay
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
