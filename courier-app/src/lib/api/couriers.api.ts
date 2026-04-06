import type { CourierDocumentType, CourierProfile } from './types';
import { api } from './client';

export interface PatchCourierBody {
  isOnline?: boolean;
  lat?: number;
  lng?: number;
  type?: 'MOTORCYCLE' | 'CAR';
  bankName?: string;
  accountHolderName?: string;
  iban?: string;
}

/** API path segmenti (örn. id-front) */
export function courierDocumentTypeToSlug(t: CourierDocumentType): string {
  return t.toLowerCase().replace(/_/g, '-');
}

export async function fetchCourierMe(): Promise<CourierProfile> {
  const { data } = await api.get<CourierProfile>('/couriers/me');
  return data;
}

export async function patchCourierMe(body: PatchCourierBody): Promise<CourierProfile> {
  const { data } = await api.patch<CourierProfile>('/couriers/me', body);
  return data;
}

export async function uploadCourierDocument(
  docType: CourierDocumentType,
  file: { uri: string; name: string; type: string },
): Promise<CourierProfile> {
  const slug = courierDocumentTypeToSlug(docType);
  const form = new FormData();
  form.append('file', file as unknown as Blob);
  const { data } = await api.post<CourierProfile>(
    `/couriers/me/documents/${slug}`,
    form,
  );
  return data;
}

export async function submitCourierDocumentsForReview(): Promise<CourierProfile> {
  const { data } = await api.post<CourierProfile>(
    '/couriers/me/documents/submit-review',
    {},
  );
  return data;
}
