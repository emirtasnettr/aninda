import type { ErpCustomerType } from "@/lib/api/erp-types";
import { cn } from "@/lib/utils";

export type CariRiskLevel = "normal" | "near_limit" | "over_limit" | "no_limit_line";

function num(s: string): number {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Pozitif bakiye = müşteri borcu (DEBIT ağırlıklı).
 * Kurumsal + cari borç açık: limit ile karşılaştır.
 */
export function cariRiskLevel(
  balanceTry: string,
  type: ErpCustomerType,
  creditEnabled: boolean,
  creditLimitTry: string | null,
): CariRiskLevel {
  const b = num(balanceTry);
  const hasLine =
    type === "CORPORATE" &&
    creditEnabled &&
    creditLimitTry != null &&
    num(creditLimitTry) > 0;

  if (!hasLine) {
    return "no_limit_line";
  }

  const limit = num(creditLimitTry!);
  if (b > limit) return "over_limit";
  if (limit > 0 && b > limit * 0.8) return "near_limit";
  return "normal";
}

export function cariRiskLabel(
  level: CariRiskLevel,
  balanceTry?: string,
): string {
  if (
    level === "no_limit_line" &&
    balanceTry != null &&
    num(balanceTry) <= 0
  ) {
    return "Normal (peşin)";
  }
  switch (level) {
    case "normal":
      return "Normal";
    case "near_limit":
      return "Limite yakın";
    case "over_limit":
      return "Limit aşımı";
    case "no_limit_line":
      return "Limitsiz borç";
    default:
      return level;
  }
}

export function cariRiskBadgeClass(
  level: CariRiskLevel,
  balanceTry?: string,
): string {
  if (
    level === "no_limit_line" &&
    balanceTry != null &&
    num(balanceTry) <= 0
  ) {
    return "border-emerald-600/35 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100";
  }
  switch (level) {
    case "normal":
      return "border-emerald-600/35 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100";
    case "near_limit":
      return "border-amber-500/40 bg-amber-50 text-amber-950 dark:border-amber-600 dark:bg-amber-950 dark:text-amber-100";
    case "over_limit":
      return "border-red-600/40 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-100";
    case "no_limit_line":
      return "border-amber-500/35 bg-amber-50/90 text-amber-950 dark:border-amber-600 dark:bg-amber-950 dark:text-amber-100";
    default:
      return "";
  }
}

/** Tablo satırı hover + risk zemin */
export function cariRowClass(level: CariRiskLevel, balanceTry: string): string {
  const base = "transition-colors border-border/50";
  if (level === "over_limit") {
    return cn(base, "bg-red-500/[0.07] hover:bg-red-500/[0.11]");
  }
  if (level === "near_limit") {
    return cn(base, "bg-amber-500/[0.07] hover:bg-amber-500/[0.11]");
  }
  if (level === "no_limit_line" && num(balanceTry) > 0) {
    return cn(base, "bg-amber-500/[0.04] hover:bg-amber-500/[0.09]");
  }
  return cn(base, "hover:bg-muted/35");
}
