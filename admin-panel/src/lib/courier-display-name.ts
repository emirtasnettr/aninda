/** Kurye listelerinde: veritabanındaki Türkçe ad, yoksa e-posta yerel kısmı */
export function courierDisplayName(c: {
  fullName?: string | null;
  user: { email: string };
}): string {
  const n = c.fullName?.trim();
  if (n) return n;
  const p = c.user.email.split("@")[0];
  return p && p.length > 0 ? p : c.user.email;
}
