export type ErpCustomerType = "INDIVIDUAL" | "CORPORATE";

export type PricingRule = {
  id: string;
  customerId: string | null;
  basePrice: string;
  perKmPrice: string;
  minPrice: string;
  priorityMultiplier: string;
  nightMultiplier: string;
  courierSharePercent: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: { id: string; name: string; email: string } | null;
};

export type Customer = {
  id: string;
  userId: string;
  name: string;
  type: ErpCustomerType;
  phone: string | null;
  email: string;
  address: string | null;
  taxNumber: string | null;
  /** Kurumsal: ADMIN ile açılabilir cari borç */
  creditEnabled: boolean;
  /** TRY string; borç izni için üst sınır */
  creditLimit: string | null;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; email: string; role: string };
  account?: { id: string; balance: string; customerId: string };
  pricingRules?: PricingRule[];
};

export type AccountTransactionType = "DEBIT" | "CREDIT";

export type CustomerAccountRow = {
  id: string;
  customerId: string;
  balance: string;
  updatedAt: string;
  /** Son cari hareket (varsa) */
  lastTransactionAt?: string | null;
  customer: {
    id: string;
    name: string;
    email: string;
    type: ErpCustomerType;
    creditEnabled: boolean;
    creditLimit: string | null;
  };
};

export type CustomerTransaction = {
  id: string;
  customerId: string;
  type: AccountTransactionType;
  amount: string;
  description: string | null;
  createdAt: string;
  customer: { id: string; name: string; email: string };
};

export type CourierEarningStatus = "PENDING" | "REQUESTED" | "PAID";

export type CourierEarning = {
  id: string;
  courierId: string;
  orderId: string;
  amount: string;
  status: CourierEarningStatus;
  createdAt: string;
  courier: {
    fullName?: string | null;
    user: { email: string };
  };
  order: { id: string; price: string; status: string; deliveredAt: string | null };
};

export type PayoutRequestStatus =
  | "PENDING"
  | "APPROVED"
  | "PAID"
  | "REJECTED";

export type PayoutRequestRow = {
  id: string;
  courierId: string;
  amount: string;
  status: PayoutRequestStatus;
  receiptUrl: string | null;
  createdAt: string;
  updatedAt: string;
  courier: {
    fullName?: string | null;
    bankName?: string | null;
    accountHolderName?: string | null;
    iban?: string | null;
    user: { email: string };
  };
};

export type ErpOverview = {
  customers: number;
  ordersByStatus: Record<string, number>;
  totalOrders: number;
  receivablesBalance: string;
  courierEarningsPending: string;
  courierEarningsPaid: string;
  /** Teslim edilmiş siparişlerde toplam müşteri tutarı (ciro) */
  revenueDelivered: string;
  /** Snapshot alanmış teslimlerde platform komisyonu toplamı */
  platformCommissionDelivered: string;
  /** Tüm kurye hakediş kalemleri (durum ayrımı olmadan) */
  courierEarningsTotal: string;
};
