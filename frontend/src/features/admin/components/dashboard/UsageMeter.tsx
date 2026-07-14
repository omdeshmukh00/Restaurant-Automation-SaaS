// src/features/admin/components/dashboard/UsageMeter.tsx
import React from "react";
import { SlidersHorizontal } from "lucide-react";

interface QuotaItem {
  key: string;
  label: string;
  used: number;
  limit: number | null;
  percent: number;
}

interface UsageMeterProps {
  planName: string;
  quotas: QuotaItem[];
}

export function UsageMeter({ planName, quotas }: UsageMeterProps) {
  const getProgressBarColor = (percent: number) => {
    if (percent >= 100) return "bg-red-500";
    if (percent >= 80) return "bg-orange-500";
    if (percent >= 50) return "bg-amber-500";
    return "bg-emerald-500";
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center">
            <SlidersHorizontal size={16} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Plan Quota Usage</h3>
            <p className="text-[10px] text-gray-400">Current period usage tracker</p>
          </div>
        </div>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider bg-orange-500/10 text-orange-500 uppercase">
          {planName} Plan
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {quotas.map((quota) => {
          const hasLimit = quota.limit !== null;
          return (
            <div key={quota.key} className="space-y-1.5 p-3 rounded-xl border border-gray-50/50 dark:border-gray-800/40 bg-gray-50/30 dark:bg-gray-800/10">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-gray-700 dark:text-gray-300">{quota.label}</span>
                <span className="text-gray-500 dark:text-gray-400 font-mono">
                  {quota.used} / {hasLimit ? quota.limit : "∞"}
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${getProgressBarColor(quota.percent)}`}
                  style={{ width: `${hasLimit ? quota.percent : 100}%`, opacity: hasLimit ? 1 : 0.4 }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
