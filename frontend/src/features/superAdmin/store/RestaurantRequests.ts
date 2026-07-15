import { create } from "zustand";
import {
  placeholderRestaurantRequests,
  superAdminRestaurantRequestsApi,
} from "../api/superAdmin.api";
import { restaurantData } from "./Restaurants";
import type { RestaurantsRow, NewRestaurantForm } from "../components/Restaurants/Restauranttypes";

export interface RestaurantRequest {
  id: string;
  name: string;
  owner: string;
  email: string;
  phone: string;
  location: string;
  plan: "Free" | "Standard" | "Premium" | "Enterprise";
  requestedAt: string;
  message: string;
  latitude?: number;
  longitude?: number;
  googleMapsUrl?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pinCode?: string;
  gstNumber?: string;
  cuisine?: string;
  branches?: number;
  expectedMonthlyOrders?: number;
  paymentId?: string;
  paymentAmount?: number;
  paymentStatus?: string;
  status?: string;
  rejectionReason?: string;
}

interface RestaurantRequestsState {
  restaurants: RestaurantsRow[];
  requests: RestaurantRequest[];
  plans: any[];
  fetchRequests: () => Promise<void>;
  approveRequest: (id: string) => Promise<void>;
  denyRequest: (id: string, reason: string, refund?: boolean) => Promise<void>;
  addRestaurant: (restaurant: NewRestaurantForm) => Promise<void>;
  updateRestaurantStatus: (
    id: string,
    status: "Active" | "Trial" | "Inactive",
    blockReason?: string
  ) => Promise<void>;
  updateRestaurantPlan: (
    id: string,
    plan: string
  ) => Promise<void>;
  deleteRestaurant: (id: string) => Promise<void>;
}

const mapDbRestaurantToRow = (r: any): RestaurantsRow => ({
  id: r._id || r.id,
  name: r.name,
  owner: r.ownerName || "Unknown",
  email: r.email || "",
  phone: r.phone || "",
  location: r.city ? `${r.city}, ${r.state || ""}, ${r.country || ""}`.replace(/,\s*,/g, ',').replace(/,\s*$/, '').trim() : "Unknown",
  plan: (r.plan || "Basic") as any,
  status: r.status === "ACTIVE" ? "Active" : r.status === "ONBOARDING" || r.status === "PENDING_APPROVAL" ? "Trial" : "Inactive",
  revenue: typeof r.revenue === 'number' ? `₹${r.revenue.toLocaleString('en-IN')}` : r.revenue || "₹0",
  branches: r.branches || 1,
  joinedDate: r.joinedDate ? new Date(r.joinedDate).toISOString().slice(0, 10) : r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
  lastActive: r.lastActive ? new Date(r.lastActive).toISOString().slice(0, 10) : r.updatedAt ? new Date(r.updatedAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
  tags: r.tags || [],
  cooldownRemaining: r.cooldownRemaining || 0,
});

export const useRestaurantRequestsStore = create<RestaurantRequestsState>()(
  (set, get) => ({
    restaurants: [],
    requests: [],
    plans: [],
    fetchRequests: async () => {
      try {
        const [reqs, dbRestaurants, dbPlans] = await Promise.all([
          superAdminRestaurantRequestsApi.getRequests(),
          superAdminRestaurantRequestsApi.getRestaurants(),
          superAdminRestaurantRequestsApi.getPlans(),
        ]);
        set({
          requests: reqs,
          restaurants: dbRestaurants.map(mapDbRestaurantToRow),
          plans: dbPlans || [],
        });
      } catch (error) {
        console.error("Failed to fetch requests", error);
      }
    },
    approveRequest: async (id) => {
      try {
        await superAdminRestaurantRequestsApi.approveRequest(id);
        // Refresh requests and restaurants from database
        const [reqs, dbRestaurants] = await Promise.all([
          superAdminRestaurantRequestsApi.getRequests(),
          superAdminRestaurantRequestsApi.getRestaurants(),
        ]);
        set({
          requests: reqs,
          restaurants: dbRestaurants.map(mapDbRestaurantToRow),
        });
      } catch (error) {
        console.error("Failed to approve request", error);
        throw error;
      }
    },
    denyRequest: async (id, reason, refund) => {
      try {
        await superAdminRestaurantRequestsApi.denyRequest(id, reason, refund);
        set((state) => ({
          requests: state.requests.map((item) =>
            item.id === id
              ? {
                  ...item,
                  status: 'REJECTED',
                  rejectionReason: reason,
                  paymentStatus: refund ? 'REFUNDED' : item.paymentStatus,
                }
              : item
          ),
        }));
      } catch (error) {
        console.error("Failed to deny request", error);
        throw error;
      }
    },
    addRestaurant: async (formData) => {
      try {
        await superAdminRestaurantRequestsApi.registerRestaurant(formData);
        const dbRestaurants = await superAdminRestaurantRequestsApi.getRestaurants();
        set({ restaurants: dbRestaurants.map(mapDbRestaurantToRow) });
      } catch (error: any) {
        console.error("Failed to add restaurant", error);
        throw error;
      }
    },
    updateRestaurantStatus: async (id, status, blockReason) => {
      try {
        await superAdminRestaurantRequestsApi.updateRestaurantStatus(id, status, blockReason);
        const dbRestaurants = await superAdminRestaurantRequestsApi.getRestaurants();
        set({ restaurants: dbRestaurants.map(mapDbRestaurantToRow) });
      } catch (error: any) {
        console.error("Failed to update restaurant status", error);
        const errMsg = error.response?.data?.error?.message || error.message || "Failed to update restaurant status";
        window.alert(errMsg);
      }
    },
    updateRestaurantPlan: async (id, plan) => {
      try {
        await superAdminRestaurantRequestsApi.updateRestaurantPlan(id, plan);
        const dbRestaurants = await superAdminRestaurantRequestsApi.getRestaurants();
        set({ restaurants: dbRestaurants.map(mapDbRestaurantToRow) });
      } catch (error: any) {
        console.error("Failed to update restaurant plan", error);
        const errMsg = error.response?.data?.error?.message || error.message || "Failed to update restaurant plan";
        window.alert(errMsg);
      }
    },
    deleteRestaurant: async (id) => {
      try {
        await superAdminRestaurantRequestsApi.deleteRestaurant(id);
        const dbRestaurants = await superAdminRestaurantRequestsApi.getRestaurants();
        set({ restaurants: dbRestaurants.map(mapDbRestaurantToRow) });
      } catch (error) {
        console.error("Failed to delete restaurant", error);
      }
    },
  })
);
