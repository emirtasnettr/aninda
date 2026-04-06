"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { fetchCustomers } from "@/lib/api/customers.api";
import {
  createPricingRule,
  deletePricingRule,
  fetchPricingRules,
  updatePricingRule,
} from "@/lib/api/pricing.api";
import type { Customer, PricingRule } from "@/lib/api/erp-types";
import {
  canDeletePricingRules,
  canManagePricingRules,
  canViewCustomers,
} from "@/lib/auth-storage";
import { formatDateTimeTr } from "@/lib/format-date";
import { formatTry } from "@/lib/format-currency";
import { useAuth } from "@/context/auth-context";

function fmtMul(s: string): string {
  const n = Number(s);
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString("tr-TR", { maximumFractionDigits: 4 });
}

function fmtShare(rule: PricingRule): string {
  if (rule.courierSharePercent == null || rule.courierSharePercent === "") {
    return "Varsayılan";
  }
  const n = Number(rule.courierSharePercent);
  if (Number.isNaN(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

function PricingInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillCustomerId = searchParams.get("customerId") ?? "";

  const { user } = useAuth();
  const allowed = user && canViewCustomers(user.role);
  const canMutate = user && canManagePricingRules(user.role);
  const canDelete = user && canDeletePricingRules(user.role);

  const [rules, setRules] = useState<PricingRule[] | null>(null);
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [newCustomerId, setNewCustomerId] = useState(prefillCustomerId);
  const [newBase, setNewBase] = useState("35");
  const [newPerKm, setNewPerKm] = useState("12");
  const [newMin, setNewMin] = useState("0");
  const [newNight, setNewNight] = useState("1");
  const [newPriority, setNewPriority] = useState("1");
  const [newCourierShare, setNewCourierShare] = useState("");

  const [editId, setEditId] = useState<string | null>(null);
  const [editBase, setEditBase] = useState("");
  const [editPerKm, setEditPerKm] = useState("");
  const [editMin, setEditMin] = useState("");
  const [editNight, setEditNight] = useState("");
  const [editPriority, setEditPriority] = useState("");
  const [editCourierShare, setEditCourierShare] = useState("");

  const load = useCallback(async () => {
    if (!allowed) return;
    setErr(null);
    try {
      const [r, c] = await Promise.all([
        fetchPricingRules(),
        fetchCustomers(),
      ]);
      setRules(r);
      setCustomers(c);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Yüklenemedi");
    }
  }, [allowed]);

  useEffect(() => {
    if (user && !allowed) router.replace("/dashboard");
  }, [user, allowed, router]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (prefillCustomerId) setNewCustomerId(prefillCustomerId);
  }, [prefillCustomerId]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!canMutate) return;
    const base = Number(newBase.replace(",", "."));
    const perKm = Number(newPerKm.replace(",", "."));
    const minP = Number(newMin.replace(",", "."));
    const night = Number(newNight.replace(",", "."));
    const pri = Number(newPriority.replace(",", "."));
    if (
      [base, perKm, minP, night, pri].some((n) => Number.isNaN(n)) ||
      night <= 0 ||
      pri <= 0
    ) {
      setErr("Sayısal değerler geçerli olmalı (çarpanlar > 0).");
      return;
    }
    setCreating(true);
    setErr(null);
    try {
      const body: Parameters<typeof createPricingRule>[0] = {
        customerId: newCustomerId || undefined,
        basePrice: base,
        perKmPrice: perKm,
        minPrice: minP,
        nightMultiplier: night,
        priorityMultiplier: pri,
      };
      const cs = newCourierShare.trim().replace(",", ".");
      if (cs !== "") {
        const p = Number(cs);
        if (Number.isNaN(p) || p < 0 || p > 1) {
          setErr("Kurye payı 0 ile 1 arasında olmalı (örn. 0,72).");
          setCreating(false);
          return;
        }
        body.courierSharePercent = p;
      }
      await createPricingRule(body);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Oluşturulamadı");
    } finally {
      setCreating(false);
    }
  }

  async function saveEdit(id: string) {
    if (!canMutate) return;
    const base = Number(editBase.replace(",", "."));
    const perKm = Number(editPerKm.replace(",", "."));
    const minP = Number(editMin.replace(",", "."));
    const night = Number(editNight.replace(",", "."));
    const pri = Number(editPriority.replace(",", "."));
    if (
      [base, perKm, minP, night, pri].some((n) => Number.isNaN(n)) ||
      night <= 0 ||
      pri <= 0
    ) {
      return;
    }
    setErr(null);
    try {
      let courierSharePercent: number | null | undefined = undefined;
      const cs = editCourierShare.trim().replace(",", ".");
      if (cs === "") {
        courierSharePercent = null;
      } else {
        const p = Number(cs);
        if (Number.isNaN(p) || p < 0 || p > 1) {
          setErr("Kurye payı 0–1 arası veya boş (varsayılan) olmalı.");
          return;
        }
        courierSharePercent = p;
      }
      await updatePricingRule(id, {
        basePrice: base,
        perKmPrice: perKm,
        minPrice: minP,
        nightMultiplier: night,
        priorityMultiplier: pri,
        courierSharePercent,
      });
      setEditId(null);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Güncellenemedi");
    }
  }

  async function onDelete(id: string) {
    if (!canDelete) return;
    if (!window.confirm("Bu kural silinsin mi?")) return;
    setErr(null);
    try {
      await deletePricingRule(id);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Silinemedi");
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
        title="Fiyat kuralları"
        description="Genel veya müşteriye özel tarife: taban + km, minimum, gece ve öncelik çarpanları, isteğe bağlı kurye payı. Siparişte anlık değerler sipariş kaydına yazılır."
      />

      {err ? <p className="text-destructive text-sm">{err}</p> : null}

      {canMutate ? (
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle>Yeni kural</CardTitle>
            <CardDescription>
              Müşteri seçilmezse genel tarife. Gece: Europe/Istanbul 22:00–06:00
              (PRICING_NIGHT_START_HOUR / END ile değiştirilebilir).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onCreate} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2 sm:col-span-2 lg:col-span-3">
                <Label htmlFor="cust">Müşteri (opsiyonel)</Label>
                <select
                  id="cust"
                  className="border-input bg-background h-9 w-full max-w-md rounded-md border px-3 text-sm"
                  value={newCustomerId}
                  onChange={(e) => setNewCustomerId(e.target.value)}
                >
                  <option value="">— Genel —</option>
                  {(customers ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.email})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="base">Taban (TRY)</Label>
                <Input
                  id="base"
                  value={newBase}
                  onChange={(e) => setNewBase(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="km">Km başı (TRY)</Label>
                <Input
                  id="km"
                  value={newPerKm}
                  onChange={(e) => setNewPerKm(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="minp">Min. tutar (TRY)</Label>
                <Input
                  id="minp"
                  value={newMin}
                  onChange={(e) => setNewMin(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="night">Gece çarpanı</Label>
                <Input
                  id="night"
                  value={newNight}
                  onChange={(e) => setNewNight(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pri">Öncelik çarpanı</Label>
                <Input
                  id="pri"
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cs">Kurye payı (0–1, boş = global)</Label>
                <Input
                  id="cs"
                  placeholder="örn. 0,72"
                  value={newCourierShare}
                  onChange={(e) => setNewCourierShare(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <Button type="submit" disabled={creating}>
                  {creating ? "Ekleniyor…" : "Kural ekle"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle>Mevcut kurallar</CardTitle>
          <CardDescription>
            Öncelik: müşteriye özel kural varsa o kullanılır; yoksa en son güncellenen
            genel kural.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rules === null ? (
            <Skeleton className="h-48 w-full rounded-lg" />
          ) : rules.length === 0 ? (
            <p className="text-muted-foreground text-sm">Kural tanımlı değil.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kapsam</TableHead>
                    <TableHead className="text-right">Taban</TableHead>
                    <TableHead className="text-right">Km</TableHead>
                    <TableHead className="text-right">Min</TableHead>
                    <TableHead className="text-right">Gece×</TableHead>
                    <TableHead className="text-right">Öncelik×</TableHead>
                    <TableHead className="text-right">Kurye</TableHead>
                    <TableHead>Güncelleme</TableHead>
                    <TableHead className="w-[200px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        {r.customerId && r.customer ? (
                          <div>
                            <div className="font-medium">{r.customer.name}</div>
                            <Link
                              href={`/customers/${r.customerId}`}
                              className="text-primary text-xs hover:underline"
                            >
                              Müşteri →
                            </Link>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Genel</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {editId === r.id ? (
                          <Input
                            className="h-8"
                            value={editBase}
                            onChange={(e) => setEditBase(e.target.value)}
                          />
                        ) : (
                          formatTry(r.basePrice)
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {editId === r.id ? (
                          <Input
                            className="h-8"
                            value={editPerKm}
                            onChange={(e) => setEditPerKm(e.target.value)}
                          />
                        ) : (
                          formatTry(r.perKmPrice)
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {editId === r.id ? (
                          <Input
                            className="h-8"
                            value={editMin}
                            onChange={(e) => setEditMin(e.target.value)}
                          />
                        ) : (
                          formatTry(r.minPrice)
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {editId === r.id ? (
                          <Input
                            className="h-8"
                            value={editNight}
                            onChange={(e) => setEditNight(e.target.value)}
                          />
                        ) : (
                          fmtMul(r.nightMultiplier)
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {editId === r.id ? (
                          <Input
                            className="h-8"
                            value={editPriority}
                            onChange={(e) => setEditPriority(e.target.value)}
                          />
                        ) : (
                          fmtMul(r.priorityMultiplier)
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {editId === r.id ? (
                          <Input
                            className="h-8"
                            placeholder="boş=varsayılan"
                            value={editCourierShare}
                            onChange={(e) => setEditCourierShare(e.target.value)}
                          />
                        ) : (
                          fmtShare(r)
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDateTimeTr(r.updatedAt)}
                      </TableCell>
                      <TableCell>
                        {canMutate ? (
                          <div className="flex flex-wrap gap-1">
                            {editId === r.id ? (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => void saveEdit(r.id)}
                                >
                                  Kaydet
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setEditId(null)}
                                >
                                  Vazgeç
                                </Button>
                              </>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  setEditId(r.id);
                                  setEditBase(String(r.basePrice));
                                  setEditPerKm(String(r.perKmPrice));
                                  setEditMin(String(r.minPrice));
                                  setEditNight(String(r.nightMultiplier));
                                  setEditPriority(String(r.priorityMultiplier));
                                  setEditCourierShare(
                                    r.courierSharePercent != null
                                      ? String(r.courierSharePercent)
                                      : "",
                                  );
                                }}
                              >
                                Düzenle
                              </Button>
                            )}
                            {canDelete ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="text-destructive"
                                onClick={() => void onDelete(r.id)}
                              >
                                Sil
                              </Button>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            Salt okunur
                          </span>
                        )}
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

export default function PricingRulesPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      }
    >
      <PricingInner />
    </Suspense>
  );
}
