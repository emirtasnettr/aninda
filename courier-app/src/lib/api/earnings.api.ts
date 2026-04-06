import { api } from './client';

export type EarningsSummary = {
  totalEarningsTry: string;
  withdrawableTry: string;
  /** Ödeme talebi sürecindeki tutar (hesaba henüz geçmemiş) */
  requestedTry: string;
  paidTry: string;
  /** İstanbul takvim günü — bugün oluşan hakediş kalemleri */
  todayEarningsTry: string;
  /** Bir önceki İstanbul günü */
  yesterdayEarningsTry: string;
  /** Ödeme talebi için minimum tutar (₺) */
  minPayoutTry: string;
};

export type MyCourierEarning = {
  id: string;
  courierId: string;
  orderId: string;
  amount: string;
  status: 'PENDING' | 'REQUESTED' | 'PAID';
  createdAt: string;
  order: {
    id: string;
    price: string;
    status: string;
    deliveredAt: string | null;
    /** Alış–teslimat arası kuş uçuşu km */
    routeKm: number;
  };
};

export async function fetchEarningsSummary(): Promise<EarningsSummary> {
  const { data } = await api.get<EarningsSummary>('/courier-earnings/me/summary');
  return {
    ...data,
    requestedTry: data.requestedTry ?? '0',
    yesterdayEarningsTry: data.yesterdayEarningsTry ?? '0',
    minPayoutTry: data.minPayoutTry?.trim() ? data.minPayoutTry : '100',
  };
}

export async function fetchMyEarnings(): Promise<MyCourierEarning[]> {
  const { data } = await api.get<MyCourierEarning[]>('/courier-earnings/me');
  return data;
}
