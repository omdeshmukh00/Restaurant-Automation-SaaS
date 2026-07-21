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
