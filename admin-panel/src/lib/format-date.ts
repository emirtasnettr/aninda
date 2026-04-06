/** Sunucu ve tarayıcıda aynı çıktıyı üretir (TR yerel biçimi, sabit saat dilimi). */
const dateTimeTr = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

export function formatDateTimeTr(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return dateTimeTr.format(d);
}
