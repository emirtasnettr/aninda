import axios from 'axios';

function formatBodyMessage(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const m = (data as { message?: unknown }).message;
  if (typeof m === 'string' && m.trim()) return m;
  if (Array.isArray(m) && m.length) return m.map(String).join(', ');
  return null;
}

/** Axios / ağ hataları için kullanıcıya gösterilecek metin */
export function formatApiError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const fromBody = err.response?.data
      ? formatBodyMessage(err.response.data)
      : null;
    if (fromBody) return fromBody;
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      return `API'ye ulaşılamıyor (${err.config?.baseURL ?? '—'}). Sunucu çalışıyor mu ve EXPO_PUBLIC_API_URL doğru mu?`;
    }
    if (
      err.code === 'ECONNABORTED' ||
      err.code === 'ETIMEDOUT' ||
      (typeof err.message === 'string' && err.message.toLowerCase().includes('timeout'))
    ) {
      const base = err.config?.baseURL ?? '—';
      return `İstek zaman aşımına uğradı (${base}). Nest API çalışıyor mu? Simülatörde genelde http://localhost:3000; fiziksel telefonda bilgisayarın güncel Wi‑Fi IP’si gerekir (eski .env IP’si yanlış olabilir).`;
    }
    if (err.message) return err.message;
  }
  if (err instanceof Error && err.message) return err.message;
  return 'Bir hata oluştu';
}
