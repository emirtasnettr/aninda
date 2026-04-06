"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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
import { createOrder } from "@/lib/api/orders";
import { fetchMyPricingQuote, type PricingQuote } from "@/lib/api/pricing.api";
import { isCustomerRole } from "@/lib/auth-storage";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";

const PRESETS = [
  { key: "taksim", label: "Taksim", lat: 41.0369, lng: 28.985 },
  { key: "kadikoy", label: "Kadıköy", lat: 41.0092, lng: 29.019 },
  { key: "besiktas", label: "Beşiktaş", lat: 41.0422, lng: 29.008 },
  { key: "sisli", label: "Şişli", lat: 41.0608, lng: 28.987 },
] as const;

export default function NewOrderPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [pickupLat, setPickupLat] = useState("41.0369");
  const [pickupLng, setPickupLng] = useState("28.985");
  const [deliveryLat, setDeliveryLat] = useState("41.0092");
  const [deliveryLng, setDeliveryLng] = useState("29.019");
  const [priority, setPriority] = useState(false);
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [quote, setQuote] = useState<PricingQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteErr, setQuoteErr] = useState<string | null>(null);

  const parsed = useMemo(() => {
    const pl = Number(pickupLat);
    const pg = Number(pickupLng);
    const dl = Number(deliveryLat);
    const dg = Number(deliveryLng);
    const ok =
      Number.isFinite(pl) &&
      Number.isFinite(pg) &&
      Number.isFinite(dl) &&
      Number.isFinite(dg) &&
      pl >= -90 &&
      pl <= 90 &&
      dl >= -90 &&
      dl <= 90 &&
      pg >= -180 &&
      pg <= 180 &&
      dg >= -180 &&
      dg <= 180;
    return ok ? { pl, pg, dl, dg } : null;
  }, [pickupLat, pickupLng, deliveryLat, deliveryLng]);

  useEffect(() => {
    if (!parsed || !user || !isCustomerRole(user.role)) {
      setQuote(null);
      setQuoteErr(null);
      setQuoteLoading(false);
      return;
    }
    let cancelled = false;
    setQuoteLoading(true);
    setQuoteErr(null);
    void (async () => {
      try {
        const q = await fetchMyPricingQuote({
          pickupLat: parsed.pl,
          pickupLng: parsed.pg,
          deliveryLat: parsed.dl,
          deliveryLng: parsed.dg,
          priority,
        });
        if (!cancelled) {
          setQuote(q);
          setQuoteErr(null);
        }
      } catch (e) {
        if (!cancelled) {
          setQuote(null);
          setQuoteErr(e instanceof Error ? e.message : "Fiyat alınamadı");
        }
      } finally {
        if (!cancelled) setQuoteLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [parsed, priority, user]);

  if (!user || !isCustomerRole(user.role)) {
    return (
      <>
        <PageHeader title="Yeni sipariş" />
        <Card>
          <CardHeader>
            <CardTitle>Erişim</CardTitle>
            <CardDescription>
              Sipariş oluşturmak için bireysel veya kurumsal müşteri hesabı ile
              giriş yapın.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/login" className={buttonVariants()}>
              Girişe dön
            </Link>
          </CardContent>
        </Card>
      </>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!parsed || !quote) {
      setErr("Koordinatları kontrol edin veya fiyat yüklenene kadar bekleyin.");
      return;
    }
    setPending(true);
    try {
      const order = await createOrder({
        pickupLat: parsed.pl,
        pickupLng: parsed.pg,
        deliveryLat: parsed.dl,
        deliveryLng: parsed.dg,
        price: quote.total,
        priority,
      });
      router.replace(`/orders/${order.id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Sipariş oluşturulamadı");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Yeni sipariş"
        description="Alış ve teslimat koordinatlarını girin; ücret sunucu tarifenizle hesaplanır (gece / öncelik çarpanları dahil)."
      />

      <form
        onSubmit={onSubmit}
        className="w-full max-w-2xl space-y-6 2xl:max-w-3xl"
      >
        <Card>
          <CardHeader>
            <CardTitle>Alış noktası</CardTitle>
            <CardDescription>Enlem / boylam (ondalık derece)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <Button
                  key={`p-${p.key}`}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPickupLat(String(p.lat));
                    setPickupLng(String(p.lng));
                  }}
                >
                  {p.label}
                </Button>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="plat">Enlem</Label>
                <Input
                  id="plat"
                  inputMode="decimal"
                  value={pickupLat}
                  onChange={(e) => setPickupLat(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plng">Boylam</Label>
                <Input
                  id="plng"
                  inputMode="decimal"
                  value={pickupLng}
                  onChange={(e) => setPickupLng(e.target.value)}
                  required
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Teslimat noktası</CardTitle>
            <CardDescription>Enlem / boylam</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <Button
                  key={`d-${p.key}`}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDeliveryLat(String(p.lat));
                    setDeliveryLng(String(p.lng));
                  }}
                >
                  {p.label}
                </Button>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="dlat">Enlem</Label>
                <Input
                  id="dlat"
                  inputMode="decimal"
                  value={deliveryLat}
                  onChange={(e) => setDeliveryLat(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dlng">Boylam</Label>
                <Input
                  id="dlng"
                  inputMode="decimal"
                  value={deliveryLng}
                  onChange={(e) => setDeliveryLng(e.target.value)}
                  required
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center gap-2 rounded-lg border border-border/60 px-4 py-3">
          <input
            id="prio"
            type="checkbox"
            className="size-4 rounded border"
            checked={priority}
            onChange={(e) => setPriority(e.target.checked)}
          />
          <Label htmlFor="prio" className="cursor-pointer font-normal">
            Öncelikli sipariş (tarifede öncelik çarpanı uygulanır)
          </Label>
        </div>

        <Card
          className={cn(
            "border-primary/20 bg-primary/5",
            !quote && !quoteLoading && "opacity-80",
          )}
        >
          <CardHeader>
            <CardTitle className="text-base">Sunucu fiyatı</CardTitle>
            <CardDescription>
              Müşteri tarifenize göre hesaplanır; siparişte aynı tutar beklenir.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            {quoteLoading ? (
              <p className="text-muted-foreground">Hesaplanıyor…</p>
            ) : quoteErr ? (
              <p className="text-destructive">{quoteErr}</p>
            ) : quote ? (
              <div className="space-y-1">
                <p>
                  <span className="text-muted-foreground">Mesafe: </span>
                  <span className="font-medium">{quote.km} km</span>
                </p>
                {quote.isNight ? (
                  <p className="text-muted-foreground text-xs">
                    Gece penceresi (İstanbul):{" "}
                    {quote.nightApplied ? "çarpan uygulandı" : "çarpan 1"}
                  </p>
                ) : null}
                <p>
                  <span className="text-muted-foreground">Tutar: </span>
                  <span className="text-lg font-semibold">{quote.total} ₺</span>
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground">Geçerli koordinat girin.</p>
            )}
          </CardContent>
        </Card>

        {err ? (
          <p className="text-destructive text-sm">{err}</p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={pending || !quote || quoteLoading}>
            {pending ? "Gönderiliyor…" : "Siparişi oluştur"}
          </Button>
          <Link href="/orders" className={buttonVariants({ variant: "outline" })}>
            Siparişlerime dön
          </Link>
        </div>
      </form>
    </>
  );
}
