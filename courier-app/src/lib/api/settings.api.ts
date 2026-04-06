import { getApiBaseUrl } from './config';

export type PublicSettings = {
  logoUrl: string | null;
  appName: string;
};

export async function fetchPublicSettings(): Promise<PublicSettings> {
  const res = await fetch(`${getApiBaseUrl()}/settings`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || `HTTP ${res.status}`);
  }
  return (text ? JSON.parse(text) : {}) as PublicSettings;
}

export function resolveBrandingLogoUri(logoUrl: string | null | undefined): string | null {
  if (!logoUrl?.trim()) return null;
  const u = logoUrl.trim();
  if (u.startsWith('http://') || u.startsWith('https://')) return u;
  if (u.startsWith('/')) return `${getApiBaseUrl()}${u}`;
  return `${getApiBaseUrl()}/${u}`;
}
