// src/features/superAdmin/store/Analytics.ts
import {
  BarChart3,
  Utensils,
  IndianRupee,
  TrendingUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MetricItem {
  label: string;
  current: string;
  shift: string;
  icon: LucideIcon;
  darkBg: string;
  lightBg: string;
}

export interface BarSeriesItem {
  period: string;
  load: number;
  capacity: number;
}

export interface DistributionItem {
  division: string;
  allocation: number;
  Hex: string;
}

export type OrderStatus = "Settled" | "Processing" | "Disputed";

export interface PlatformOrder {
  id: string;
  restaurant: string;
  type: string;
  grossAmount: number;
  commission: number;
  commissionRate?: number;
  status: OrderStatus;
  timestamp: string;
}

// ─── Static Data ─────────────────────────────────────────────────────────────

export const metricsData: MetricItem[] = [
  {
    label: "Active Clusters",
    current: "0",
    shift: "-",
    icon: BarChart3,
    darkBg: "bg-blue-500/10 text-blue-400",
    lightBg: "bg-blue-50 text-blue-600",
  },
  {
    label: "Total Restaurants",
    current: "0",
    shift: "-",
    icon: Utensils,
    darkBg: "bg-orange-500/10 text-orange-400",
    lightBg: "bg-orange-50 text-orange-600",
  },
  {
    label: "Revenue Today",
    current: "₹0",
    shift: "-",
    icon: IndianRupee,
    darkBg: "bg-emerald-500/10 text-emerald-400",
    lightBg: "bg-emerald-50 text-emerald-600",
  },
  {
    label: "Uptime",
    current: "-",
    shift: "-",
    icon: TrendingUp,
    darkBg: "bg-purple-500/10 text-purple-400",
    lightBg: "bg-purple-50 text-purple-600",
  },
];

export const barSeries: BarSeriesItem[] = [];

export const distributionSeries: DistributionItem[] = [];
