import { getToken } from "@/lib/auth-storage";

const DEFAULT_BASE = "http://localhost:3000";

export function getApiBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? DEFAULT_BASE
  );
}

function messageFromBody(body: unknown, status: number): string {
  if (typeof body !== "object" || body === null || !("message" in body)) {
    return `HTTP ${status}`;
  }
  const m = (body as { message: unknown }).message;
  if (typeof m === "string") return m;
  if (Array.isArray(m) && m.every((x) => typeof x === "string")) {
    return m.join(", ");
  }
  return `HTTP ${status}`;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(messageFromBody(body, status));
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const token = getToken();
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new ApiError(res.status, data);
  }

  return data as T;
}
