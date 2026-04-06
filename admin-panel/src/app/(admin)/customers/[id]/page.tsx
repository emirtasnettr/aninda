"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Banknote,
  CreditCard,
  Pencil,
  Plus,
  Receipt,
  ShoppingBag,
  Wallet,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
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
import {
  fetchCustomer,
  fetchCustomerOrders,
  patchCustomerCreditSettings,
  updateCustomer,
} from "@/lib/api/customers.api";
import {
  createFinanceTransaction,
  fetchFinanceTransactions,
} from "@/lib/api/finance.api";
import type { Customer } from "@/lib/api/erp-types";
import type { Order } from "@/lib/api/types";
import {
  balanceTone,
  orderStatsByUserId,
  parseBalance,
} from "@/lib/customer-aggregates";
import {
  canAssignCourier,
  canEditCustomerProfile,
  canManageCustomerCredit,
  canPostFinanceTransaction,
  canViewCustomers,
  canViewFinance,
} from "@/lib/auth-storage";
import { formatDateTimeTr } from "@/lib/format-date";
import { formatTry } from "@/lib/format-currency";
import { orderOpsBadgeClass } from "@/lib/order-table-styles";
import { orderStatusLabel } from "@/lib/order-status";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";

function typeLabel(t: string): string {
  return t === "CORPORATE" ? "Kurumsal" : "Bireysel";
}

export default function CustomerDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const router = useRouter();
  const { user } = useAuth();
  const allowed = user && canViewCustomers(user.role);
  const canEdit = user && canEditCustomerProfile(user.role);
  const showFinance = user && canViewFinance(user.role);
  const canPostTx = user && canPostFinanceTransaction(user.role);
  const canDispatch = user && canAssignCourier(user.role);
  const canCreditAdmin = user && canManageCustomerCredit(user.role);

  const [c, setC] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [transactions, setTransactions] = useState<
    Awaited<ReturnType<typeof fetchFinanceTransactions>> | null
  >(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [balanceDialog, setBalanceDialog] = useState(false);
  const [txAmount, setTxAmount] = useState("");
  const [txType, setTxType] = useState<"CREDIT" | "DEBIT">("CREDIT");
  const [txDesc, setTxDesc] = useState("");
  const [txSubmitting, setTxSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [type, setType] = useState<"INDIVIDUAL" | "CORPORATE">("INDIVIDUAL");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [creditEnabledDraft, setCreditEnabledDraft] = useState(false);
  const [creditLimitDraft, setCreditLimitDraft] = useState("");
  const [creditSaving, setCreditSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id || !allowed) return;
    setErr(null);
    try {
      const [cust, ords] = await Promise.all([
        fetchCustomer(id),
        fetchCustomerOrders(id),
      ]);
      setC(cust);
      setOrders(ords);
      setName(cust.name);
      setType(cust.type);
      setPhone(cust.phone ?? "");
      setEmail(cust.email);
      setAddress(cust.address ?? "");
      setTaxNumber(cust.taxNumber ?? "");
      setCreditEnabledDraft(!!cust.creditEnabled);
      setCreditLimitDraft(
        cust.creditLimit != null && String(cust.creditLimit).length > 0
          ? String(cust.creditLimit)
          : "",
      );
      if (showFinance) {
        try {
          const txs = await fetchFinanceTransactions(id);
          setTransactions(txs);
        } catch {
          setTransactions([]);
        }
      } else {
        setTransactions(null);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Yüklenemedi");
    }
  }, [id, allowed, showFinance]);

  useEffect(() => {
    if (user && !allowed) router.replace("/dashboard");
  }, [user, allowed, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const revenue = useMemo(() => {
    if (!orders || !c) return 0;
    const m = orderStatsByUserId(orders, [c.userId]);
    return m.get(c.userId)?.revenueDelivered ?? 0;
  }, [orders, c]);

  const balanceNum = parseBalance(c?.account?.balance);
  const tone = balanceTone(balanceNum);
  const lastTx = transactions?.[0] ?? null;

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit || !id) return;
    setSaving(true);
    setErr(null);
    try {
      const updated = await updateCustomer(id, {
        name,
        type,
        phone: phone || undefined,
        email,
        address: address || undefined,
        taxNumber: taxNumber || undefined,
      });
      setC(updated);
      setCreditEnabledDraft(!!updated.creditEnabled);
      setCreditLimitDraft(
        updated.creditLimit != null && String(updated.creditLimit).length > 0
          ? String(updated.creditLimit)
          : "",
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  }

  async function onSaveCredit(e: React.FormEvent) {
    e.preventDefault();
    if (!canCreditAdmin || !id || c?.type !== "CORPORATE") return;
    setErr(null);
    if (creditEnabledDraft) {
      const n = Number(creditLimitDraft.replace(",", "."));
      if (!Number.isFinite(n) || n < 0.01) {
        setErr("Borç izni açıkken geçerli bir kredi limiti girin (min 0,01 ₺).");
        return;
      }
      setCreditSaving(true);
      try {
        const updated = await patchCustomerCreditSettings(id, {
          creditEnabled: true,
          creditLimit: n,
        });
        setC(updated);
        setCreditEnabledDraft(!!updated.creditEnabled);
        setCreditLimitDraft(
          updated.creditLimit != null ? String(updated.creditLimit) : "",
        );
      } catch (err) {
        setErr(err instanceof Error ? err.message : "Kaydedilemedi");
      } finally {
        setCreditSaving(false);
      }
      return;
    }
    setCreditSaving(true);
    try {
      const updated = await patchCustomerCreditSettings(id, {
        creditEnabled: false,
      });
      setC(updated);
      setCreditEnabledDraft(false);
      setCreditLimitDraft("");
    } catch (err) {
      setErr(err instanceof Error ? err.message : "Kaydedilemedi");
    } finally {
      setCreditSaving(false);
    }
  }

  async function onPostTransaction() {
    if (!canPostTx || !id) return;
    const n = Number(txAmount.replace(",", "."));
    if (!n || n <= 0) {
      setErr("Geçerli tutar girin.");
      return;
    }
    setTxSubmitting(true);
    setErr(null);
    try {
      await createFinanceTransaction(id, {
        type: txType,
        amount: n,
        description: txDesc || undefined,
      });
      setBalanceDialog(false);
      setTxAmount("");
      setTxDesc("");
      setTxType("CREDIT");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "İşlem eklenemedi");
    } finally {
      setTxSubmitting(false);
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
    <div className="space-y-8 pb-12">
      <PageHeader
        title={c?.name ?? "Müşteri"}
        description={c ? c.email : "CRM ve cari merkezi"}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/customers"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
          >
            <ArrowLeft className="size-3.5" />
            Listeye dön
          </Link>
          {c ? (
            <Link
              href={`/orders?q=${encodeURIComponent(c.email)}`}
              className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "gap-1.5")}
            >
              <ShoppingBag className="size-3.5" />
              Siparişleri gör
            </Link>
          ) : null}
          {canDispatch ? (
            <Link
              href="/operations"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
            >
              Dispatch
            </Link>
          ) : null}
          {canPostTx && c ? (
            <Button
              type="button"
              size="sm"
              variant="default"
              className="gap-1.5"
              onClick={() => setBalanceDialog(true)}
            >
              <Banknote className="size-3.5" />
              Bakiye işlemi
            </Button>
          ) : null}
        </div>
      </PageHeader>

      {err ? <p className="text-destructive text-sm">{err}</p> : null}

      <Dialog open={balanceDialog} onOpenChange={setBalanceDialog}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Cari işlem</DialogTitle>
            <DialogDescription>
              Alacak (tahsilat) bakiyeyi düşürür; borç kaydı bakiyeyi artırır.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="txt">Tür</Label>
              <select
                id="txt"
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                value={txType}
                onChange={(e) =>
                  setTxType(e.target.value as "CREDIT" | "DEBIT")
                }
              >
                <option value="CREDIT">Alacak / tahsilat</option>
                <option value="DEBIT">Borç kaydı</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="txa">Tutar (TRY)</Label>
              <Input
                id="txa"
                inputMode="decimal"
                value={txAmount}
                onChange={(e) => setTxAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="txd">Açıklama</Label>
              <Input
                id="txd"
                value={txDesc}
                onChange={(e) => setTxDesc(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setBalanceDialog(false)}
            >
              Vazgeç
            </Button>
            <Button
              type="button"
              disabled={txSubmitting}
              onClick={() => void onPostTransaction()}
            >
              {txSubmitting ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!c ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : (
        <>
          <div className="grid gap-5 lg:grid-cols-3">
            <Card className="border-border/70 rounded-2xl shadow-sm lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Pencil className="size-4 opacity-60" />
                    Müşteri bilgileri
                  </CardTitle>
                  <CardDescription>
                    Kullanıcı: {c.user?.email ?? "—"} · {c.user?.role ?? "—"}
                  </CardDescription>
                </div>
                {canEdit ? (
                  <Badge variant="outline" className="text-[10px]">
                    Düzenlenebilir
                  </Badge>
                ) : null}
              </CardHeader>
              <CardContent>
                {canEdit ? (
                  <form onSubmit={onSave} className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="name">Ad / unvan</Label>
                      <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="type">Tip</Label>
                      <select
                        id="type"
                        className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                        value={type}
                        onChange={(e) =>
                          setType(e.target.value as "INDIVIDUAL" | "CORPORATE")
                        }
                      >
                        <option value="INDIVIDUAL">Bireysel</option>
                        <option value="CORPORATE">Kurumsal</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Telefon</Label>
                      <Input
                        id="phone"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="email">E-posta</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="address">Adres</Label>
                      <Input
                        id="address"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                      />
                    </div>
                    {type === "CORPORATE" ? (
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="tax">Vergi no</Label>
                        <Input
                          id="tax"
                          value={taxNumber}
                          onChange={(e) => setTaxNumber(e.target.value)}
                        />
                      </div>
                    ) : null}
                    <div className="sm:col-span-2">
                      <Button type="submit" disabled={saving}>
                        {saving ? "Kaydediliyor…" : "Müşteriyi kaydet"}
                      </Button>
                    </div>
                  </form>
                ) : (
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-muted-foreground">Tip</dt>
                      <dd className="mt-1">
                        <span
                          className={cn(
                            "rounded-md border px-2 py-0.5 text-xs font-semibold",
                            c.type === "CORPORATE"
                              ? "border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-100"
                              : "border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900",
                          )}
                        >
                          {typeLabel(c.type)}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Telefon</dt>
                      <dd className="mt-1">{c.phone ?? "—"}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-muted-foreground">Adres</dt>
                      <dd className="mt-1">{c.address ?? "—"}</dd>
                    </div>
                  </dl>
                )}
              </CardContent>
            </Card>

            <div className="flex flex-col gap-5">
              <Card className="border-border/70 rounded-2xl shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Cari hesap</CardTitle>
                  <CardDescription>Borç / alacak özeti</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-xl border border-border/60 bg-muted/15 px-4 py-4">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                        Bakiye
                      </span>
                      <Badge variant="outline">{tone.label}</Badge>
                    </div>
                    <p
                      className={cn(
                        "mt-1 text-3xl font-bold tabular-nums tracking-tight",
                        tone.className,
                      )}
                    >
                      {c.account ? formatTry(c.account.balance) : "—"}
                    </p>
                    <p className="text-muted-foreground mt-2 text-[11px] leading-relaxed">
                      Pozitif: müşterinin size borcu. Negatif: lehine bakiye
                      (ön ödeme). Özet: toplam borç kayıtları − tahsilatlar
                      (cari hareketler).
                    </p>
                  </div>
                  {showFinance && lastTx ? (
                    <div className="rounded-lg border border-dashed px-3 py-2">
                      <p className="text-muted-foreground text-[10px] font-semibold uppercase">
                        Son işlem
                      </p>
                      <p className="mt-1 text-sm font-medium">
                        {lastTx.type === "DEBIT" ? "Borç" : "Alacak"} ·{" "}
                        {formatTry(lastTx.amount)}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {lastTx.description ?? "—"} ·{" "}
                        {formatDateTimeTr(lastTx.createdAt)}
                      </p>
                    </div>
                  ) : null}
                  {showFinance && c.account ? (
                    <div className="flex flex-col gap-2">
                      <Link
                        href={`/finance/accounts/${c.id}`}
                        className={buttonVariants({
                          variant: "secondary",
                          size: "sm",
                          className: "w-full justify-center",
                        })}
                      >
                        Cari detay
                      </Link>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              {c.type === "INDIVIDUAL" ? (
                <Card className="border-border/70 rounded-2xl shadow-sm opacity-90">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-muted-foreground flex items-center gap-2 text-base">
                      <Wallet className="size-4" />
                      Cari borç
                    </CardTitle>
                    <CardDescription>
                      Bireysel müşteriler borç kullanamaz; yalnızca peşin (ön
                      bakiye / tahsilat) ile sipariş verebilir.
                    </CardDescription>
                  </CardHeader>
                </Card>
              ) : (
                <Card
                  className={cn(
                    "border-border/70 rounded-2xl shadow-sm transition-colors",
                    c.creditEnabled
                      ? "border-emerald-500/25 bg-emerald-500/[0.03]"
                      : "opacity-90",
                  )}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Wallet className="size-4 opacity-70" />
                      Cari borç izni
                    </CardTitle>
                    <CardDescription>
                      Kurumsal müşteri; kapalıyken peşin, açıkken limit dahilinde
                      borçlanarak sipariş.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {canCreditAdmin ? (
                      <form className="space-y-4" onSubmit={onSaveCredit}>
                        <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 px-3 py-3">
                          <div>
                            <p className="text-sm font-medium">
                              Borç ile sipariş
                            </p>
                            <p className="text-muted-foreground text-xs">
                              Açık: bakiye limiti kadar artabilir
                            </p>
                          </div>
                          <Switch
                            checked={creditEnabledDraft}
                            onCheckedChange={setCreditEnabledDraft}
                            disabled={creditSaving}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label
                            htmlFor="creditLimit"
                            className={cn(
                              !creditEnabledDraft && "text-muted-foreground",
                            )}
                          >
                            Kredi limiti (TRY)
                          </Label>
                          <Input
                            id="creditLimit"
                            inputMode="decimal"
                            disabled={!creditEnabledDraft || creditSaving}
                            className={cn(
                              !creditEnabledDraft &&
                                "bg-muted/50 text-muted-foreground",
                            )}
                            value={creditLimitDraft}
                            onChange={(e) =>
                              setCreditLimitDraft(e.target.value)
                            }
                            placeholder={creditEnabledDraft ? "örn. 50000" : "—"}
                          />
                        </div>
                        <Button
                          type="submit"
                          size="sm"
                          disabled={creditSaving}
                        >
                          {creditSaving ? "Kaydediliyor…" : "Cari ayarları kaydet"}
                        </Button>
                      </form>
                    ) : (
                      <div className="space-y-2 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-muted-foreground">Durum:</span>
                          <Badge
                            variant={c.creditEnabled ? "default" : "secondary"}
                          >
                            {c.creditEnabled ? "Açık" : "Kapalı"}
                          </Badge>
                        </div>
                        {c.creditEnabled && c.creditLimit != null ? (
                          <p className="tabular-nums">
                            Limit:{" "}
                            <span className="font-semibold">
                              {formatTry(c.creditLimit)}
                            </span>
                          </p>
                        ) : null}
                        <p className="text-muted-foreground text-xs">
                          Değişiklik için ADMIN gerekir.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <Card className="border-border/70 rounded-2xl shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Receipt className="size-4 opacity-60" />
                    Ciro
                  </CardTitle>
                  <CardDescription>Teslim edilen siparişler</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                    {formatTry(revenue)}
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {orders?.filter((o) => o.status === "DELIVERED").length ?? 0}{" "}
                    teslim kaydı
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          <Card className="border-border/70 rounded-2xl shadow-sm">
            <CardHeader>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CreditCard className="size-4 opacity-60" />
                    Fiyatlandırma
                  </CardTitle>
                  <CardDescription>
                    Müşteriye özel taban + km ücreti
                  </CardDescription>
                </div>
                <Link
                  href={`/finance/pricing?customerId=${encodeURIComponent(c.id)}`}
                  className={buttonVariants({
                    variant: "outline",
                    size: "sm",
                    className: "gap-1.5",
                  })}
                >
                  <Plus className="size-3.5" />
                  Kural ekle / düzenle
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {c.pricingRules && c.pricingRules.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Taban (TRY)</TableHead>
                        <TableHead>Km başı (TRY)</TableHead>
                        <TableHead>Min</TableHead>
                        <TableHead>Gece×</TableHead>
                        <TableHead>Öncelik×</TableHead>
                        <TableHead>Güncelleme</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {c.pricingRules.map((pr) => (
                        <TableRow key={pr.id}>
                          <TableCell className="font-medium tabular-nums">
                            {formatTry(pr.basePrice)}
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {formatTry(pr.perKmPrice)}
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {"minPrice" in pr && pr.minPrice != null
                              ? formatTry(pr.minPrice)
                              : "—"}
                          </TableCell>
                          <TableCell className="tabular-nums text-sm">
                            {"nightMultiplier" in pr && pr.nightMultiplier != null
                              ? Number(pr.nightMultiplier).toLocaleString("tr-TR", {
                                  maximumFractionDigits: 4,
                                })
                              : "—"}
                          </TableCell>
                          <TableCell className="tabular-nums text-sm">
                            {"priorityMultiplier" in pr &&
                            pr.priorityMultiplier != null
                              ? Number(pr.priorityMultiplier).toLocaleString("tr-TR", {
                                  maximumFractionDigits: 4,
                                })
                              : "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {formatDateTimeTr(pr.updatedAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Özel kural yok — genel tarife uygulanır.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70 rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Siparişler</CardTitle>
              <CardDescription>
                Bu müşteriye ait siparişler (en yeni üstte)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {orders === null ? (
                <Skeleton className="h-32 w-full rounded-lg" />
              ) : orders.length === 0 ? (
                <p className="text-muted-foreground text-sm">Sipariş yok.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sipariş</TableHead>
                        <TableHead>Durum</TableHead>
                        <TableHead className="text-right">Tutar</TableHead>
                        <TableHead>Tarih</TableHead>
                        <TableHead className="w-[90px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((o) => (
                        <TableRow
                          key={o.id}
                          className="hover:bg-muted/40 transition-colors"
                        >
                          <TableCell className="font-mono text-xs">
                            {o.id.slice(0, 12)}…
                          </TableCell>
                          <TableCell>
                            <span
                              className={cn(
                                "rounded-md border px-2 py-0.5 text-[10px] font-semibold",
                                orderOpsBadgeClass(o.status),
                              )}
                            >
                              {orderStatusLabel(o.status)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {formatTry(o.price)}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                            {formatDateTimeTr(o.createdAt)}
                          </TableCell>
                          <TableCell>
                            <Link
                              href={`/orders/${o.id}`}
                              className={buttonVariants({
                                variant: "ghost",
                                size: "sm",
                              })}
                            >
                              Aç
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

          {showFinance ? (
            <Card className="border-border/70 rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Finans hareketleri</CardTitle>
                <CardDescription>
                  Cari hesaba işlenen borç ve alacak kayıtları
                </CardDescription>
              </CardHeader>
              <CardContent>
                {transactions === null ? (
                  <Skeleton className="h-32 w-full rounded-lg" />
                ) : transactions.length === 0 ? (
                  <p className="text-muted-foreground text-sm">İşlem yok.</p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tarih</TableHead>
                          <TableHead>Tür</TableHead>
                          <TableHead>Açıklama</TableHead>
                          <TableHead className="text-right">Tutar</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions.map((t) => (
                          <TableRow key={t.id}>
                            <TableCell className="text-muted-foreground whitespace-nowrap text-xs">
                              {formatDateTimeTr(t.createdAt)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  t.type === "DEBIT" ? "destructive" : "secondary"
                                }
                                className="text-[10px]"
                              >
                                {t.type === "DEBIT" ? "Borç" : "Alacak"}
                              </Badge>
                            </TableCell>
                            <TableCell className="min-w-[12rem] max-w-[320px] truncate text-sm">
                              {t.description ?? "—"}
                            </TableCell>
                            <TableCell
                              className={cn(
                                "text-right font-semibold tabular-nums",
                                t.type === "DEBIT"
                                  ? "text-amber-700 dark:text-amber-400"
                                  : "text-emerald-700 dark:text-emerald-400",
                              )}
                            >
                              {t.type === "DEBIT" ? "+" : "−"}
                              {formatTry(t.amount)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}
