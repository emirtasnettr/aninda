"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Landmark, ShieldAlert } from "lucide-react";
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
  createFinanceTransaction,
  fetchFinanceAccount,
  fetchFinanceTransactions,
  type FinanceAccountDetail,
} from "@/lib/api/finance.api";
import type { CustomerTransaction } from "@/lib/api/erp-types";
import {
  cariRiskBadgeClass,
  cariRiskLabel,
  cariRiskLevel,
} from "@/lib/cari-risk";
import {
  canPostFinanceTransaction,
  canViewFinance,
} from "@/lib/auth-storage";
import { formatDateTimeTr } from "@/lib/format-date";
import { formatTry } from "@/lib/format-currency";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";

function num(s: string): number {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

type LedgerRow = {
  id: string;
  createdAt: string;
  description: string | null;
  borc: string | null;
  alacak: string | null;
  balanceAfter: string;
};

function buildLedger(
  txs: CustomerTransaction[],
  currentBalanceStr: string,
): LedgerRow[] {
  const sortedDesc = [...txs].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  let bal = num(currentBalanceStr);
  const out: LedgerRow[] = [];
  for (const t of sortedDesc) {
    const amt = num(t.amount);
    out.push({
      id: t.id,
      createdAt: t.createdAt,
      description: t.description,
      borc: t.type === "DEBIT" ? t.amount : null,
      alacak: t.type === "CREDIT" ? t.amount : null,
      balanceAfter: bal.toFixed(2),
    });
    const delta = t.type === "DEBIT" ? amt : -amt;
    bal -= delta;
  }
  return out;
}

export default function FinanceAccountDetailPage() {
  const params = useParams();
  const customerId =
    typeof params.customerId === "string" ? params.customerId : "";
  const router = useRouter();
  const { user } = useAuth();
  const allowed = user && canViewFinance(user.role);
  const canPost = user && canPostFinanceTransaction(user.role);

  const [acc, setAcc] = useState<FinanceAccountDetail | null>(null);
  const [txs, setTxs] = useState<CustomerTransaction[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [amount, setAmount] = useState("");
  const [txType, setTxType] = useState<"DEBIT" | "CREDIT">("CREDIT");
  const [description, setDescription] = useState("");

  const load = useCallback(async () => {
    if (!customerId || !allowed) return;
    setErr(null);
    try {
      const [a, t] = await Promise.all([
        fetchFinanceAccount(customerId),
        fetchFinanceTransactions(customerId),
      ]);
      setAcc(a);
      setTxs(t);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Yüklenemedi");
    }
  }, [customerId, allowed]);

  useEffect(() => {
    if (user && !allowed) router.replace("/dashboard");
  }, [user, allowed, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const ledger = useMemo(() => {
    if (!txs || !acc) return [];
    return buildLedger(txs, acc.balance);
  }, [txs, acc]);

  const risk = acc
    ? cariRiskLevel(
        acc.balance,
        acc.customer.type as "INDIVIDUAL" | "CORPORATE",
        acc.customer.creditEnabled ?? false,
        acc.customer.creditLimit ?? null,
      )
    : "no_limit_line";

  async function onAddTx(e: React.FormEvent) {
    e.preventDefault();
    if (!canPost || !customerId) return;
    const n = Number(amount.replace(",", "."));
    if (!n || n <= 0) {
      setErr("Geçerli bir tutar girin.");
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      await createFinanceTransaction(customerId, {
        type: txType,
        amount: n,
        description: description || undefined,
      });
      setAmount("");
      setDescription("");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "İşlem eklenemedi");
    } finally {
      setSubmitting(false);
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

  const limitDisplay =
    acc &&
    acc.customer.type === "CORPORATE" &&
    (acc.customer.creditEnabled ?? false) &&
    acc.customer.creditLimit != null &&
    String(acc.customer.creditLimit).length > 0
      ? formatTry(acc.customer.creditLimit!)
      : "—";

  return (
    <div className="space-y-8 pb-10">
      <PageHeader
        title={acc?.customer.name ?? "Cari defter"}
        description={acc?.customer.email ?? "Hareketler ve bakiye"}
      >
        <div className="flex flex-wrap gap-2">
          <Link
            href="/finance/accounts"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "gap-1.5",
            )}
          >
            <ArrowLeft className="size-3.5" />
            Hesaplar
          </Link>
          {acc ? (
            <Link
              href={`/customers/${acc.customerId}`}
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            >
              Müşteri kartı
            </Link>
          ) : null}
        </div>
      </PageHeader>

      {err ? <p className="text-destructive text-sm">{err}</p> : null}

      {!acc ? (
        <Skeleton className="h-48 w-full rounded-2xl" />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="border-border/80 rounded-2xl shadow-sm lg:col-span-1">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Landmark className="size-4 opacity-60" />
                  Bakiye
                </CardTitle>
                <CardDescription>
                  Borç artışı: sipariş + manuel DEBIT. Tahsilat: CREDIT.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p
                  className={cn(
                    "text-3xl font-bold tabular-nums tracking-tight",
                    num(acc.balance) > 0
                      ? "text-amber-800 dark:text-amber-200"
                      : num(acc.balance) < 0
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-muted-foreground",
                  )}
                >
                  {formatTry(acc.balance)}
                </p>
                <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
                  Pozitif: müşterinin size borcu. Negatif: ön ödeme / lehte
                  bakiye.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/80 rounded-2xl shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Kredi limiti</CardTitle>
                <CardDescription>
                  Kurumsal cari borç izni açıksa geçerli üst sınır
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">
                  {limitDisplay}
                </p>
                {acc.customer.type === "CORPORATE" &&
                (acc.customer.creditEnabled ?? false) ? (
                  <p className="text-muted-foreground mt-2 text-xs">
                    Cari borç kullanımı açık
                  </p>
                ) : (
                  <p className="text-muted-foreground mt-2 text-xs">
                    Peşin / limit dışı cari
                  </p>
                )}
              </CardContent>
            </Card>

            <Card
              className={cn(
                "rounded-2xl border shadow-sm",
                risk === "over_limit" && "border-red-500/35 bg-red-500/[0.04]",
                risk === "near_limit" &&
                  "border-amber-500/35 bg-amber-500/[0.04]",
                risk === "normal" &&
                  "border-emerald-500/25 bg-emerald-500/[0.03]",
              )}
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldAlert className="size-4 opacity-70" />
                  Risk durumu
                </CardTitle>
                <CardDescription>Limit kullanımına göre</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <span
                  className={cn(
                    "inline-flex rounded-md border px-3 py-1 text-sm font-semibold",
                    cariRiskBadgeClass(risk, acc.balance),
                  )}
                >
                  {cariRiskLabel(risk, acc.balance)}
                </span>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Yeni sipariş ve manuel borç, tanımlı limiti aşmayı engeller
                  (kurumsal cari borç açık müşteriler).
                </p>
              </CardContent>
            </Card>
          </div>

          {canPost ? (
            <Card className="border-border/80 rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Manuel işlem</CardTitle>
                <CardDescription>
                  Tahsilat = CREDIT (borç düşer). Borç kaydı = DEBIT (borç
                  artar).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={onAddTx}
                  className="grid w-full gap-4 sm:grid-cols-2 2xl:grid-cols-3"
                >
                  <div className="space-y-2">
                    <Label htmlFor="txType">Tür</Label>
                    <select
                      id="txType"
                      className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                      value={txType}
                      onChange={(e) =>
                        setTxType(e.target.value as "DEBIT" | "CREDIT")
                      }
                    >
                      <option value="CREDIT">Tahsilat (alacak)</option>
                      <option value="DEBIT">Borç kaydı</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amount">Tutar (TRY)</Label>
                    <Input
                      id="amount"
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2 2xl:col-span-3">
                    <Label htmlFor="desc">Açıklama</Label>
                    <Input
                      id="desc"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                  <div className="sm:col-span-2 2xl:col-span-3">
                    <Button type="submit" disabled={submitting}>
                      {submitting ? "Kaydediliyor…" : "İşlem ekle"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : null}

          <Card className="border-border/80 rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Cari hesap ekstresi</CardTitle>
              <CardDescription>
                Tarih · açıklama · borç / alacak · işlem sonrası bakiye (en yeni
                üstte)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {txs === null ? (
                <Skeleton className="h-40 w-full rounded-lg" />
              ) : ledger.length === 0 ? (
                <p className="text-muted-foreground text-sm">Hareket yok.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border/70">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Tarih</TableHead>
                        <TableHead>Açıklama</TableHead>
                        <TableHead className="text-right tabular-nums">
                          Borç
                        </TableHead>
                        <TableHead className="text-right tabular-nums">
                          Alacak
                        </TableHead>
                        <TableHead className="text-right tabular-nums">
                          Bakiye
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ledger.map((row) => (
                        <TableRow
                          key={row.id}
                          className="hover:bg-muted/30 transition-colors"
                        >
                          <TableCell className="whitespace-nowrap text-sm">
                            {formatDateTimeTr(row.createdAt)}
                          </TableCell>
                          <TableCell className="min-w-[12rem] max-w-[360px] text-sm">
                            {row.description ?? "—"}
                          </TableCell>
                          <TableCell className="text-right text-sm tabular-nums text-amber-800 dark:text-amber-200">
                            {row.borc != null ? formatTry(row.borc) : "—"}
                          </TableCell>
                          <TableCell className="text-right text-sm tabular-nums text-emerald-700 dark:text-emerald-400">
                            {row.alacak != null ? formatTry(row.alacak) : "—"}
                          </TableCell>
                          <TableCell className="text-right text-sm font-semibold tabular-nums">
                            {formatTry(row.balanceAfter)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {acc ? (
                <Link
                  href={`/finance/transactions?customerId=${encodeURIComponent(acc.customerId)}`}
                  className={cn(
                    buttonVariants({ variant: "link", size: "sm" }),
                    "mt-3 h-auto px-0",
                  )}
                >
                  Tüm hareketleri filtrele →
                </Link>
              ) : null}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
