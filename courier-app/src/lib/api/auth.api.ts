import axios from 'axios';
import type { CourierType, LoginResponse } from './types';
import { api } from './client';

export async function loginRequest(email: string, password: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/login', { email, password });
  return data;
}

function messageFromRegisterError(body: unknown): string {
  if (typeof body !== 'object' || body === null || !('message' in body)) {
    return 'Kayıt başarısız';
  }
  const m = (body as { message: unknown }).message;
  if (typeof m === 'string') {
    return m;
  }
  if (Array.isArray(m) && m.every((x) => typeof x === 'string')) {
    return m.join(', ');
  }
  return 'Kayıt başarısız';
}

export type RegisterCourierOnboardingBody = {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  birthDate: string;
  tcNo: string;
  vehicleType: CourierType;
  plateNumber: string;
  hasCompany: boolean;
  companyTaxId?: string;
  companyTaxOffice?: string;
  companyAddress?: string;
  residenceAddress?: string;
};

/** Kurye çok adımlı başvuru (JSON) */
export async function registerCourierOnboarding(
  body: RegisterCourierOnboardingBody,
): Promise<LoginResponse> {
  try {
    const { data } = await api.post<LoginResponse>('/auth/register/courier', body);
    return data;
  } catch (e: unknown) {
    if (axios.isAxiosError(e) && e.response?.data) {
      throw new Error(messageFromRegisterError(e.response.data));
    }
    throw e instanceof Error ? e : new Error('Kayıt başarısız');
  }
}
