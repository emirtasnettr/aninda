/** `prisma/seed.ts` ile aynı e-postalar ve şifre (geliştirme). */
export const DEMO_SEED_PASSWORD = "Admin123!";

export type DemoLoginAccount = {
  roleKey: string;
  label: string;
  email: string;
};

export const DEMO_LOGIN_ACCOUNTS: DemoLoginAccount[] = [
  { roleKey: "ADMIN", label: "Yönetici", email: "admin@teslimatjet.local" },
  {
    roleKey: "OPERATIONS_MANAGER",
    label: "Operasyon müdürü",
    email: "ops.manager@teslimatjet.local",
  },
  {
    roleKey: "OPERATIONS_SPECIALIST",
    label: "Operasyon uzmanı",
    email: "ops.specialist@teslimatjet.local",
  },
  {
    roleKey: "ACCOUNTING_SPECIALIST",
    label: "Muhasebe uzmanı",
    email: "accounting@teslimatjet.local",
  },
  {
    roleKey: "CORPORATE_CUSTOMER",
    label: "Kurumsal müşteri",
    email: "corporate@teslimatjet.local",
  },
  {
    roleKey: "INDIVIDUAL_CUSTOMER",
    label: "Bireysel müşteri",
    email: "customer@teslimatjet.local",
  },
  { roleKey: "COURIER", label: "Kurye", email: "courier@teslimatjet.local" },
];
