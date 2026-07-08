import { apiClient } from '../../../shared/services/apiClient';

export const adminOrdersApi = {
  getOrders: async (params?: Record<string, any>) => {
    const response = await apiClient.get('/admin/orders', { params });
    return {
      orders: response.data.data.orders,
      pagination: response.data.data.pagination,
    };
  },

  getOrder: async (id: string) => {
    const response = await apiClient.get(`/admin/orders/${id}`);
    return response.data.data.order;
  },

  createOrder: async (payload: any) => {
    const response = await apiClient.post('/admin/orders', payload);
    return response.data.data.order;
  },

  updateOrder: async (id: string, payload: any) => {
    const response = await apiClient.patch(`/admin/orders/${id}`, payload);
    return response.data.data.order;
  },
};
