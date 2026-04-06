export type CourierType = 'MOTORCYCLE' | 'CAR';

export type CourierWorkflowStatus =
  | 'PENDING'
  | 'PRE_APPROVED'
  | 'DOCUMENT_PENDING'
  | 'DOCUMENT_REVIEW'
  | 'APPROVED'
  | 'REJECTED';

export type CourierDocumentType =
  | 'ID_FRONT'
  | 'LICENSE_FRONT'
  | 'LICENSE_BACK'
  | 'RESIDENCE'
  | 'CRIMINAL_RECORD';

export type CourierDocumentReviewStatus =
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'MISSING';

export interface CourierDocumentSlot {
  type: CourierDocumentType;
  fileUrl: string | null;
  reviewStatus: CourierDocumentReviewStatus;
  rejectionReason: string | null;
}

export interface AuthUserDto {
  id: string;
  email: string;
  role: string;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUserDto;
}

export interface CourierPerformanceSnapshot {
  totalDeliveries: number;
  successfulDeliveries: number;
  cancelledDeliveries: number;
  averageDeliveryTimeMinutes: string | null;
}

export interface CourierProfile {
  id: string;
  userId: string;
  type: CourierType;
  workflowStatus: CourierWorkflowStatus;
  isOnline: boolean;
  lat: number | null;
  lng: number | null;
  fullName?: string | null;
  phone?: string | null;
  birthDate?: string | null;
  tcNo?: string | null;
  plateNumber?: string | null;
  hasCompany?: boolean;
  companyTaxId?: string | null;
  companyTaxOffice?: string | null;
  companyAddress?: string | null;
  residenceAddress?: string | null;
  photoUrl?: string | null;
  rejectionReason?: string | null;
  bankName?: string | null;
  accountHolderName?: string | null;
  iban?: string | null;
  /** API JSON: ondalık string */
  averageRating?: string | null;
  totalRatings?: number;
  performance?: CourierPerformanceSnapshot | null;
  /** Sunucu: aktif teslimat (ACCEPTED / PICKED_UP / ON_DELIVERY) varken true */
  busy?: boolean;
  documents: CourierDocumentSlot[];
  user: {
    id: string;
    email: string;
    role: string;
  };
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
  /** Sunucudan gelirse kurye hakedişi; yoksa fiyat üzerinden tahmin */
  courierEarningAmount?: string | null;
  createdAt: string;
  offers?: OrderOffer[];
  customer?: { id: string; email: string };
  courier?: {
    id: string;
    type: CourierType;
    user?: { email: string };
  };
}

export interface JobRequestPayload {
  orderId: string;
  pickupLat: number;
  pickupLng: number;
  deliveryLat: number;
  deliveryLng: number;
  price: string;
  status: string;
}
