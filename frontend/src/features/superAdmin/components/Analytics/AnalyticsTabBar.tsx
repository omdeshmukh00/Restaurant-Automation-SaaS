// src/features/superAdmin/components/Analytics/AnalyticsTabBar.tsx
import React from "react";
import { BarChart3, CalendarClock } from "lucide-react";

export type AnalyticsTab = "revenue" | "reservations";

interface AnalyticsTabBarProps {
  darkMode: boolean;
  activeTab: AnalyticsTab;
  onTabChange: (tab: AnalyticsTab) => void;
}

const tabs: { key: AnalyticsTab; label: string; icon: typeof BarChart3 }[] = [
  { key: "revenue", label: "Revenue & Orders", icon: BarChart3 },
  { key: "reservations", label: "Reservation & Queue", icon: CalendarClock },
];

export default function AnalyticsTabBar({ darkMode, activeTab, onTabChange }: AnalyticsTabBarProps) {
  return (
    <div
      className={`flex gap-1 p-1 rounded-xl w-fit transition-colors duration-200 ${
        darkMode ? "bg-slate-900 border border-slate-800" : "bg-slate-100 border border-slate-200"
      }`}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTabChange(tab.key)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${
              isActive
                ? darkMode
                  ? "bg-orange-600/20 text-orange-400 shadow-sm"
                  : "bg-white text-orange-600 shadow-sm"
                : darkMode
                ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                : "text-slate-500 hover:text-slate-700 hover:bg-white/60"
            }`}
          >
            <Icon size={14} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
