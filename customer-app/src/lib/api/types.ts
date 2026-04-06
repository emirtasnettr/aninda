export type CustomerRole = 'INDIVIDUAL_CUSTOMER' | 'CORPORATE_CUSTOMER';

export interface AuthUserDto {
  id: string;
  email: string;
  role: string;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUserDto;
}

export interface OrderOffer {
  id: string;
  courierId: string;
  status: string;
  createdAt: string;
}

export interface Order {
  id: string;
  customerId: string;
  courierId: string | null;
  status: string;
  pickupLat: number;
  pickupLng: number;
  deliveryLat: number;
  deliveryLng: number;
  price: string;
  createdAt: string;
  pricingRuleId?: string | null;
  courierSharePercent?: string | null;
  courierEarningAmount?: string | null;
  platformCommissionAmount?: string | null;
  offers?: OrderOffer[];
  customer?: { id: string; email: string };
  courier?: {
    id: string;
    user?: { email: string };
    lat?: number | null;
    lng?: number | null;
    isOnline?: boolean;
  };
  /** Varsa bu sipariş için müşteri zaten puan vermiş */
  courierRating?: { id: string } | null;
}

export interface CourierLocationPayload {
  orderId: string;
  courierId: string;
  lat: number;
  lng: number;
  at: string;
}
