const TOKEN_KEY = "teslimatjet_admin_token";
const USER_KEY = "teslimatjet_admin_user";
const AUTH_CHANGED = "teslimatjet-auth-changed";

/** Aynı sekmede login/logout sonrası useSyncExternalStore tetikler */
export function subscribeAuth(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === TOKEN_KEY || e.key === USER_KEY || e.key === null) {
      listener();
    }
  };
  const onLocal = () => listener();
  window.addEventListener("storage", onStorage);
  window.addEventListener(AUTH_CHANGED, onLocal);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(AUTH_CHANGED, onLocal);
  };
}

function notifyAuthListeners(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AUTH_CHANGED));
}

export type StoredUser = {
  id: string;
  email: string;
  role: string;
};

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): StoredUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export function setAuthSession(token: string, user: StoredUser): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  notifyAuthListeners();
}

export function clearAuthSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  notifyAuthListeners();
}

export function hasStaffAccess(role: string): boolean {
  return [
    "ADMIN",
    "OPERATIONS_MANAGER",
    "OPERATIONS_SPECIALIST",
    "ACCOUNTING_SPECIALIST",
  ].includes(role);
}

export function canViewCouriers(role: string): boolean {
  return ["ADMIN", "OPERATIONS_MANAGER", "OPERATIONS_SPECIALIST"].includes(role);
}

export function canAssignCourier(role: string): boolean {
  return ["ADMIN", "OPERATIONS_MANAGER", "OPERATIONS_SPECIALIST"].includes(role);
}

export function canViewUsers(role: string): boolean {
  return ["ADMIN", "OPERATIONS_MANAGER"].includes(role);
}

/** White-label logo ve uygulama adı */
export function canManageBranding(role: string): boolean {
  return ["ADMIN", "OPERATIONS_MANAGER"].includes(role);
}

export function canCreateStaffUsers(role: string): boolean {
  return role === "ADMIN";
}

export function isCustomerRole(role: string): boolean {
  return role === "INDIVIDUAL_CUSTOMER" || role === "CORPORATE_CUSTOMER";
}

/** WebSocket `join_order_tracking` ile uyumlu roller (RealtimeGateway) */
export function canJoinOrderTrackingSocket(role: string): boolean {
  if (isCustomerRole(role)) return true;
  return ["ADMIN", "OPERATIONS_MANAGER", "OPERATIONS_SPECIALIST"].includes(role);
}

export function canViewCustomers(role: string): boolean {
  return [
    "ADMIN",
    "OPERATIONS_MANAGER",
    "OPERATIONS_SPECIALIST",
    "ACCOUNTING_SPECIALIST",
  ].includes(role);
}

export function canViewFinance(role: string): boolean {
  return ["ADMIN", "ACCOUNTING_SPECIALIST", "OPERATIONS_MANAGER"].includes(
    role,
  );
}

export function canPostFinanceTransaction(role: string): boolean {
  return ["ADMIN", "ACCOUNTING_SPECIALIST"].includes(role);
}

export function canViewCourierEarnings(role: string): boolean {
  return ["ADMIN", "ACCOUNTING_SPECIALIST", "OPERATIONS_MANAGER"].includes(
    role,
  );
}

export function canMarkCourierPaid(role: string): boolean {
  return ["ADMIN", "ACCOUNTING_SPECIALIST"].includes(role);
}

export function canViewReports(role: string): boolean {
  return ["ADMIN", "ACCOUNTING_SPECIALIST", "OPERATIONS_MANAGER"].includes(
    role,
  );
}

export function canManagePricingRules(role: string): boolean {
  return ["ADMIN", "OPERATIONS_MANAGER", "ACCOUNTING_SPECIALIST"].includes(
    role,
  );
}

export function canDeletePricingRules(role: string): boolean {
  return ["ADMIN", "OPERATIONS_MANAGER"].includes(role);
}

export function canEditCustomerProfile(role: string): boolean {
  return ["ADMIN", "OPERATIONS_MANAGER", "ACCOUNTING_SPECIALIST"].includes(
    role,
  );
}

/** Kurumsal cari borç izni ve limit — yalnızca ADMIN */
export function canManageCustomerCredit(role: string): boolean {
  return role === "ADMIN";
}
