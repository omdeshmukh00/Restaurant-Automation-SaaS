// src/features/admin/components/dashboard/UpgradePrompt.tsx
import React, { useState } from "react";
import { AlertTriangle, ArrowRight, ShieldAlert, Sparkles, X } from "lucide-react";

interface QuotaItem {
  key: string;
  label: string;
  used: number;
  limit: number | null;
  percent: number;
}

interface UpgradePromptProps {
  status: string;
  quotas: QuotaItem[];
}

export function UpgradePrompt({ status, quotas }: UpgradePromptProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  // 1. Subscription Expired / Past Due Alert
  const isPastDue = status === "past_due";
  const isExpired = status === "expired" || status === "inactive";

  if (isExpired || isPastDue) {
    return (
      <div className="bg-red-50 dark:bg-red-500/10 border-l-4 border-red-500 p-4 rounded-xl flex items-start gap-3 relative shadow-sm">
        <div className="w-8 h-8 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center flex-shrink-0">
          <ShieldAlert size={18} />
        </div>
        <div className="flex-1 pr-6">
          <h4 className="text-xs sm:text-sm font-bold text-red-900 dark:text-red-300">
            Subscription Expired / Inactive
          </h4>
          <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">
            Your restaurant plan is currently inactive. Renew your subscription to restore full access to orders, tables, and staff management.
          </p>
          <a
            href="/admin/settings?tab=subscription"
            className="inline-flex items-center gap-1.5 mt-2.5 text-xs font-bold text-red-600 dark:text-red-400 hover:opacity-80"
          >
            Renew Subscription <ArrowRight size={13} />
          </a>
        </div>
      </div>
    );
  }

  // 2. Limit Reached Alert (100%+)
  const exceededQuotas = quotas.filter((q) => q.limit !== null && q.used >= q.limit);
  if (exceededQuotas.length > 0) {
    const labels = exceededQuotas.map((q) => q.label).join(", ");
    return (
      <div className="bg-red-50 dark:bg-red-500/10 border-l-4 border-red-500 p-4 rounded-xl flex items-start gap-3 relative shadow-sm">
        <div className="w-8 h-8 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center flex-shrink-0">
          <ShieldAlert size={18} />
        </div>
        <div className="flex-1 pr-6">
          <h4 className="text-xs sm:text-sm font-bold text-red-900 dark:text-red-300">
            Plan Limit Exceeded
          </h4>
          <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">
            You have reached the maximum allowed limit for: <strong>{labels}</strong>. Creating new records is currently blocked.
          </p>
          <a
            href="/admin/settings?tab=subscription"
            className="inline-flex items-center gap-1.5 mt-2.5 text-xs font-bold text-red-600 dark:text-red-400 hover:opacity-80"
          >
            Upgrade Plan <ArrowRight size={13} />
          </a>
        </div>
      </div>
    );
  }

  // 3. Limit Warning Alert (80%+)
  const warningQuotas = quotas.filter((q) => q.limit !== null && q.percent >= 80 && q.used < q.limit);
  if (warningQuotas.length > 0) {
    const labels = warningQuotas.map((q) => q.label).join(", ");
    return (
      <div className="bg-amber-50 dark:bg-amber-500/10 border-l-4 border-amber-500 p-4 rounded-xl flex items-start gap-3 relative shadow-sm">
        <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
          <AlertTriangle size={18} />
        </div>
        <div className="flex-1 pr-6">
          <h4 className="text-xs sm:text-sm font-bold text-amber-900 dark:text-amber-300">
            Approaching Quota Limits
          </h4>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
            You've used over 80% of your allowed quota for: <strong>{labels}</strong>. Upgrade your plan now to prevent any service interruptions.
          </p>
          <a
            href="/admin/settings?tab=subscription"
            className="inline-flex items-center gap-1.5 mt-2.5 text-xs font-bold text-amber-600 dark:text-amber-400 hover:opacity-80"
          >
            Upgrade Plan <ArrowRight size={13} />
          </a>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="absolute right-3 top-3 text-amber-500 dark:text-amber-400 hover:opacity-80 p-0.5"
          aria-label="Dismiss warning"
        >
          <X size={15} />
        </button>
      </div>
    );
  }

  // 4. Healthy / No warnings
  return null;
}
