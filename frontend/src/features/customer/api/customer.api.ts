import { apiClient } from '../../../shared/services/apiClient';

type ApiResponse<T> = {
  success: boolean;
  data: T;
};

export type CustomerPaymentMethod = 'CASH' | 'CARD' | 'UPI' | 'WALLET' | 'ONLINE';

export type CreateCustomerPaymentResponse = {
  billId: string;
  paymentIntentId: string;
  paymentId: string;
  amount: number;
  currency: string;
  razorpayOrderId: string | null;
  razorpayKeyId: string | null;
  provider: 'razorpay' | 'mock' | string;
  payment?: {
    _id?: string;
    id?: string;
    amount?: number;
    method?: CustomerPaymentMethod;
    status?: string;
    providerPaymentId?: string | null;
    razorpayOrderId?: string | null;
  } | null;
};

export type VerifyCustomerPaymentInput = {
  paymentId: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
  simulateStatus?: 'PENDING' | 'PAID' | 'COMPLETED' | 'FAILED' | 'EXPIRED';
};

export type VerifyCustomerPaymentResponse = {
  bill: unknown;
  payment: unknown;
};

export async function createCustomerPayment(paymentMethod: CustomerPaymentMethod) {
  const response = await apiClient.post<ApiResponse<CreateCustomerPaymentResponse>>('/payments/customer/create', {
    paymentMethod,
  });

  return response.data.data;
}

export async function verifyCustomerPayment(input: VerifyCustomerPaymentInput) {
  const response = await apiClient.post<ApiResponse<VerifyCustomerPaymentResponse>>(
    '/payments/customer/verify',
    input,
  );

  return response.data.data;
}

export async function requestCashPayment() {
  const response = await apiClient.post<ApiResponse<any>>('/payments/customer/cash');
  return response.data.data;
}

export async function placeCustomerOrder(specialInstructions: string = '') {
  const response = await apiClient.post<ApiResponse<any>>('/customer/orders', {
    specialInstructions,
  });
  return response.data.data;
}

export type CustomerRequestType = 'waiter' | 'water' | 'cutlery' | 'cleaning' | 'bill' | 'help';

export async function createCustomerRequest(type: CustomerRequestType) {
  const response = await apiClient.post<ApiResponse<any>>(`/customer/requests/${type}`);
  return response.data;
}

export type SubmitFeedbackInput = {
  rating: number;
  comment?: string;
};

export async function submitCustomerFeedback(input: SubmitFeedbackInput) {
  const response = await apiClient.post<ApiResponse<any>>('/customer/feedback', input);
  return response.data;
}

export async function getLiveBill() {
  const response = await apiClient.get<ApiResponse<any>>('/billing/customer/bill');
  return response.data.data;
}

export async function requestFinalBill() {
  const response = await apiClient.post<ApiResponse<any>>('/billing/customer/bill/request');
  return response.data.data;
}

export function getInvoicePdfUrl(billId: string): string {
  // Uses backend route to download the PDF
  return `${import.meta.env.VITE_API_URL || '/api/v1'}/billing/customer/bill/${billId}/receipt/pdf`;
}

// ── Reservation APIs (customer panel) ────────────────────────────────

export type CustomerReservationInput = {
  customerName?: string;
  mobile?: string;
  guests?: number;
  date: string;
  slot: string;
  tableNumber?: string;
  notes?: string;
  occasion?: string;
  preferredArea?: string;
  status?: string;
};

export type CustomerReservationResponse = {
  _id?: string;
  id?: string;
  customerName?: string;
  mobile?: string;
  guests?: number;
  date?: string;
  slot?: string;
  status?: string;
  occasion?: string;
  preferredArea?: string;
  notes?: string;
  tableNumber?: string;
};

export async function createCustomerReservation(input: CustomerReservationInput) {
  const response = await apiClient.post<ApiResponse<{ reservation: CustomerReservationResponse }>>(
    '/customer/reservations',
    input,
  );

  return response.data.data.reservation;
}

export async function getCustomerReservations() {
  const response = await apiClient.get<ApiResponse<{ reservations: CustomerReservationResponse[] }>>(
    '/customer/reservations',
  );

  return response.data.data.reservations ?? [];
}

export async function updateCustomerReservation(
  id: string,
  updates: Partial<CustomerReservationInput>,
) {
  const response = await apiClient.patch<ApiResponse<{ reservation: CustomerReservationResponse }>>(
    `/customer/reservations/${id}`,
    updates,
  );

  return response.data.data.reservation;
}

export async function cancelCustomerReservation(id: string) {
  const response = await apiClient.post<ApiResponse<{ reservation: CustomerReservationResponse }>>(
    `/customer/reservations/${id}/cancel`,
  );

  return response.data.data.reservation;
}

// ── Loyalty & Offers ──────────────────────────────────────────────────

export type CustomerWallet = {
  pointsBalance: number;
  lifetimePoints: number;
  tier: string;
};

export type CustomerOffer = {
  _id: string;
  title: string;
  description?: string;
  promoCode: string;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: number;
  requiredPoints: number;
  minOrderAmount: number | null;
  maxDiscount: number | null;
  expiryDate: string;
  startDate: string;
};

export type OfferEligibility = {
  offerId: string;
  name: string;
  code: string;
  requiredPoints: number;
  eligible: boolean;
};

export type RedeemOfferResult = {
  success: boolean;
  remainingPoints: number;
  offer: CustomerOffer;
};

export async function getCustomerWallet() {
  const response = await apiClient.get<ApiResponse<{ wallet: CustomerWallet }>>('/customer/loyalty');
  return response.data.data.wallet;
}

export async function getCustomerOffers() {
  const response = await apiClient.get<ApiResponse<{ offers: CustomerOffer[] }>>('/customer/offers');
  return response.data.data.offers;
}

export async function getOfferEligibility() {
  const response = await apiClient.get<ApiResponse<{ eligibility: OfferEligibility[] }>>('/customer/offers/eligibility');
  return response.data.data.eligibility;
}

export async function redeemCustomerOffer(offerId: string) {
  const response = await apiClient.post<ApiResponse<RedeemOfferResult>>(`/customer/offers/${offerId}/redeem`);
  return response.data.data;
}

// ── User profile / history APIs ──────────────────────────────────────

export async function getLoyaltyWallet() {
  const response = await apiClient.get<ApiResponse<any>>('/users/me/loyalty');
  return response.data.data;
}

export async function getNotifications() {
  const response = await apiClient.get<ApiResponse<any>>('/users/me/notifications');
  return response.data.data;
}

export async function getOrderHistory() {
  const response = await apiClient.get<ApiResponse<any>>('/users/me/order-history');
  return response.data.data;
}

export async function getReservations() {
  const response = await apiClient.get<ApiResponse<any>>('/users/me/reservations');
  return response.data.data;
}
