import type { CustomerRole, LoginResponse } from './types';
import { api } from './client';

export async function loginRequest(email: string, password: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/login', { email, password });
  return data;
}

export async function registerCustomerRequest(
  email: string,
  password: string,
  role: CustomerRole,
): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/register', {
    email,
    password,
    role,
  });
  return data;
}
