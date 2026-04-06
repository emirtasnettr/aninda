import { apiFetch } from "@/lib/api/client";
import type { PendingCourierRegistration } from "@/lib/api/types";

export function fetchPendingCourierRegistrations(): Promise<
  PendingCourierRegistration[]
> {
  return apiFetch<PendingCourierRegistration[]>("/couriers/registrations/pending");
}

/** Ön onaylı — evrak yükleme / düzeltme (panel: durum takibi) */
export function fetchAwaitingDocumentsCouriers(): Promise<
  PendingCourierRegistration[]
> {
  return apiFetch<PendingCourierRegistration[]>(
    "/couriers/registrations/awaiting-documents",
  );
}

/** Evrak inceleme kuyruğu */
export function fetchDocumentReviewCouriers(): Promise<
  PendingCourierRegistration[]
> {
  return apiFetch<PendingCourierRegistration[]>(
    "/couriers/registrations/document-review",
  );
}

export function approveCourierRegistration(
  courierId: string,
): Promise<unknown> {
  return apiFetch(`/couriers/registrations/${courierId}/approve`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function rejectCourierRegistration(
  courierId: string,
  body: { reason?: string },
): Promise<unknown> {
  return apiFetch(`/couriers/registrations/${courierId}/reject`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function docTypeToPathSegment(docType: string): string {
  return docType.toLowerCase().replace(/_/g, "-");
}

export function approveCourierDocument(
  courierId: string,
  docType: string,
): Promise<unknown> {
  const seg = docTypeToPathSegment(docType);
  return apiFetch(
    `/couriers/registrations/${courierId}/documents/${seg}/approve`,
    { method: "POST", body: JSON.stringify({}) },
  );
}

export function rejectCourierDocument(
  courierId: string,
  docType: string,
  body: { reason?: string },
): Promise<unknown> {
  const seg = docTypeToPathSegment(docType);
  return apiFetch(
    `/couriers/registrations/${courierId}/documents/${seg}/reject`,
    { method: "POST", body: JSON.stringify(body) },
  );
}
