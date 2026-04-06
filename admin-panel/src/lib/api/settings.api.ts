import { ApiError, apiFetch, getApiBaseUrl } from "@/lib/api/client";
import { getToken } from "@/lib/auth-storage";

export type PublicSettings = {
  logoUrl: string | null;
  appName: string;
};

export async function fetchPublicSettings(): Promise<PublicSettings> {
  const res = await fetch(`${getApiBaseUrl()}/settings`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    throw new ApiError(res.status, data);
  }
  return data as PublicSettings;
}

export function resolveSettingsAssetUrl(logoUrl: string | null): string | null {
  if (!logoUrl?.trim()) return null;
  const u = logoUrl.trim();
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("/")) return `${getApiBaseUrl()}${u}`;
  return `${getApiBaseUrl()}/${u}`;
}

export async function patchSettings(body: {
  appName?: string;
  logoUrl?: string | null;
}): Promise<PublicSettings> {
  return apiFetch<PublicSettings>("/settings", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function uploadSettingsLogo(file: File): Promise<PublicSettings> {
  const token = getToken();
  const fd = new FormData();
  fd.append("file", file);
  const headers = new Headers();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(`${getApiBaseUrl()}/settings/logo`, {
    method: "POST",
    headers,
    body: fd,
  });
  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    throw new ApiError(res.status, data);
  }
  return data as PublicSettings;
}
