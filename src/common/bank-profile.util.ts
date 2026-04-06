export function normalizeIban(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const v = String(raw).replace(/\s/g, '').toUpperCase();
  if (v.length === 0) return null;
  return /^TR\d{24}$/.test(v) ? v : null;
}

export function hasCompleteBankProfile(c: {
  bankName?: string | null;
  accountHolderName?: string | null;
  iban?: string | null;
}): boolean {
  const bank = c.bankName?.trim();
  const holder = c.accountHolderName?.trim();
  const iban = normalizeIban(c.iban ?? undefined);
  return Boolean(bank && holder && iban);
}
