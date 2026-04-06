"use client";

import { useEffect, useState } from "react";
import {
  fetchPublicSettings,
  resolveSettingsAssetUrl,
  type PublicSettings,
} from "@/lib/api/settings.api";

const CACHE_MS = 5 * 60 * 1000;
const INVALIDATE_EVENT = "teslimatjet-branding-invalidate";

let memoryCache: { at: number; data: PublicSettings } | null = null;

const DEFAULT_NAME = "Teslimatjet";

async function loadFromApi(): Promise<PublicSettings> {
  try {
    const d = await fetchPublicSettings();
    memoryCache = { at: Date.now(), data: d };
    return d;
  } catch {
    const fallback: PublicSettings = {
      logoUrl: null,
      appName: DEFAULT_NAME,
    };
    memoryCache = { at: Date.now(), data: fallback };
    return fallback;
  }
}

/** Marka ayarları güncellenince çağırın; açık ekranlarda logo hemen yenilenir */
export function invalidatePublicBrandingCache(): void {
  memoryCache = null;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(INVALIDATE_EVENT));
  }
}

export type PublicBranding = {
  appName: string;
  logoSrc: string | null;
  loaded: boolean;
};

export function usePublicBranding(): PublicBranding {
  const [data, setData] = useState<PublicSettings | null>(() =>
    memoryCache && Date.now() - memoryCache.at < CACHE_MS
      ? memoryCache.data
      : null,
  );
  const [loaded, setLoaded] = useState(
    () => !!(memoryCache && Date.now() - memoryCache.at < CACHE_MS),
  );

  useEffect(() => {
    let cancelled = false;

    function apply(d: PublicSettings) {
      if (!cancelled) {
        setData(d);
        setLoaded(true);
      }
    }

    async function run(useCache: boolean) {
      if (
        useCache &&
        memoryCache &&
        Date.now() - memoryCache.at < CACHE_MS
      ) {
        apply(memoryCache.data);
        return;
      }
      const d = await loadFromApi();
      apply(d);
    }

    void run(true);

    const onInvalidate = () => {
      void run(false);
    };
    window.addEventListener(INVALIDATE_EVENT, onInvalidate);
    return () => {
      cancelled = true;
      window.removeEventListener(INVALIDATE_EVENT, onInvalidate);
    };
  }, []);

  const appName = data?.appName?.trim() || DEFAULT_NAME;
  const logoSrc = resolveSettingsAssetUrl(data?.logoUrl ?? null);

  return { appName, logoSrc, loaded };
}
