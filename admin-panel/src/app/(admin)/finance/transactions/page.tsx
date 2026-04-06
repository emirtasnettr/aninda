"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { fetchFinanceTransactions } from "@/lib/api/finance.api";
import type { CustomerTransaction } from "@/lib/api/erp-types";
import { canViewFinance } from "@/lib/auth-storage";
import { formatDateTimeTr } from "@/lib/format-date";
import { formatTry } from "@/lib/format-currency";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";

function TransactionsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filterCustomerId = searchParams.get("customerId") ?? undefined;
  const { user } = useAuth();
  const allowed = user && canViewFinance(user.role);

  const [rows, setRows] = useState<CustomerTransaction[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (user && !allowed) router.replace("/dashboard");
  }, [user, allowed, router]);

  useEffect(() => {
    if (!allowed) return;
    let c = false;
    (async () => {
      try {
        const data = await fetchFinanceTransactions(filterCustomerId);
        if (!c) setRows(data);
      } catch (e) {
        if (!c) setErr(e instanceof Error ? e.message : "Liste yüklenemedi");
      }
    })();
    return () => {
      c = true;
    };
  }, [allowed, filterCustomerId]);

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
        title="İşlem geçmişi"
        description={
          filterCustomerId
            ? "Seçili müşteriye göre filtrelenmiş cari hareketler."
            : "Tüm müşteri cari hareketleri (son 500 kayıt)."
        }
      >
        {filterCustomerId ? (
          <Link
            href="/finance/transactions"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Filtreyi kaldır
          </Link>
        ) : null}
      </PageHeader>

      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle>Hareketler</CardTitle>
          <CardDescription>
            Borç ve alacak kayıtları; sipariş oluşturma otomatik borç üretir.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {err ? (
            <p className="text-destructive text-sm">{err}</p>
          ) : rows === null ? (
            <Skeleton className="h-48 w-full rounded-lg" />
          ) : rows.length === 0 ? (
            <EmptyState
              title="Kayıt yok"
              description="Bu filtreye uygun işlem bulunamadı."
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tarih</TableHead>
                    <TableHead>Müşteri</TableHead>
                    <TableHead>Tür</TableHead>
                    <TableHead>Açıklama</TableHead>
                    <TableHead className="text-right">Tutar</TableHead>
                    <TableHead className="w-[100px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-muted-foreground whitespace-nowrap text-sm">
                        {formatDateTimeTr(r.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{r.customer.name}</div>
                        <div className="text-muted-foreground min-w-0 max-w-[min(100%,260px)] truncate text-xs">
                          {r.customer.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            r.type === "DEBIT" ? "destructive" : "secondary"
                          }
                        >
                          {r.type === "DEBIT" ? "Borç" : "Alacak"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground min-w-[12rem] max-w-[320px] truncate text-sm">
                        {r.description ?? "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatTry(r.amount)}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/finance/accounts/${r.customerId}`}
                          className={cn(
                            buttonVariants({ variant: "ghost", size: "sm" }),
                          )}
                        >
                          Hesap
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

export default function FinanceTransactionsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      }
    >
      <TransactionsInner />
    </Suspense>
  );
}
