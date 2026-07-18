// types/SubscriptionTypes.ts

export type PlanType = string;
export type StatusType = "Active" | "Trial" | "Inactive";
export type TierFilter = "All" | PlanType;
export type StatusFilter = "All" | StatusType;
export type SortField = "name" | "revenue" | "branches" | "plan" | "status";
export type SortOrder = "asc" | "desc";

export interface RestaurantNode {
  id: string;
  name: string;
  owner: string;
  email: string;
  phone: string;
  location: string;
  plan: PlanType;
  status: StatusType;
  revenue: string; // stored as "$12,400"
  branches: number;
  mrr?: number;
  subscriptionPlan_id?: string | null;
  customCommissionRate?: number | null;
  joinedDate: string; // "2024-03-15"
  lastActive: string; // "2026-05-18"
  tags?: string[];
  cooldownRemaining?: number;
}

export interface NewRestaurantForm {
  name: string;
  owner: string;
  email: string;
  phone: string;
  location: string;
  plan: PlanType;
  status: StatusType;
  revenue: string;
  branches: number;
  tags: string;
}

export interface TierMetric {
  count: number;
  revenue: number;
  formattedRevenue: string;
  activeCount: number;
  trialCount: number;
}

export interface TierMetrics {
  basic: TierMetric;
  standard: TierMetric;
  premium: TierMetric;
  enterprise: TierMetric;
  totalRevenue: number;
  totalNodes: number;
}