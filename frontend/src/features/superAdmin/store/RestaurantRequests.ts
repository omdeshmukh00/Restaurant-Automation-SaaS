import { create } from "zustand";
import {
  placeholderRestaurantRequests,
  superAdminRestaurantRequestsApi,
} from "../api/superAdmin.api";
import { restaurantData } from "./Restaurants";
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
  approveRequest: (id: string) => Promise<void>;
  denyRequest: (id: string, reason: string, refund?: boolean) => Promise<void>;
  addRestaurant: (restaurant: RestaurantsRow) => void;
  updateRestaurantStatus: (
    id: string,
    status: "Active" | "Trial" | "Inactive"
  ) => void;
  updateRestaurantPlan: (
    id: string,
    plan: "Premium" | "Standard" | "Basic" | "Free"
  ) => void;
  deleteRestaurant: (id: string) => void;
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
    restaurants: restaurantData,
    requests: [],
    fetchRequests: async () => {
      try {
        const reqs = await superAdminRestaurantRequestsApi.getRequests();
        set({ requests: reqs });
      } catch (error) {
        console.error("Failed to fetch requests", error);
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
    addRestaurant: (restaurant) =>
      set((state) => ({ restaurants: [restaurant, ...state.restaurants] })),
    updateRestaurantStatus: (id, status) =>
      set((state) => ({
        restaurants: state.restaurants.map((restaurant) =>
          restaurant.id === id ? { ...restaurant, status } : restaurant
        ),
      })),
    updateRestaurantPlan: (id, plan) =>
      set((state) => ({
        restaurants: state.restaurants.map((restaurant) =>
          restaurant.id === id ? { ...restaurant, plan: plan as any } : restaurant
        ),
      })),
    deleteRestaurant: (id) =>
      set((state) => ({
        restaurants: state.restaurants.filter((restaurant) => restaurant.id !== id),
      })),
  })
);
