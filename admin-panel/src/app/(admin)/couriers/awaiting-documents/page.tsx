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
import { PageHeader } from "@/components/page-header";
import { fetchAwaitingDocumentsCouriers } from "@/lib/api/courier-registrations.api";
import { getApiBaseUrl } from "@/lib/api/client";
import type {
  CourierDocumentSlot,
  PendingCourierRegistration,
} from "@/lib/api/types";
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

const DOC_LABELS: Record<string, string> = {
  ID_FRONT: "Kimlik (ön)",
  LICENSE_FRONT: "Ehliyet (ön)",
  LICENSE_BACK: "Ehliyet (arka)",
  RESIDENCE: "İkametgah",
  CRIMINAL_RECORD: "Sabıka kaydı",
};

function docStatusLabel(s: CourierDocumentSlot): string {
  switch (s.reviewStatus) {
    case "APPROVED":
      return "Onaylı";
    case "REJECTED":
      return "Reddedildi";
    case "PENDING_REVIEW":
      return "İnceleme bekliyor";
    case "MISSING":
    default:
      return "Yüklenmedi";
  }
}

function fileHref(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  const base = getApiBaseUrl();
  return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
}

export default function AwaitingDocumentsPage() {
  const { user } = useAuth();
  const allowed = user && canViewCouriers(user.role);
  const [list, setList] = useState<PendingCourierRegistration[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!allowed) return;
    setErr(null);
    try {
      const data = await fetchAwaitingDocumentsCouriers();
      setList(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Liste yüklenemedi");
    }
  }, [allowed]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!allowed) {
    return (
      <div className="p-6">
        <PageHeader title="Evrak yükleyenler" />
        <p className="text-muted-foreground text-sm">Bu sayfaya erişiminiz yok.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Evrak yükleyenler"
        description="Ön onayı verilmiş kuryeler uygulamadan evrak yükler. Bu ekranda yüklenen belgelerin durumunu izleyin; inceleme ve onay için “Evrak incelemesi” kuyruğunu kullanın."
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
        <p className="text-muted-foreground text-sm">Bu aşamada kurye yok.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {list.map((c) => (
            <Card key={c.id}>
              <CardHeader>
                <CardTitle>{c.fullName ?? "—"}</CardTitle>
                <CardDescription>
                  {c.user.email} · Durum:{" "}
                  <span className="font-mono text-foreground">{c.workflowStatus}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <dl className="grid min-w-0 grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
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
                </dl>
                <div>
                  <p className="text-muted-foreground mb-2 text-sm font-semibold">
                    Evrak durumu
                  </p>
                  <ul className="space-y-2 text-sm">
                    {(c.documents ?? []).map((d) => {
                      const href = fileHref(d.fileUrl);
                      return (
                        <li
                          key={d.type}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                        >
                          <span className="font-medium">
                            {DOC_LABELS[d.type] ?? d.type}
                          </span>
                          <span className="text-muted-foreground">
                            {docStatusLabel(d)}
                          </span>
                          {href ? (
                            <a
                              className="text-primary text-xs font-semibold underline"
                              href={href}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Görüntüle
                            </a>
                          ) : null}
                          {d.rejectionReason?.trim() ? (
                            <p className="text-destructive w-full text-xs">
                              {d.rejectionReason}
                            </p>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
