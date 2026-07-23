import { apiClient } from '../../../shared/services/apiClient';

export interface AdminOffer {
  _id: string;
  restaurantId: string;
  title: string;
  description?: string;
  promoCode: string;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: number;
  requiredPoints: number;
  minOrderAmount: number | null;
  maxDiscount: number | null;
  startDate: string;
  expiryDate: string;
  status: 'ACTIVE' | 'INACTIVE' | 'EXPIRED';
  displayPriority: number;
  image: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOfferPayload {
  title: string;
  description?: string;
  promoCode: string;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: number;
  requiredPoints?: number;
  minOrderAmount?: number | null;
  maxDiscount?: number | null;
  startDate: string;
  expiryDate: string;
  status?: 'ACTIVE' | 'INACTIVE';
  displayPriority?: number;
  image?: string;
}

export interface UpdateOfferPayload {
  title?: string;
  description?: string;
  promoCode?: string;
  discountType?: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue?: number;
  minOrderAmount?: number | null;
  maxDiscount?: number | null;
  startDate?: string;
  expiryDate?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'EXPIRED';
  displayPriority?: number;
  image?: string;
}

export interface OfferListResponse {
  offers: AdminOffer[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface OfferListParams {
  page?: number;
  limit?: number;
  status?: 'ACTIVE' | 'INACTIVE' | 'EXPIRED';
  q?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const adminOffersApi = {
  create: async (payload: CreateOfferPayload): Promise<AdminOffer> => {
    const res = await apiClient.post('/admin/offers', payload);
    return res.data.data.offer;
  },

  list: async (params: OfferListParams = {}): Promise<OfferListResponse> => {
    const res = await apiClient.get('/admin/offers', { params });
    return res.data.data;
  },

  getById: async (id: string): Promise<AdminOffer> => {
    const res = await apiClient.get(`/admin/offers/${id}`);
    return res.data.data.offer;
  },

  update: async (id: string, payload: UpdateOfferPayload): Promise<AdminOffer> => {
    const res = await apiClient.patch(`/admin/offers/${id}`, payload);
    return res.data.data.offer;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/admin/offers/${id}`);
  },

  toggleStatus: async (id: string, status: 'ACTIVE' | 'INACTIVE'): Promise<AdminOffer> => {
    const res = await apiClient.patch(`/admin/offers/${id}/toggle`, { status });
    return res.data.data.offer;
  },
};
