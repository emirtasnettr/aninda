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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import {
  fetchPublicSettings,
  patchSettings,
  resolveSettingsAssetUrl,
  uploadSettingsLogo,
} from "@/lib/api/settings.api";
import { invalidatePublicBrandingCache } from "@/hooks/use-public-branding";
import { canManageBranding } from "@/lib/auth-storage";
import { useAuth } from "@/context/auth-context";

export default function BrandingSettingsPage() {
  const { user } = useAuth();
  const allowed = user && canManageBranding(user.role);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [appName, setAppName] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async () => {
    if (!allowed) return;
    setErr(null);
    setLoading(true);
    try {
      const s = await fetchPublicSettings();
      setAppName(s.appName);
      setLogoUrl(s.logoUrl);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ayarlar yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [allowed]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSaveAppName() {
    if (!allowed) return;
    setSavingName(true);
    setErr(null);
    try {
      const s = await patchSettings({ appName: appName.trim() });
      invalidatePublicBrandingCache();
      setAppName(s.appName);
      setLogoUrl(s.logoUrl);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Kaydedilemedi");
    } finally {
      setSavingName(false);
    }
  }

  async function onPickFile(f: File | null) {
    if (!f || !allowed) return;
    setUploading(true);
    setErr(null);
    try {
      const s = await uploadSettingsLogo(f);
      invalidatePublicBrandingCache();
      setAppName(s.appName);
      setLogoUrl(s.logoUrl);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Yükleme başarısız");
    } finally {
      setUploading(false);
    }
  }

  async function onClearLogo() {
    if (!allowed) return;
    setClearing(true);
    setErr(null);
    try {
      const s = await patchSettings({ logoUrl: null });
      invalidatePublicBrandingCache();
      setAppName(s.appName);
      setLogoUrl(s.logoUrl);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Kaldırılamadı");
    } finally {
      setClearing(false);
    }
  }

  const previewSrc = resolveSettingsAssetUrl(logoUrl);

  if (!allowed) {
    return (
      <div className="p-6">
        <PageHeader title="Marka ayarları" />
        <p className="text-muted-foreground text-sm">
          Bu sayfaya yalnızca yönetici ve operasyon müdürü erişebilir.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Marka ayarları"
        description="Kurye uygulaması giriş ekranında gösterilecek logo ve uygulama adı (white-label)."
      />

      {err ? (
        <p className="text-destructive mb-4 text-sm font-medium">{err}</p>
      ) : null}

      {loading ? (
        <p className="text-muted-foreground text-sm">Yükleniyor…</p>
      ) : (
        <div className="grid max-w-xl gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Uygulama adı</CardTitle>
              <CardDescription>
                Logo yoksa veya yüklenemediğinde kurye girişinde bu metin gösterilir.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="appName">appName</Label>
                <Input
                  id="appName"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  placeholder="Teslimatjet"
                  maxLength={120}
                />
              </div>
              <Button
                type="button"
                onClick={() => void onSaveAppName()}
                disabled={savingName || !appName.trim()}
              >
                {savingName ? "Kaydediliyor…" : "Kaydet"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Logo</CardTitle>
              <CardDescription>
                PNG, JPEG, GIF veya WebP; en fazla 2 MB. Sunucuya yüklenir ve URL
                veritabanına yazılır (yerel depolama; üretimde CDN/S3 için PATCH ile
                tam URL de girebilirsiniz).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex min-h-[88px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 p-4">
                {previewSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element -- API host .env ile değişir; remotePatterns gerekmez
                  <img
                    src={previewSrc}
                    alt="Logo önizleme"
                    className="mx-auto max-h-20 w-full max-w-[240px] object-contain"
                  />
                ) : (
                  <p className="text-muted-foreground text-center text-sm">
                    Henüz logo yok — yalnızca uygulama adı gösterilir.
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  id="branding-logo-file"
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  className="sr-only"
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    e.target.value = "";
                    void onPickFile(f);
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  disabled={uploading}
                  onClick={() =>
                    document.getElementById("branding-logo-file")?.click()
                  }
                >
                  {uploading ? "Yükleniyor…" : "Dosya seç"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void onClearLogo()}
                  disabled={clearing || !logoUrl}
                >
                  {clearing ? "Kaldırılıyor…" : "Logoyu kaldır"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
