// types/RestaurantTypes.ts

export type StatusFilter = "All" | "Active" | "Trial" | "Inactive";

export interface RestaurantsRow {
  id: string;
  name: string;
  owner: string;
  email: string;
  phone: string;
  location: string;
  plan: string;
  status: "Active" | "Trial" | "Inactive";
  revenue: string;
  branches: number;
  joinedDate?: string;
  lastActive?: string;
  tags?: string[];
  cooldownRemaining?: number;
}

export interface NewRestaurantForm {
  name: string;
  owner: string;
  email: string;
  phone: string;
  location: string;
  plan: string;
  status: "Active" | "Trial" | "Inactive";
  revenue: string;
  branches: number;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pinCode?: string;
  gstNumber?: string;
  cuisine?: string;
  expectedMonthlyOrders?: number;
  latitude?: number | null;
  longitude?: number | null;
  googleMapsUrl?: string;
  message?: string;
}