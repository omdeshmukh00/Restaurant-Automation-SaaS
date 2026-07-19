import { apiClient } from '../../../shared/services/apiClient';

export interface CustomerStats {
  totalCustomers: number;
  totalCustomersChange: string;
  loyalCustomers: number;
  loyalCustomersChange: string;
  totalVisits: number;
  totalVisitsChange: string;
  totalSpent: string;
  totalSpentChange: string;
}

export interface TopCustomer {
  rank: number;
  name: string;
  avatar: string;
  spent: string;
  spentRaw: number;
  id: string;
}

export interface LoyaltyDistribution {
  gold: number;
  silver: number;
  bronze: number;
  goldPct: number;
  silverPct: number;
  bronzePct: number;
}

export interface CustomerOverview {
  active: number;
  inactive: number;
  new: number;
  total: number;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar: string;
  loyaltyTier: 'Gold' | 'Silver' | 'Bronze';
  totalVisits: number;
  totalSpent: string;
  totalSpentRaw: number;
  lastOrder: string;
  lastOrderId: string;
  status: 'Active' | 'Inactive';
}

export interface CustomersResponse {
  customers: Customer[];
  total: number;
  page: number;
  perPage: number;
  stats: CustomerStats;
  topCustomers: TopCustomer[];
  loyaltyDistribution: LoyaltyDistribution;
  customerOverview: CustomerOverview;
}

export interface CustomerUpdate {
  name?: string;
  email?: string;
  tags?: string[];
}

export interface CustomerCreate {
  name: string;
  mobile: string;
  email?: string;
  tags?: string[];
}

export const customerApi = {
  getCustomers: async (params?: Record<string, unknown>): Promise<CustomersResponse> => {
    const response = await apiClient.get('/admin/customers', { params });
    return response.data.data;
  },

  getCustomer: async (id: string): Promise<{ customer: Customer }> => {
    const response = await apiClient.get(`/admin/customers/${id}`);
    return response.data.data;
  },

  updateCustomer: async (id: string, updates: CustomerUpdate): Promise<{ customer: Customer }> => {
    const response = await apiClient.patch(`/admin/customers/${id}`, updates);
    return response.data.data;
  },

  deleteCustomer: async (id: string): Promise<{ success: boolean }> => {
    const response = await apiClient.delete(`/admin/customers/${id}`);
    return response.data.data;
  },

  createCustomer: async (payload: CustomerCreate): Promise<{ customer: Customer }> => {
    const response = await apiClient.post('/admin/customers', payload);
    return response.data.data;
  },
};
