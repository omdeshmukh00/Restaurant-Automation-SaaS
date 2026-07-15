import { apiClient } from "../../../shared/services/apiClient";
import type { RestaurantRequest } from "../store/RestaurantRequests";
import type { Transaction } from "../components/Transactions/Transactiontypes";
import type { PlatformOrder } from "../store/Analytics";

export const superAdminRestaurantRequestEndpoints = {
  list: "/superadmin/restaurant-requests",
  approve: (id: string) => `/superadmin/restaurant-requests/${id}/approve`,
  deny: (id: string) => `/superadmin/restaurant-requests/${id}/deny`,
};

export const placeholderRestaurantRequests: RestaurantRequest[] = [
  {
    id: "REQ-101",
    name: "The Curry Leaf",
    owner: "Ananya Mehta",
    email: "ananya@curryleaf.in",
    phone: "+91 99001 22001",
    location: "Hyderabad, Telangana",
    plan: "Standard",
    requestedAt: "Today, 10:24 AM",
    message: "Looking to automate table orders, kitchen tickets, and billing.",
  },
  {
    id: "REQ-102",
    name: "Noodle Street",
    owner: "Rohan Das",
    email: "rohan@noodlestreet.in",
    phone: "+91 99001 22002",
    location: "Kolkata, West Bengal",
    plan: "Free",
    requestedAt: "Today, 09:58 AM",
    message: "Needs onboarding for QR ordering across one high-footfall outlet.",
  },
  {
    id: "REQ-103",
    name: "Bake & Brew",
    owner: "Meera Iyer",
    email: "meera@bakebrew.in",
    phone: "+91 99001 22003",
    location: "Bangalore, Karnataka",
    plan: "Premium",
    requestedAt: "Yesterday, 06:35 PM",
    message: "Wants staff dashboards, analytics, and multi-branch reporting.",
  },
];

const USE_PLACEHOLDER_RESTAURANT_REQUESTS = false;

export const superAdminRestaurantRequestsApi = {
  async getRequests(): Promise<RestaurantRequest[]> {
    if (USE_PLACEHOLDER_RESTAURANT_REQUESTS) {
      return Promise.resolve(placeholderRestaurantRequests);
    }

    const response = await apiClient.get<{ success: boolean; data: RestaurantRequest[] }>(
      superAdminRestaurantRequestEndpoints.list
    );
    return response.data.data;
  },

  async approveRequest(id: string): Promise<void> {
    if (USE_PLACEHOLDER_RESTAURANT_REQUESTS) {
      return Promise.resolve();
    }

    await apiClient.post(superAdminRestaurantRequestEndpoints.approve(id));
  },

  async denyRequest(id: string, reason: string, refund?: boolean): Promise<void> {
    if (USE_PLACEHOLDER_RESTAURANT_REQUESTS) {
      return Promise.resolve();
    }

    await apiClient.post(superAdminRestaurantRequestEndpoints.deny(id), { reason, refund });
  },

  async getRestaurants(): Promise<any[]> {
    if (USE_PLACEHOLDER_RESTAURANT_REQUESTS) {
      return Promise.resolve([]);
    }

    const response = await apiClient.get<{ success: boolean; data: { restaurants: any[] } }>(
      "/superadmin/restaurants"
    );
    return response.data.data.restaurants;
  },

  async getRestaurantById(id: string): Promise<any> {
    if (USE_PLACEHOLDER_RESTAURANT_REQUESTS) {
      return Promise.resolve(null);
    }

    const response = await apiClient.get<{ success: boolean; data: { restaurant: any } }>(
      `/superadmin/restaurants/${id}`
    );
    return response.data.data.restaurant;
  },

  async getPlans(): Promise<any[]> {
    if (USE_PLACEHOLDER_RESTAURANT_REQUESTS) {
      return Promise.resolve([]);
    }

    const response = await apiClient.get<{ success: boolean; data: { plans: any[] } }>(
      "/superadmin/plans"
    );
    return response.data.data.plans;
  },

  async updateRestaurantStatus(id: string, status: "Active" | "Trial" | "Inactive", blockReason?: string): Promise<void> {
    if (USE_PLACEHOLDER_RESTAURANT_REQUESTS) {
      return Promise.resolve();
    }

    await apiClient.patch(`/superadmin/restaurants/${id}/status`, { status, blockReason });
  },

  async updateRestaurantPlan(id: string, plan: string): Promise<void> {
    if (USE_PLACEHOLDER_RESTAURANT_REQUESTS) {
      return Promise.resolve();
    }

    await apiClient.patch(`/superadmin/restaurants/${id}/plan`, { plan });
  },

  async deleteRestaurant(id: string): Promise<void> {
    if (USE_PLACEHOLDER_RESTAURANT_REQUESTS) {
      return Promise.resolve();
    }

    await apiClient.delete(`/superadmin/restaurants/${id}`);
  },

  async registerRestaurant(data: any): Promise<any> {
    const payload = {
      ...data,
      restaurantName: data.name,
      ownerName: data.owner,
    };
    delete payload.name;
    delete payload.owner;

    const response = await apiClient.post<{ success: boolean; data: any }>(
      "/superadmin/restaurants",
      payload
    );
    return response.data.data;
  },

  async getTransactions(): Promise<Transaction[]> {
    const response = await apiClient.get<{ success: boolean; data: { transactions: Transaction[] } }>(
      "/superadmin/transactions"
    );
    return response.data.data.transactions;
  },

  async getAnalyticsOrders(): Promise<{ orders: PlatformOrder[]; commissionRate: number }> {
    const response = await apiClient.get<{ success: boolean; data: { orders: PlatformOrder[]; commissionRate: number } }>(
      "/superadmin/analytics/orders"
    );
    return response.data.data;
  },

  async getReservationQueueAnalytics(): Promise<any> {
    const response = await apiClient.get<{ success: boolean; data: any }>(
      "/superadmin/analytics/reservation-queue"
    );
    return response.data.data;
  },

  async getAnalyticsCharts(): Promise<any> {
    const response = await apiClient.get<{ success: boolean; data: any }>(
      "/superadmin/analytics/charts"
    );
    return response.data.data;
  },

  async getAlerts(): Promise<any[]> {
    const response = await apiClient.get<{ success: boolean; data: any[] }>("/superadmin/alerts");
    return response.data.data;
  },

  async updateAlertStatus(id: string, status: string): Promise<any> {
    const response = await apiClient.patch<{ success: boolean; data: any }>(`/superadmin/alerts/${id}`, { status });
    return response.data.data;
  },

  async deleteAlert(id: string): Promise<void> {
    await apiClient.delete(`/superadmin/alerts/${id}`);
  },
};
