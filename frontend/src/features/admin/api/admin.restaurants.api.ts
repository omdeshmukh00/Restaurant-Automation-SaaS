import { apiClient } from '../../../shared/services/apiClient';
import { getStoredUser } from '../../../auth/tokenStore';

function adminRestaurantId(): string | undefined {
  return getStoredUser('admin')?.restaurantId;
}

export interface RestaurantEmailPreferences {
  dailySalesReports: boolean;
  inventoryAlerts: boolean;
  staffNotifications: boolean;
}

export interface RestaurantBranding {
  logoUrl?: string;
  primaryColor?: string;
}

export interface RestaurantSettings {
  currency: string;
  taxRate: number;
  serviceChargeEnabled: boolean;
  sessionDurationMinutes: number;
  emailPreferences: RestaurantEmailPreferences;
  branding: RestaurantBranding;
  timezone: string;
  dateFormat: string;
  timeFormat: string;
  integrations?: Record<string, { connected: boolean }>;
  floors: { id: string; label: string; tables: number }[];
  sections: { id: string; label: string; tables: number }[];
}

export interface RestaurantBillingSummary {
  plan: string;
  cycle: string;
  nextBillingDate: string;
  amount: string;
  currency: string;
}

export interface RestaurantSettingsResponse {
  restaurantId: string;
  restaurant: RestaurantOverviewRestaurant;
  settings: RestaurantSettings;
  billing: RestaurantBillingSummary | null;
}

export interface RestaurantOverviewRestaurant {
  id: string;
  name: string;
  cuisine: string;
  city: string;
  type: string;
  phone: string;
  address: string;
  plan: string;
  rating: number;
  location_url?: string;
  status: string;
}

export interface RestaurantOverviewMetrics {
  totalTables: number;
  activeSessions: number;
  occupiedTables: number;
}

export interface RestaurantOverviewResponse {
  restaurant: RestaurantOverviewRestaurant;
  metrics: RestaurantOverviewMetrics;
}

export const adminRestaurantApi = {
  getSettings: async (): Promise<RestaurantSettingsResponse> => {
    const response = await apiClient.get('/admin/restaurant/settings', {
      params: { restaurantId: adminRestaurantId() },
    });
    return response.data.data;
  },
  updateSettings: async (data: Record<string, unknown>): Promise<RestaurantSettingsResponse> => {
    const response = await apiClient.patch('/admin/restaurant/settings', {
      ...data,
      restaurantId: adminRestaurantId(),
    });
    return response.data.data;
  },
  getOverview: async (): Promise<RestaurantOverviewResponse> => {
    const response = await apiClient.get('/admin/restaurant/overview', {
      params: { restaurantId: adminRestaurantId() },
    });
    return response.data.data;
  },
};
