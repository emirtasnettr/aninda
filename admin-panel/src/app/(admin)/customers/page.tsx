"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LayoutGrid, List, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
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
import { fetchCustomers } from "@/lib/api/customers.api";
import { fetchFinanceTransactions } from "@/lib/api/finance.api";
import { fetchOrders } from "@/lib/api/orders";
import type { Customer, CustomerTransaction } from "@/lib/api/erp-types";
import type { Order } from "@/lib/api/types";
import {
  balanceTone,
  lastTransactionByCustomerId,
  orderStatsByUserId,
  parseBalance,
} from "@/lib/customer-aggregates";
import {
  canViewCustomers,
  canViewFinance,
} from "@/lib/auth-storage";
import { formatDateTimeTr } from "@/lib/format-date";
import { formatTry } from "@/lib/format-currency";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";

function typeLabel(t: string): string {
  return t === "CORPORATE" ? "Kurumsal" : "Bireysel";
}

function typeBadgeClass(t: string): string {
  return t === "CORPORATE"
    ? "border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-100"
    : "border-zinc-200 bg-zinc-50 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";
}

function txTypeLabel(t: string): string {
  return t === "DEBIT" ? "Borç kaydı" : "Alacak / tahsilat";
}

export default function CustomersListPage() {
  const router = useRouter();
  const { user } = useAuth();
  const allowed = user && canViewCustomers(user.role);
  const financeOk = user && canViewFinance(user.role);

  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [lastTxByCustomer, setLastTxByCustomer] = useState<
    Map<string, CustomerTransaction>
  >(new Map());
  const [err, setErr] = useState<string | null>(null);
  const [view, setView] = useState<"cards" | "table">("table");

  useEffect(() => {
    if (user && !allowed) router.replace("/dashboard");
  }, [user, allowed, router]);

  useEffect(() => {
    if (!allowed) return;
    let c = false;
    (async () => {
      try {
        const [custList, orderList] = await Promise.all([
          fetchCustomers(),
          fetchOrders(),
        ]);
        if (c) return;
        setCustomers(custList);
        setOrders(orderList);
        if (financeOk) {
          try {
            const txs = await fetchFinanceTransactions();
            if (!c) setLastTxByCustomer(lastTransactionByCustomerId(txs));
          } catch {
            if (!c) setLastTxByCustomer(new Map());
          }
        } else {
          setLastTxByCustomer(new Map());
        }
      } catch (e) {
        if (!c) setErr(e instanceof Error ? e.message : "Liste yüklenemedi");
      }
    })();
    return () => {
      c = true;
    };
  }, [allowed, financeOk]);

  const statsByUserId = useMemo(() => {
    if (!customers || !orders) {
      return new Map<
        string,
        { count: number; lastOrderAt: string | null; revenueDelivered: number }
      >();
    }
    return orderStatsByUserId(orders, customers.map((x) => x.userId));
  }, [customers, orders]);

  if (!user || !allowed) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-10">
      <PageHeader
        title="Müşteriler"
        description="CRM kartları, cari bakiye özeti ve sipariş metrikleri. Detayda finans hareketleri ve fiyat kuralları."
      >
        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-muted/60 flex rounded-lg border p-0.5">
            <button
              type="button"
              onClick={() => setView("cards")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                view === "cards"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <LayoutGrid className="size-3.5" />
              Kartlar
            </button>
            <button
              type="button"
              onClick={() => setView("table")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                view === "table"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <List className="size-3.5" />
              Tablo
            </button>
          </div>
        </div>
      </PageHeader>

      {err ? (
        <p className="text-destructive text-sm">{err}</p>
      ) : customers === null || orders === null ? (
        <Card className="rounded-2xl border-border/70 shadow-sm">
          <CardContent className="space-y-3 p-4">
            <Skeleton className="h-9 w-full rounded-md" />
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-md" />
            ))}
          </CardContent>
        </Card>
      ) : customers.length === 0 ? (
        <EmptyState
          title="Müşteri yok"
          description="Müşteri rolüyle kayıt olan kullanıcılar burada listelenir."
        />
      ) : view === "cards" ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {customers.map((r) => {
            const bal = parseBalance(r.account?.balance);
            const tone = balanceTone(bal);
            const st = statsByUserId.get(r.userId);
            const lastTx = lastTxByCustomer.get(r.id);
            return (
              <Link key={r.id} href={`/customers/${r.id}`} className="group block">
                <Card
                  className={cn(
                    "h-full border-border/70 shadow-sm transition-all duration-200",
                    "rounded-2xl hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-lg",
                  )}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <CardTitle className="truncate text-lg leading-tight">
                          {r.name}
                        </CardTitle>
                        <CardDescription className="mt-1 truncate text-xs">
                          {r.email}
                        </CardDescription>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                          typeBadgeClass(r.type),
                        )}
                      >
                        {typeLabel(r.type)}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                          Cari
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {tone.label}
                        </Badge>
                      </div>
                      <p
                        className={cn(
                          "mt-1 text-2xl font-semibold tabular-nums tracking-tight",
                          tone.className,
                        )}
                      >
                        {r.account ? formatTry(r.account.balance) : "—"}
                      </p>
                      {lastTx && financeOk ? (
                        <p className="text-muted-foreground mt-2 line-clamp-2 text-[11px] leading-snug">
                          <span className="font-medium text-foreground/80">
                            Son:
                          </span>{" "}
                          {txTypeLabel(lastTx.type)} ·{" "}
                          {formatTry(lastTx.amount)} ·{" "}
                          {formatDateTimeTr(lastTx.createdAt)}
                        </p>
                      ) : null}
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-lg border border-border/50 bg-card px-3 py-2">
                        <div className="text-muted-foreground flex items-center gap-1 text-[10px] font-semibold uppercase">
                          <Package className="size-3" />
                          Sipariş
                        </div>
                        <p className="mt-0.5 text-lg font-semibold tabular-nums">
                          {st?.count ?? 0}
                        </p>
                      </div>
                      <div className="rounded-lg border border-border/50 bg-card px-3 py-2">
                        <div className="text-muted-foreground text-[10px] font-semibold uppercase">
                          Son sipariş
                        </div>
                        <p className="mt-0.5 text-xs font-medium leading-tight">
                          {st?.lastOrderAt
                            ? formatDateTimeTr(st.lastOrderAt)
                            : "—"}
                        </p>
                      </div>
                    </div>
                    <p className="text-primary flex items-center gap-1 text-xs font-semibold group-hover:gap-2">
                      Detay ve finans
                      <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                    </p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <Card className="rounded-2xl border-border/70 shadow-sm">
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Müşteri</TableHead>
                  <TableHead>Tip</TableHead>
                  <TableHead className="text-right">Bakiye</TableHead>
                  <TableHead className="text-center">Sipariş</TableHead>
                  <TableHead>Son sipariş</TableHead>
                  {financeOk ? <TableHead>Son işlem</TableHead> : null}
                  <TableHead className="w-[100px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((r) => {
                  const bal = parseBalance(r.account?.balance);
                  const tone = balanceTone(bal);
                  const st = statsByUserId.get(r.userId);
                  const lastTx = lastTxByCustomer.get(r.id);
                  return (
                    <TableRow
                      key={r.id}
                      className="hover:bg-muted/40 cursor-pointer transition-colors"
                    >
                      <TableCell
                        className="font-medium"
                        onClick={() => router.push(`/customers/${r.id}`)}
                      >
                        <div>{r.name}</div>
                        <div className="text-muted-foreground min-w-0 max-w-[min(100%,280px)] truncate text-xs">
                          {r.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "rounded-md border px-2 py-0.5 text-[10px] font-semibold",
                            typeBadgeClass(r.type),
                          )}
                        >
                          {typeLabel(r.type)}
                        </span>
                      </TableCell>
                      <TableCell
                        className={cn("text-right font-semibold tabular-nums", tone.className)}
                        onClick={() => router.push(`/customers/${r.id}`)}
                      >
                        {r.account ? formatTry(r.account.balance) : "—"}
                        <div className="text-muted-foreground text-[10px] font-normal">
                          {tone.label}
                        </div>
                      </TableCell>
                      <TableCell
                        className="text-center tabular-nums"
                        onClick={() => router.push(`/customers/${r.id}`)}
                      >
                        {st?.count ?? 0}
                      </TableCell>
                      <TableCell
                        className="text-muted-foreground text-sm whitespace-nowrap"
                        onClick={() => router.push(`/customers/${r.id}`)}
                      >
                        {st?.lastOrderAt
                          ? formatDateTimeTr(st.lastOrderAt)
                          : "—"}
                      </TableCell>
                      {financeOk ? (
                        <TableCell
                          className="min-w-0 max-w-[min(100%,280px)] text-xs"
                          onClick={() => router.push(`/customers/${r.id}`)}
                        >
                          {lastTx ? (
                            <>
                              {txTypeLabel(lastTx.type)} ·{" "}
                              {formatTry(lastTx.amount)}
                              <div className="text-muted-foreground">
                                {formatDateTimeTr(lastTx.createdAt)}
                              </div>
                            </>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      ) : null}
                      <TableCell>
                        <Link
                          href={`/customers/${r.id}`}
                          className={buttonVariants({
                            variant: "ghost",
                            size: "sm",
                          })}
                        >
                          Aç
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
