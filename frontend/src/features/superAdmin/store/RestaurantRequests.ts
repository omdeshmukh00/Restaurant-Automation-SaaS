import { create } from "zustand";
import {
  placeholderRestaurantRequests,
  superAdminRestaurantRequestsApi,
} from "../api/superAdmin.api";
import { apiClient } from "../../../shared/services/apiClient";
import type { RestaurantsRow } from "../components/Restaurants/Restauranttypes";

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
  fetchRequests: () => Promise<void>;
  fetchRestaurants: () => Promise<void>;
  approveRequest: (id: string) => Promise<void>;
  denyRequest: (id: string, reason: string, refund?: boolean) => Promise<void>;
  addRestaurant: (restaurant: RestaurantsRow) => Promise<void>;
  updateRestaurantStatus: (
    id: string,
    status: "Active" | "Trial" | "Inactive"
  ) => Promise<void>;
  updateRestaurantPlan: (
    id: string,
    plan: "Premium" | "Standard" | "Basic" | "Free"
  ) => void;
  deleteRestaurant: (id: string) => Promise<void>;
}

const requestToRestaurant = (request: RestaurantRequest): RestaurantsRow => ({
  id: `RST-${request.id.slice(-6)}`,
  name: request.name,
  owner: request.owner,
  email: request.email,
  phone: request.phone,
  location: request.location,
  plan: request.plan as any,
  status: "Active",
  revenue: "Rs. 0",
  branches: 1,
});

export const useRestaurantRequestsStore = create<RestaurantRequestsState>()(
  (set, get) => ({
    restaurants: [],
    requests: [],
    fetchRequests: async () => {
      try {
        const reqs = await superAdminRestaurantRequestsApi.getRequests();
        set({ requests: reqs });
      } catch (error) {
        console.error("Failed to fetch requests", error);
      }
    },
    fetchRestaurants: async () => {
      try {
        const response = await apiClient.get('/superadmin/restaurants');
        const items = response.data?.data?.restaurants || [];
        const mapped = items.map((r: any) => ({
          id: r._id || r.id,
          name: r.name,
          owner: r.ownerName || 'Unknown',
          email: r.email || '',
          phone: r.phone || '',
          location: `${r.city || 'Mumbai'}, ${r.state || 'Maharashtra'}`,
          plan: r.plan === 'STARTER' ? 'Basic' : r.plan === 'PRO' ? 'Standard' : 'Premium',
          status: r.status === 'ACTIVE' ? 'Active' : r.status === 'TRIAL' ? 'Trial' : 'Inactive',
          revenue: `₹${((r.expectedMonthlyOrders || 0) * 125).toLocaleString('en-IN')}`,
          branches: r.branches || 1,
        }));
        set({ restaurants: mapped });
      } catch (error) {
        console.error("Failed to fetch restaurants", error);
      }
    },
    approveRequest: async (id) => {
      try {
        const request = get().requests.find((item) => item.id === id);
        if (!request) return;

        await superAdminRestaurantRequestsApi.approveRequest(id);

        const restaurant = requestToRestaurant(request);
        const alreadyAdded = get().restaurants.some(
          (item) => item.name === restaurant.name
        );

        set((state) => ({
          restaurants: alreadyAdded
            ? state.restaurants
            : [restaurant, ...state.restaurants],
          requests: state.requests.map((item) =>
            item.id === id ? { ...item, status: 'APPLICATION_APPROVED' } : item
          ),
        }));
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
    addRestaurant: async (restaurant) => {
      try {
        const response = await apiClient.post('/superadmin/restaurants', {
          name: restaurant.name,
          owner: restaurant.owner,
          email: restaurant.email,
          phone: restaurant.phone,
          location: restaurant.location,
          plan: restaurant.plan,
          status: restaurant.status,
          branches: restaurant.branches,
          revenue: restaurant.revenue,
        });
        const created = response.data?.data;
        if (created) {
          set((state) => ({
            restaurants: [
              {
                id: created.id,
                name: created.name,
                owner: created.owner,
                email: created.email,
                phone: created.phone,
                location: created.location,
                plan: created.plan,
                status: created.status,
                revenue: created.revenue,
                branches: created.branches,
              },
              ...state.restaurants,
            ],
          }));
        }
      } catch (error) {
        console.error("Failed to add restaurant", error);
        throw error;
      }
    },
    updateRestaurantStatus: async (id, status) => {
      try {
        if (status === 'Active') {
          await apiClient.patch(`/superadmin/restaurants/${id}/approve`);
        } else {
          await apiClient.patch(`/superadmin/restaurants/${id}/suspend`);
        }
        set((state) => ({
          restaurants: state.restaurants.map((restaurant) =>
            restaurant.id === id ? { ...restaurant, status } : restaurant
          ),
        }));
      } catch (error) {
        console.error("Failed to update status", error);
      }
    },
    updateRestaurantPlan: (id, plan) =>
      set((state) => ({
        restaurants: state.restaurants.map((restaurant) =>
          restaurant.id === id ? { ...restaurant, plan: plan as any } : restaurant
        ),
      })),
    deleteRestaurant: async (id) => {
      try {
        await apiClient.delete(`/superadmin/restaurants/${id}`);
        set((state) => ({
          restaurants: state.restaurants.filter((restaurant) => restaurant.id !== id),
        }));
      } catch (err) {
        console.error("Failed to delete restaurant", err);
      }
    },
  })
);
