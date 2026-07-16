import { apiClient } from '../../../shared/services/apiClient';

export interface RevenueQuery {
  from?: string;
  to?: string;
  groupBy?: 'day' | 'month';
  restaurantId?: string;
}

export interface RevenueAnalytics {
  summary: {
    averageBillValue: number;
    billCount: number;
    totalDiscount: number;
    totalRevenue: number;
    totalTax: number;
  };
  revenue: { period: string; totalRevenue: number; billCount: number; totalTax: number; totalDiscount: number }[];
  paymentReport: { count: number; paymentMethod: string; totalAmount: number }[];
  filters: Record<string, unknown>;
}

export interface AuditLogEntry {
  _id: string;
  actorId: string;
  actorRole: string;
  restaurantId?: string;
  entityType: string;
  entityId: string;
  action: string;
  metadata: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export interface AuditLogsResponse {
  logs: AuditLogEntry[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
}

export const adminAnalyticsApi = {
  getRevenue: async (params?: RevenueQuery): Promise<RevenueAnalytics> => {
    const response = await apiClient.get('/admin/analytics/revenue', { params });
    return response.data.data;
  },
};

export const adminAuditLogsApi = {
  getAuditLogs: async (params?: Record<string, any>): Promise<AuditLogsResponse> => {
    const response = await apiClient.get('/admin/audit-logs', { params });
    return response.data.data;
  },
};
