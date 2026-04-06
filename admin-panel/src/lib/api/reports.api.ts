import { apiFetch } from "./client";
import type { ErpOverview } from "./erp-types";

export function fetchErpOverview(): Promise<ErpOverview> {
  return apiFetch<ErpOverview>("/reports/erp-overview");
}
