"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Alt ağacı yalnızca tarayıcıda mount sonrası render eder.
 * SSR ile ilk client render aynı kalır → hydration uyarılarını önler
 * (auth/localStorage, tarayıcı eklentileri, dinamik içerik).
 */
export function ClientOnly({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) {
    return (
      fallback ?? (
        <div className="text-muted-foreground flex min-h-screen items-center justify-center text-sm">
          Yükleniyor…
        </div>
      )
    );
  }
  return children;
}
