// src/features/superAdmin/store/Superadmindashboard.ts
import { create } from "zustand";
import { apiClient } from "../../../shared/services/apiClient";

interface DashboardData {
  stats: {
    totalRestaurants: number;
    restaurantGrowth: string;
    monthlyRevenue: number;
    revenueGrowth: string;
    totalOrders: number;
    ordersGrowth: string;
    commissionEarned: number;
    commissionGrowth: string;
  };
  pieData: Array<{ name: string; value: number; color: string }>;
  revenueData: Array<{ month: string; revenue: number; orders: number }>;
  topRestaurants: Array<{ name: string; orders: number; revenue: string; growth: string }>;
}

interface SuperAdminDashboardState {
  data: DashboardData | null;
  loading: boolean;
  fetchOverview: () => Promise<void>;
}

export const useSuperAdminDashboardStore = create<SuperAdminDashboardState>((set) => ({
  data: null,
  loading: false,
  fetchOverview: async () => {
    set({ loading: true });
    try {
      const res = await apiClient.get("/superadmin/platform/overview");
      if (res.data?.success || res.data) {
        const payload = res.data.data || res.data;
        set({ data: payload });
      }
    } catch (error) {
      console.error("Failed to fetch superadmin overview", error);
    } finally {
      set({ loading: false });
    }
  }
}));