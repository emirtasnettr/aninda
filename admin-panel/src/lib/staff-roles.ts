/**
 * Admin panelden POST /users ile oluşturulabilir roller.
 * COURIER hariç: kurye profili kayıt akışıyla oluşur.
 */
export const CREATABLE_USER_ROLES = [
  "ADMIN",
  "OPERATIONS_MANAGER",
  "OPERATIONS_SPECIALIST",
  "ACCOUNTING_SPECIALIST",
  "INDIVIDUAL_CUSTOMER",
  "CORPORATE_CUSTOMER",
] as const;

export type CreatableUserRole = (typeof CREATABLE_USER_ROLES)[number];
