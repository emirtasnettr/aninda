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
  approveCourierDocument,
  fetchDocumentReviewCouriers,
  rejectCourierDocument,
} from "@/lib/api/courier-registrations.api";
import { getApiBaseUrl } from "@/lib/api/client";
import type {
  CourierDocumentSlot,
  PendingCourierRegistration,
} from "@/lib/api/types";
import { canViewCouriers } from "@/lib/auth-storage";
import { useAuth } from "@/context/auth-context";

const DOC_LABELS: Record<string, string> = {
  ID_FRONT: "Kimlik (ön)",
  LICENSE_FRONT: "Ehliyet (ön)",
  LICENSE_BACK: "Ehliyet (arka)",
  RESIDENCE: "İkametgah",
  CRIMINAL_RECORD: "Sabıka kaydı",
};

function fileHref(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  const base = getApiBaseUrl();
  return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
}

export default function CourierDocumentReviewPage() {
  const { user } = useAuth();
  const allowed = user && canViewCouriers(user.role);
  const [list, setList] = useState<PendingCourierRegistration[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<{
    courierId: string;
    docType: string;
  } | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const load = useCallback(async () => {
    if (!allowed) return;
    setErr(null);
    try {
      const data = await fetchDocumentReviewCouriers();
      setList(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Liste yüklenemedi");
    }
  }, [allowed]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onApprove(courierId: string, docType: string) {
    const key = `${courierId}:${docType}:ok`;
    setBusyKey(key);
    setErr(null);
    try {
      await approveCourierDocument(courierId, docType);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Onaylanamadı");
    } finally {
      setBusyKey(null);
    }
  }

  async function onRejectSubmit() {
    if (!rejectTarget) return;
    const key = `${rejectTarget.courierId}:${rejectTarget.docType}:rej`;
    setBusyKey(key);
    setErr(null);
    try {
      await rejectCourierDocument(rejectTarget.courierId, rejectTarget.docType, {
        reason: rejectReason.trim() || undefined,
      });
      setRejectOpen(false);
      setRejectTarget(null);
      setRejectReason("");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Reddedilemedi");
    } finally {
      setBusyKey(null);
    }
  }

  if (!allowed) {
    return (
      <div className="p-6">
        <PageHeader title="Evrak incelemesi" />
        <p className="text-muted-foreground text-sm">Bu sayfaya erişiminiz yok.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Evrak incelemesi"
        description="Kurye evraklarını tek tek onaylayın veya reddedin. Reddedilen belge için kurye yalnızca o evrakı yeniden yükler; tüm evraklar onaylanınca kurye aktif olur."
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
        <p className="text-muted-foreground text-sm">İnceleme kuyruğunda kurye yok.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {list.map((c) => (
            <Card key={c.id}>
              <CardHeader>
                <CardTitle>{c.fullName ?? "—"}</CardTitle>
                <CardDescription>{c.user.email}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(c.documents ?? []).map((d: CourierDocumentSlot) => {
                  const href = fileHref(d.fileUrl);
                  const pending = d.reviewStatus === "PENDING_REVIEW";
                  const okKey = `${c.id}:${d.type}:ok`;
                  return (
                    <div
                      key={d.type}
                      className="flex flex-col gap-2 rounded-md border border-border p-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">
                          {DOC_LABELS[d.type] ?? d.type}
                        </p>
                        <p className="text-muted-foreground text-xs font-mono">
                          {d.reviewStatus}
                        </p>
                        {href ? (
                          <a
                            className="text-primary text-sm font-semibold underline"
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Dosyayı aç
                          </a>
                        ) : null}
                      </div>
                      {pending ? (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={busyKey !== null}
                            onClick={() => void onApprove(c.id, d.type)}
                          >
                            {busyKey === okKey ? "…" : "Onayla"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            disabled={busyKey !== null}
                            onClick={() => {
                              setRejectTarget({ courierId: c.id, docType: d.type });
                              setRejectReason("");
                              setRejectOpen(true);
                            }}
                          >
                            Reddet
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Evrak red gerekçesi (isteğe bağlı)</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="doc-rej">Kurye uygulamasında gösterilir</Label>
            <Input
              id="doc-rej"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Örn. kimlik fotoğrafı net değil"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRejectOpen(false)}>
              Vazgeç
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busyKey !== null || !rejectTarget}
              onClick={() => void onRejectSubmit()}
            >
              {rejectTarget &&
              busyKey === `${rejectTarget.courierId}:${rejectTarget.docType}:rej`
                ? "…"
                : "Reddet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
