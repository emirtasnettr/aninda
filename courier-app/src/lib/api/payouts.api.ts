import { api } from './client';

export type MyPayoutRequest = {
  id: string;
  amount: string;
  status: 'PENDING' | 'APPROVED' | 'PAID' | 'REJECTED';
  receiptUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function fetchMyPayoutRequests(): Promise<MyPayoutRequest[]> {
  const { data } = await api.get<MyPayoutRequest[]>('/payout-requests/me');
  return data;
}

export async function createPayoutRequest(): Promise<unknown> {
  const { data } = await api.post('/payout-requests');
  return data;
}
