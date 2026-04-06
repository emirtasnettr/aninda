/** Prisma Role → Türkçe etiket (panel gösterimi) */
export const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Yönetici",
  OPERATIONS_MANAGER: "Operasyon müdürü",
  OPERATIONS_SPECIALIST: "Operasyon uzmanı",
  ACCOUNTING_SPECIALIST: "Muhasebe uzmanı",
  INDIVIDUAL_CUSTOMER: "Bireysel müşteri",
  CORPORATE_CUSTOMER: "Kurumsal müşteri",
  COURIER: "Kurye",
};

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}
