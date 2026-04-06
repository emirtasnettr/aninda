"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
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
import { Separator } from "@/components/ui/separator";
import {
  DEMO_LOGIN_ACCOUNTS,
  DEMO_SEED_PASSWORD,
} from "@/lib/demo-login-accounts";
import { BrandingMark } from "@/components/branding-mark";

export default function LoginPage() {
  const router = useRouter();
  const { token, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [quickPending, setQuickPending] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      router.replace("/dashboard");
    }
  }, [token, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await login(email, password);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Giriş başarısız");
    } finally {
      setPending(false);
    }
  }

  async function quickLogin(email: string) {
    setError(null);
    setQuickPending(email);
    try {
      await login(email, DEMO_SEED_PASSWORD);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Giriş başarısız");
    } finally {
      setQuickPending(null);
    }
  }

  if (token) {
    return null;
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[oklch(0.97_0.003_264)] p-4">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,oklch(0.88_0.01_264),transparent)]"
        aria-hidden
      />
      <Card className="relative z-10 w-full max-w-md border-border/80 shadow-xl shadow-black/5">
        <CardHeader className="space-y-1 pb-2">
          <div className="mb-4">
            <BrandingMark variant="login" />
          </div>
          <CardTitle className="font-heading text-xl">Yönetim paneli</CardTitle>
          <CardDescription>
            Müşteriler web üzerinden sipariş verebilir; personel operasyon ve
            yönetim ekranlarına erişir.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-posta</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Şifre</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error ? (
              <p className="text-destructive text-sm">{error}</p>
            ) : null}
            <Button
              type="submit"
              className="w-full"
              disabled={pending || quickPending !== null}
            >
              {pending ? "Giriş…" : "Giriş yap"}
            </Button>
          </form>

          <Separator className="my-6" />
          <div className="space-y-3">
            <p className="text-muted-foreground text-center text-xs">
              Geliştirme: tohum veritabanı ile hızlı giriş (şifre:{" "}
              {DEMO_SEED_PASSWORD})
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {DEMO_LOGIN_ACCOUNTS.map((acc) => (
                <Button
                  key={acc.roleKey}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-auto min-h-9 w-full whitespace-normal py-2 text-left text-xs"
                  disabled={pending || quickPending !== null}
                  onClick={() => quickLogin(acc.email)}
                >
                  {quickPending === acc.email ? "Giriş…" : acc.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
