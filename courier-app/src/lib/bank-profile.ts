export function normalizeIban(raw: string): string {
  return raw.replace(/\s/g, '').toUpperCase();
}

export function isValidTrIban(raw: string): boolean {
  const v = normalizeIban(raw);
  return /^TR\d{24}$/.test(v);
}

export function hasCompleteBankProfile(c: {
  bankName?: string | null;
  accountHolderName?: string | null;
  iban?: string | null;
}): boolean {
  const bank = c.bankName?.trim();
  const holder = c.accountHolderName?.trim();
  const iban = c.iban ? normalizeIban(c.iban) : '';
  return Boolean(bank && holder && isValidTrIban(iban));
}
