"use client";

import { useCallback, useEffect, useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  approvePayoutRequest,
  fetchPayoutRequests,
  markPayoutPaid,
  rejectPayoutRequest,
} from "@/lib/api/payout-requests.api";
import type { PayoutRequestRow, PayoutRequestStatus } from "@/lib/api/erp-types";
import {
  canMarkCourierPaid,
  canViewCourierEarnings,
} from "@/lib/auth-storage";
import { formatDateTimeTr } from "@/lib/format-date";
import { formatTry } from "@/lib/format-currency";
import { useAuth } from "@/context/auth-context";
import { courierDisplayName } from "@/lib/courier-display-name";
import { cn } from "@/lib/utils";

function statusBadge(status: PayoutRequestStatus) {
  const map: Record<
    PayoutRequestStatus,
    { label: string; className: string }
  > = {
    PENDING: {
      label: "Beklemede",
      className:
        "border-amber-500/50 bg-amber-500/15 text-amber-950 dark:text-amber-50",
    },
    APPROVED: {
      label: "Onaylandı",
      className:
        "border-blue-500/50 bg-blue-500/15 text-blue-950 dark:text-blue-50",
    },
    PAID: {
      label: "Ödendi",
      className:
        "border-emerald-500/50 bg-emerald-500/15 text-emerald-950 dark:text-emerald-50",
    },
    REJECTED: {
      label: "Reddedildi",
      className:
        "border-red-500/50 bg-red-500/15 text-red-950 dark:text-red-50",
    },
  };
  const x = map[status];
  return (
    <Badge variant="outline" className={cn("font-medium", x.className)}>
      {x.label}
    </Badge>
  );
}

export default function PayoutRequestsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const allowed = user && canViewCourierEarnings(user.role);
  const canAct = user && canMarkCourierPaid(user.role);

  const [rows, setRows] = useState<PayoutRequestRow[] | null>(null);
  const [filter, setFilter] = useState<"" | PayoutRequestStatus>("");
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [paidOpen, setPaidOpen] = useState(false);
  const [paidTargetId, setPaidTargetId] = useState<string | null>(null);
  const [receiptUrl, setReceiptUrl] = useState("");

  const load = useCallback(async () => {
    if (!allowed) return;
    setErr(null);
    try {
      const data = await fetchPayoutRequests(filter || undefined);
      setRows(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Liste yüklenemedi");
    }
  }, [allowed, filter]);

  useEffect(() => {
    if (user && !allowed) router.replace("/dashboard");
  }, [user, allowed, router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onApprove(id: string) {
    if (!canAct) return;
    setBusyId(id);
    setErr(null);
    try {
      await approvePayoutRequest(id);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Onaylanamadı");
    } finally {
      setBusyId(null);
    }
  }

  async function onReject(id: string) {
    if (!canAct) return;
    setBusyId(id);
    setErr(null);
    try {
      await rejectPayoutRequest(id);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Reddedilemedi");
    } finally {
      setBusyId(null);
    }
  }

  function openMarkPaid(id: string) {
    setPaidTargetId(id);
    setReceiptUrl("");
    setPaidOpen(true);
  }

  async function submitMarkPaid() {
    if (!canAct || !paidTargetId) return;
    setBusyId(paidTargetId);
    setErr(null);
    try {
      await markPayoutPaid(
        paidTargetId,
        receiptUrl.trim() ? receiptUrl.trim() : undefined,
      );
      setPaidOpen(false);
      setPaidTargetId(null);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ödeme işaretlenemedi");
    } finally {
      setBusyId(null);
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
        title="Ödeme talepleri"
        description="Kurye ödeme taleplerini onaylayın, reddedin veya ödendi olarak işaretleyin. Dekont bağlantısı isteğe bağlıdır."
      />

      {err ? <p className="text-destructive text-sm">{err}</p> : null}

      <Card className="border-0 shadow-md">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>Talepler</CardTitle>
            <CardDescription>
              Kurye, banka bilgisi ve talep edilebilir bakiye ile talep
              oluşturur; onay sonrası ödeme yapılıp dekont eklenebilir.
            </CardDescription>
          </div>
          <select
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            value={filter}
            onChange={(e) =>
              setFilter(e.target.value as "" | PayoutRequestStatus)
            }
          >
            <option value="">Tümü</option>
            <option value="PENDING">Beklemede</option>
            <option value="APPROVED">Onaylandı</option>
            <option value="PAID">Ödendi</option>
            <option value="REJECTED">Reddedildi</option>
          </select>
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
                    <TableHead>Tarih</TableHead>
                    <TableHead>Kurye</TableHead>
                    <TableHead>Banka</TableHead>
                    <TableHead className="text-right">Tutar</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead className="text-right">İşlem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-muted-foreground whitespace-nowrap text-sm">
                        {formatDateTimeTr(r.createdAt)}
                      </TableCell>
                      <TableCell className="min-w-[10rem] max-w-[min(100%,280px)]">
                        <span className="font-medium">
                          {courierDisplayName(r.courier)}
                        </span>
                        <span className="text-muted-foreground block truncate text-xs">
                          {r.courier.user.email}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[200px] text-xs">
                        {r.courier.bankName ? (
                          <>
                            <span className="font-medium">
                              {r.courier.bankName}
                            </span>
                            <span className="text-muted-foreground mt-0.5 block">
                              {r.courier.accountHolderName ?? "—"}
                            </span>
                            <span className="font-mono text-[11px]">
                              {r.courier.iban ?? "—"}
                            </span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatTry(r.amount)}
                      </TableCell>
                      <TableCell>{statusBadge(r.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          {canAct && r.status === "PENDING" ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={busyId === r.id}
                              onClick={() => void onApprove(r.id)}
                            >
                              Onayla
                            </Button>
                          ) : null}
                          {canAct &&
                          (r.status === "PENDING" || r.status === "APPROVED") ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={busyId === r.id}
                              onClick={() => void onReject(r.id)}
                            >
                              Reddet
                            </Button>
                          ) : null}
                          {canAct && r.status === "APPROVED" ? (
                            <Button
                              type="button"
                              size="sm"
                              disabled={busyId === r.id}
                              onClick={() => openMarkPaid(r.id)}
                            >
                              Ödendi
                            </Button>
                          ) : null}
                          {r.status === "PAID" && r.receiptUrl ? (
                            <a
                              href={r.receiptUrl}
                              target="_blank"
                              rel="noreferrer"
                              className={cn(
                                buttonVariants({ variant: "ghost", size: "sm" }),
                              )}
                            >
                              Dekont
                            </a>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={paidOpen} onOpenChange={setPaidOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ödendi olarak işaretle</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="receipt">Dekont URL (isteğe bağlı)</Label>
            <Input
              id="receipt"
              placeholder="https://…"
              value={receiptUrl}
              onChange={(e) => setReceiptUrl(e.target.value)}
            />
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPaidOpen(false)}
            >
              Vazgeç
            </Button>
            <Button
              type="button"
              disabled={!paidTargetId || busyId === paidTargetId}
              onClick={() => void submitMarkPaid()}
            >
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
