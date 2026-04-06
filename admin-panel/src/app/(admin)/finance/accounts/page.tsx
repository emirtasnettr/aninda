"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, Landmark } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  createFinanceTransaction,
  fetchFinanceAccounts,
} from "@/lib/api/finance.api";
import type { CustomerAccountRow } from "@/lib/api/erp-types";
import {
  cariRiskBadgeClass,
  cariRiskLabel,
  cariRiskLevel,
  cariRowClass,
} from "@/lib/cari-risk";
import { canPostFinanceTransaction, canViewFinance } from "@/lib/auth-storage";
import { formatDateTimeTr } from "@/lib/format-date";
import { formatTry } from "@/lib/format-currency";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";

function typeLabel(t: string): string {
  return t === "CORPORATE" ? "Kurumsal" : "Bireysel";
}

function balanceTone(balanceTry: string): { label: string; className: string } {
  const n = Number(balanceTry);
  if (!Number.isFinite(n) || n === 0) {
    return {
      label: "Kapalı",
      className: "text-muted-foreground",
    };
  }
  if (n > 0) {
    return {
      label: "Borç (müşteri → siz)",
      className: "text-amber-800 dark:text-amber-200",
    };
  }
  return {
    label: "Alacak / ön ödeme",
    className: "text-emerald-700 dark:text-emerald-400",
  };
}

function num(s: string): number {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

export default function FinanceAccountsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const allowed = user && canViewFinance(user.role);
  const canPost = user && canPostFinanceTransaction(user.role);

  const [rows, setRows] = useState<CustomerAccountRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [tahsilOpen, setTahsilOpen] = useState(false);
  const [borcOpen, setBorcOpen] = useState(false);
  const [txCustomerId, setTxCustomerId] = useState("");
  const [txAmount, setTxAmount] = useState("");
  const [txDesc, setTxDesc] = useState("");
  const [txBusy, setTxBusy] = useState(false);
  const [txErr, setTxErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    setErr(null);
    try {
      const data = await fetchFinanceAccounts();
      setRows(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Liste yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [allowed]);

  useEffect(() => {
    if (user && !allowed) router.replace("/dashboard");
  }, [user, allowed, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    if (!rows) return null;
    let receivables = 0;
    let over = 0;
    let near = 0;
    for (const r of rows) {
      const b = num(r.balance);
      if (b > 0) receivables += b;
      const level = cariRiskLevel(
        r.balance,
        r.customer.type,
        r.customer.creditEnabled ?? false,
        r.customer.creditLimit ?? null,
      );
      if (level === "over_limit") over += 1;
      if (level === "near_limit") near += 1;
    }
    return { receivables, over, near, count: rows.length };
  }, [rows]);

  function openTahsilat() {
    setTxErr(null);
    setTxCustomerId("");
    setTxAmount("");
    setTxDesc("");
    setTahsilOpen(true);
  }

  function openBorc() {
    setTxErr(null);
    setTxCustomerId("");
    setTxAmount("");
    setTxDesc("");
    setBorcOpen(true);
  }

  async function submitTx(type: "CREDIT" | "DEBIT") {
    if (!txCustomerId) {
      setTxErr("Müşteri seçin.");
      return;
    }
    const n = Number(txAmount.replace(",", "."));
    if (!n || n <= 0) {
      setTxErr("Geçerli tutar girin.");
      return;
    }
    setTxBusy(true);
    setTxErr(null);
    try {
      await createFinanceTransaction(txCustomerId, {
        type,
        amount: n,
        description: txDesc || undefined,
      });
      setTahsilOpen(false);
      setBorcOpen(false);
      await load();
    } catch (e) {
      setTxErr(e instanceof Error ? e.message : "Kayıt başarısız");
    } finally {
      setTxBusy(false);
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
    <div className="space-y-8 pb-10">
      <PageHeader
        title="Cari hesaplar"
        description="Muhasebe özeti: bakiye, kredi limiti ve risk. Sipariş borç kaydı ve tahsilatlar otomatik bakiyeyi günceller."
      >
        {canPost ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={openTahsilat}
            >
              <ArrowDownLeft className="size-3.5" />
              Tahsilat ekle
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="gap-1.5"
              onClick={openBorc}
            >
              <ArrowUpRight className="size-3.5" />
              Borç ekle
            </Button>
          </div>
        ) : null}
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border/80 rounded-2xl shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Landmark className="size-4 opacity-60" />
              Toplam pozitif bakiye
            </CardTitle>
            <CardDescription className="text-xs">
              Tahsil edilmemiş borç (TRY)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums tracking-tight">
              {stats ? formatTry(String(stats.receivables)) : "—"}
            </p>
          </CardContent>
        </Card>
        <Card className="border-amber-500/25 rounded-2xl bg-amber-500/[0.04] shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-950 dark:text-amber-100">
              Limite yakın
            </CardTitle>
            <CardDescription className="text-xs text-amber-900/80 dark:text-amber-200/80">
              Borç &gt; %80 limit
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums text-amber-950 dark:text-amber-100">
              {stats?.near ?? "—"}
            </p>
          </CardContent>
        </Card>
        <Card className="border-red-500/25 rounded-2xl bg-red-500/[0.04] shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-950 dark:text-red-100">
              Limit aşımı
            </CardTitle>
            <CardDescription className="text-xs text-red-900/80 dark:text-red-200/80">
              Bakiye &gt; kredi limiti
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums text-red-950 dark:text-red-100">
              {stats?.over ?? "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {err ? (
        <p className="text-destructive text-sm">{err}</p>
      ) : null}

      <Card className="border-border/80 rounded-2xl shadow-sm">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Hesap listesi</CardTitle>
            <CardDescription>
              Satıra tıklayarak deftere girin. Kredi limiti aşımında yeni sipariş
              ve manuel borç engellenir.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => void load()}
          >
            Yenile
          </Button>
        </CardHeader>
        <CardContent>
          {rows === null ? (
            <Skeleton className="h-64 w-full rounded-xl" />
          ) : rows.length === 0 ? (
            <EmptyState
              title="Hesap yok"
              description="Müşteri kartı açılan kullanıcılar için cari hesap oluşturulur."
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/70">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Müşteri</TableHead>
                    <TableHead>Tip</TableHead>
                    <TableHead className="text-right">Bakiye</TableHead>
                    <TableHead className="text-right">Kredi limiti</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead>Son işlem</TableHead>
                    <TableHead className="w-[100px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const risk = cariRiskLevel(
                      r.balance,
                      r.customer.type,
                      r.customer.creditEnabled ?? false,
                      r.customer.creditLimit ?? null,
                    );
                    const tone = balanceTone(r.balance);
                    const limitStr =
                      r.customer.type === "CORPORATE" &&
                      (r.customer.creditEnabled ?? false) &&
                      r.customer.creditLimit != null &&
                      String(r.customer.creditLimit).length > 0
                        ? formatTry(r.customer.creditLimit!)
                        : "—";
                    return (
                      <TableRow
                        key={r.id}
                        className={cn("cursor-pointer", cariRowClass(risk, r.balance))}
                        onClick={() =>
                          router.push(`/finance/accounts/${r.customerId}`)
                        }
                      >
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{r.customer.name}</span>
                            <span className="text-muted-foreground min-w-0 max-w-[min(100%,300px)] truncate text-xs">
                              {r.customer.email}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-normal">
                            {typeLabel(r.customer.type)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-col items-end gap-0.5">
                            <span
                              className={cn(
                                "font-semibold tabular-nums",
                                tone.className,
                              )}
                            >
                              {formatTry(r.balance)}
                            </span>
                            <span className="text-muted-foreground text-[10px]">
                              {tone.label}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {limitStr}
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold",
                              cariRiskBadgeClass(risk, r.balance),
                            )}
                          >
                            {cariRiskLabel(risk, r.balance)}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                          {r.lastTransactionAt
                            ? formatDateTimeTr(r.lastTransactionAt)
                            : "—"}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Link
                            href={`/finance/accounts/${r.customerId}`}
                            className={cn(
                              buttonVariants({ variant: "ghost", size: "sm" }),
                            )}
                          >
                            Defter
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={tahsilOpen} onOpenChange={setTahsilOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Tahsilat ekle</DialogTitle>
            <DialogDescription>
              Alacak (CREDIT) kaydı müşteri borcunu düşürür.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="tc">Müşteri</Label>
              <select
                id="tc"
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                value={txCustomerId}
                onChange={(e) => setTxCustomerId(e.target.value)}
              >
                <option value="">Seçin</option>
                {(rows ?? []).map((r) => (
                  <option key={r.customerId} value={r.customerId}>
                    {r.customer.name} · {r.customer.email}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ta">Tutar (TRY)</Label>
              <Input
                id="ta"
                inputMode="decimal"
                value={txAmount}
                onChange={(e) => setTxAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="td">Açıklama</Label>
              <Input
                id="td"
                value={txDesc}
                onChange={(e) => setTxDesc(e.target.value)}
              />
            </div>
            {txErr ? (
              <p className="text-destructive text-sm">{txErr}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setTahsilOpen(false)}
            >
              Vazgeç
            </Button>
            <Button
              type="button"
              disabled={txBusy}
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => void submitTx("CREDIT")}
            >
              {txBusy ? "Kaydediliyor…" : "Tahsilat kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={borcOpen} onOpenChange={setBorcOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Borç ekle</DialogTitle>
            <DialogDescription>
              Borç (DEBIT) bakiyeyi artırır. Kredi limiti tanımlı müşterilerde
              limit aşılırsa kayıt reddedilir.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="bc">Müşteri</Label>
              <select
                id="bc"
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                value={txCustomerId}
                onChange={(e) => setTxCustomerId(e.target.value)}
              >
                <option value="">Seçin</option>
                {(rows ?? []).map((r) => (
                  <option key={r.customerId} value={r.customerId}>
                    {r.customer.name} · {r.customer.email}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ba">Tutar (TRY)</Label>
              <Input
                id="ba"
                inputMode="decimal"
                value={txAmount}
                onChange={(e) => setTxAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bd">Açıklama</Label>
              <Input
                id="bd"
                value={txDesc}
                onChange={(e) => setTxDesc(e.target.value)}
              />
            </div>
            {txErr ? (
              <p className="text-destructive text-sm">{txErr}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setBorcOpen(false)}
            >
              Vazgeç
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={txBusy}
              onClick={() => void submitTx("DEBIT")}
            >
              {txBusy ? "Kaydediliyor…" : "Borç kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
