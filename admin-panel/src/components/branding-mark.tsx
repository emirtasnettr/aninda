"use client";

import { cn } from "@/lib/utils";
import { usePublicBranding } from "@/hooks/use-public-branding";

type Variant = "login" | "sidebar";

export function BrandingMark({
  variant,
  className,
}: {
  variant: Variant;
  className?: string;
}) {
  const { appName, logoSrc, loaded } = usePublicBranding();

  if (logoSrc) {
    return (
      <div
        className={cn(variant === "login" && "mx-auto flex justify-center", className)}
        aria-label={appName}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- API host .env ile değişir */}
        <img
          src={logoSrc}
          alt=""
          className={cn(
            "w-auto object-contain object-left",
            variant === "login"
              ? "max-h-20 max-w-[min(100%,280px)]"
              : "max-h-10 max-w-[200px]",
          )}
        />
      </div>
    );
  }

  if (!loaded) {
    return (
      <div
        className={cn(
          "animate-pulse rounded-md bg-muted",
          variant === "login" ? "mx-auto h-16 w-48" : "h-10 w-40",
          className,
        )}
        aria-hidden
      />
    );
  }

  return (
    <p
      className={cn(
        "font-heading font-semibold tracking-tight text-foreground",
        variant === "login"
          ? "mx-auto text-center text-2xl md:text-[1.75rem]"
          : "text-[1.0625rem] leading-snug",
        className,
      )}
    >
      {appName}
    </p>
  );
}
