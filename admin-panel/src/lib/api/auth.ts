import { getApiBaseUrl } from "./client";
import type { LoginResponse } from "./types";

function formatErrorBody(data: unknown): string {
  if (!data || typeof data !== "object") return "Giriş başarısız";
  const d = data as Record<string, unknown>;
  const msg = d.message;
  if (typeof msg === "string") return msg;
  if (Array.isArray(msg)) return msg.join(", ");
  if (typeof d.error === "string") return d.error;
  return "Giriş başarısız";
}

export async function loginRequest(
  email: string,
  password: string,
): Promise<LoginResponse> {
  const url = `${getApiBaseUrl()}/auth/login`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new Error(
      `API'ye ulaşılamıyor (${url}). Backend çalışıyor mu ve admin-panel .env.local içinde NEXT_PUBLIC_API_URL doğru mu?`,
    );
  }

  const text = await res.text();
  let data: LoginResponse & Record<string, unknown>;
  try {
    data = (text ? JSON.parse(text) : {}) as LoginResponse &
      Record<string, unknown>;
  } catch {
    if (!res.ok) {
      throw new Error(
        `API beklenen JSON yerine başka bir yanıt döndü (${res.status}). NEXT_PUBLIC_API_URL gerçekten Nest sunucusuna mı işaret ediyor? (Panel 3001, API genelde 3000.)`,
      );
    }
    throw new Error("Sunucu yanıtı geçersiz.");
  }

  if (!res.ok) {
    throw new Error(formatErrorBody(data));
  }

  if (!data.accessToken || !data.user) {
    throw new Error("Sunucu yanıtı geçersiz (token yok).");
  }

  return data as LoginResponse;
}
