import { apiFetch } from "./client";
import type {
  CustomerAccountRow,
  CustomerTransaction,
} from "./erp-types";

export function fetchFinanceAccounts(): Promise<CustomerAccountRow[]> {
  return apiFetch<CustomerAccountRow[]>("/finance/accounts");
}

export type FinanceAccountDetail = {
  id: string;
  customerId: string;
  balance: string;
  updatedAt: string;
  customer: {
    id: string;
    name: string;
    email: string;
    type: string;
    phone: string | null;
    creditEnabled: boolean;
    creditLimit: string | null;
  };
};

export function fetchFinanceAccount(
  customerId: string,
): Promise<FinanceAccountDetail> {
  return apiFetch(`/finance/accounts/${customerId}`);
}

export function fetchFinanceTransactions(
  customerId?: string,
): Promise<CustomerTransaction[]> {
  const q = customerId
    ? `?customerId=${encodeURIComponent(customerId)}`
    : "";
  return apiFetch<CustomerTransaction[]>(`/finance/transactions${q}`);
}

export function createFinanceTransaction(
  customerId: string,
  body: {
    type: "DEBIT" | "CREDIT";
    amount: number;
    description?: string;
  },
): Promise<CustomerTransaction> {
  return apiFetch<CustomerTransaction>(
    `/finance/accounts/${customerId}/transactions`,
    { method: "POST", body: JSON.stringify(body) },
  );
}
