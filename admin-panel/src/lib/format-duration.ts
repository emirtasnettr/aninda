/** Milisaniyeyi Türkçe okunaklı süreye çevirir (dashboard metrikleri). */
export function formatDurationTr(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const totalMin = Math.round(ms / 60000);
  if (totalMin < 1) return "<1 dk";
  if (totalMin < 60) return `${totalMin} dk`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h} sa ${m} dk` : `${h} sa`;
}
