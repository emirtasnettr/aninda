"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/context/auth-context";

export default function HomePage() {
  const router = useRouter();
  const { token } = useAuth();

  useEffect(() => {
    router.replace(token ? "/dashboard" : "/login");
  }, [token, router]);

  return (
    <div className="text-muted-foreground flex min-h-screen items-center justify-center text-sm">
      Yönlendiriliyor…
    </div>
  );
}
