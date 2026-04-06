export type OrderStatus =
  | "PENDING"
  | "SEARCHING_COURIER"
  | "ACCEPTED"
  | "PICKED_UP"
  | "ON_DELIVERY"
  | "DELIVERED"
  | "CANCELLED";

export type Order = {
  id: string;
  customerId: string;
  courierId: string | null;
  status: OrderStatus;
  pickupLat: number;
  pickupLng: number;
  deliveryLat: number;
  deliveryLng: number;
  price: string;
  createdAt: string;
  /** DELIVERED geçişinde set (metrik) */
  deliveredAt?: string | null;
  pricingRuleId?: string | null;
  courierSharePercent?: string | null;
  courierEarningAmount?: string | null;
  platformCommissionAmount?: string | null;
  customer?: { id: string; email: string };
  courier?: {
    id: string;
    type: string;
    fullName?: string | null;
    isOnline?: boolean;
    lat?: number | null;
    lng?: number | null;
    user?: { email: string };
  };
};

export type CourierOpsState =
  | "offline"
  | "online_idle"
  | "online_busy";

export type CourierStats = {
  activeOrdersCount: number;
  todayDeliveriesCount: number;
  avgDeliveryMinutes: number | null;
  todayEarningsTry: string;
};

export type Courier = {
  id: string;
  userId: string;
  type: string;
  fullName?: string | null;
  phone?: string | null;
  plateNumber?: string | null;
  isOnline: boolean;
  lat: number | null;
  lng: number | null;
  user: { id: string; email: string; role: string };
  stats?: CourierStats;
  opsState?: CourierOpsState;
};

export type CourierDocumentSlot = {
  type: string;
  fileUrl: string | null;
  reviewStatus: string;
  rejectionReason: string | null;
};

/** GET /couriers/registrations/pending */
export type PendingCourierRegistration = {
  id: string;
  userId: string;
  workflowStatus: string;
  fullName: string | null;
  type: string;
  phone: string | null;
  birthDate: string | null;
  tcNo: string | null;
  plateNumber: string | null;
  hasCompany: boolean;
  companyTaxId: string | null;
  companyTaxOffice: string | null;
  companyAddress: string | null;
  residenceAddress: string | null;
  photoUrl: string | null;
  user: { id: string; email: string };
  /** awaiting-documents / document-review uçlarında dolu */
  documents?: CourierDocumentSlot[];
};

export type CourierPerformancePoint = {
  date: string;
  deliveries: number;
  earningsTry: number;
};

export type CourierPerformanceMetrics = {
  totalDeliveries: number;
  successfulDeliveries: number;
  cancelledDeliveries: number;
  averageDeliveryTimeMinutes: string | null;
  successRate: number | null;
  lastActiveAt: string | null;
};

export type CourierRatingRow = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  orderId: string;
};

export type CourierRatingSummary = {
  averageRating: string | null;
  totalRatings: number;
  dispatchScore: string;
};

export type CourierDetailResponse = {
  courier: Courier;
  opsState: CourierOpsState;
  stats: {
    activeOrdersCount: number;
    totalEarningsTry: string;
    totalEarningRows: number;
    pendingEarningsTry: string;
  };
  activeOrders: Order[];
  recentOrders: Order[];
  performanceSeries: CourierPerformancePoint[];
  performanceMetrics: CourierPerformanceMetrics;
  ratingSummary: CourierRatingSummary;
  recentRatings: CourierRatingRow[];
  isLowPerformance: boolean;
};

export type LoginResponse = {
  accessToken: string;
  user: { id: string; email: string; role: string };
};

export type StaffUser = {
  id: string;
  email: string;
  role: string;
  createdAt: string;
};

/** POST /users gövdesi (CreateUserDto ile uyumlu) */
export type CreateStaffUserBody = {
  email: string;
  password: string;
  role: string;
};
