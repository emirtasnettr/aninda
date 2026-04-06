"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
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
import {
  approveCourierRegistration,
  fetchPendingCourierRegistrations,
  rejectCourierRegistration,
} from "@/lib/api/courier-registrations.api";
import type { PendingCourierRegistration } from "@/lib/api/types";
import { canViewCouriers } from "@/lib/auth-storage";
import { useAuth } from "@/context/auth-context";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("tr-TR");
  } catch {
    return iso;
  }
}

export default function CourierRegistrationsPage() {
  const { user } = useAuth();
  const allowed = user && canViewCouriers(user.role);
  const [list, setList] = useState<PendingCourierRegistration[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectCourierId, setRejectCourierId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const load = useCallback(async () => {
    if (!allowed) return;
    setErr(null);
    try {
      const data = await fetchPendingCourierRegistrations();
      setList(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Liste yüklenemedi");
    }
  }, [allowed]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onApprove(id: string) {
    setBusyId(id);
    setErr(null);
    try {
      await approveCourierRegistration(id);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Onaylanamadı");
    } finally {
      setBusyId(null);
    }
  }

  async function onRejectSubmit() {
    if (!rejectCourierId) return;
    setBusyId(rejectCourierId);
    setErr(null);
    try {
      await rejectCourierRegistration(rejectCourierId, {
        reason: rejectReason.trim() || undefined,
      });
      setRejectOpen(false);
      setRejectCourierId(null);
      setRejectReason("");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Reddedilemedi");
    } finally {
      setBusyId(null);
    }
  }

  if (!allowed) {
    return (
      <div className="p-6">
        <PageHeader title="Kurye başvuruları" />
        <p className="text-muted-foreground text-sm">Bu sayfaya erişiminiz yok.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Kurye başvuruları"
        description="1. aşama: Kayıt onayı. Onaylanan kurye uygulamadan evrak yükler; operasyon evrakları ‘Evrak incelemesi’nden tek tek onaylar. Tüm evraklar onaylanınca kurye iş alabilir."
      />

      {err ? (
        <p className="text-destructive mb-4 text-sm font-medium">{err}</p>
      ) : null}

      <div className="mb-4">
        <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
          Yenile
        </Button>
      </div>

      {list === null ? (
        <p className="text-muted-foreground text-sm">Yükleniyor…</p>
      ) : list.length === 0 ? (
        <p className="text-muted-foreground text-sm">Bekleyen başvuru yok.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {list.map((c) => {
            return (
              <Card key={c.id}>
                <CardHeader>
                  <CardTitle>{c.fullName ?? "—"}</CardTitle>
                  <CardDescription>{c.user.email}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-6">
                    <dl className="grid min-w-0 flex-1 grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-muted-foreground font-medium">Telefon</dt>
                        <dd>{c.phone ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground font-medium">Doğum</dt>
                        <dd>{formatDate(c.birthDate)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground font-medium">T.C.</dt>
                        <dd className="font-mono">{c.tcNo ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground font-medium">Araç</dt>
                        <dd>
                          {c.type === "MOTORCYCLE" ? "Motosiklet" : "Araba"} ·{" "}
                          {c.plateNumber ?? "—"}
                        </dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-muted-foreground font-medium">Şirket</dt>
                        <dd>
                          {c.hasCompany
                            ? `${c.companyTaxId ?? "—"} · ${c.companyTaxOffice ?? "—"}`
                            : "Yok (şahıs)"}
                        </dd>
                      </div>
                      {c.hasCompany && c.companyAddress ? (
                        <div className="sm:col-span-2">
                          <dt className="text-muted-foreground font-medium">
                            Şirket adresi
                          </dt>
                          <dd>{c.companyAddress}</dd>
                        </div>
                      ) : null}
                      {!c.hasCompany && c.residenceAddress ? (
                        <div className="sm:col-span-2">
                          <dt className="text-muted-foreground font-medium">
                            İkametgah
                          </dt>
                          <dd>{c.residenceAddress}</dd>
                        </div>
                      ) : null}
                    </dl>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      disabled={busyId === c.id}
                      onClick={() => void onApprove(c.id)}
                    >
                      {busyId === c.id ? "…" : "Onayla"}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={busyId === c.id}
                      onClick={() => {
                        setRejectCourierId(c.id);
                        setRejectReason("");
                        setRejectOpen(true);
                      }}
                    >
                      Reddet
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Red gerekçesi (isteğe bağlı)</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="rej">Not</Label>
            <Input
              id="rej"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Kurye uygulamasında gösterilir"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRejectOpen(false)}>
              Vazgeç
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busyId !== null}
              onClick={() => void onRejectSubmit()}
            >
              Reddet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
