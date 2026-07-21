import React, { useState } from 'react';
import { CreditCard, Sparkles } from 'lucide-react';
import { useSettingsStore } from '../../store/settings.store';
import { AdminSubscriptionCheckoutModal } from './AdminSubscriptionCheckoutModal';

export function BillingCard(): JSX.Element {
  const { billing, fetchSettings } = useSettingsStore();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const status = (billing.status || 'free').toLowerCase();
  const statusLabel = status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');
  const statusStyles: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    cancelled: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
    past_due: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    suspended: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    expired: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
    free: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 sm:p-6">
      <h3 className="text-base font-bold text-gray-800 dark:text-gray-100 mb-5">Billing & Subscription</h3>

      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
        {/* Icon */}
        <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900 flex items-center justify-center flex-shrink-0">
          <CreditCard className="w-6 h-6 text-purple-500 dark:text-purple-400" />
        </div>

        {/* Grid */}
        <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          <Field label="Current Plan">
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{billing.plan}</p>
          </Field>
          <Field label="Status">
            <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${statusStyles[status] ?? statusStyles.free}`}>
              {statusLabel}
            </span>
          </Field>
          <Field label="Billing Cycle">
            <p className="text-sm text-gray-700 dark:text-gray-300 capitalize">{billing.cycle}</p>
          </Field>
          <Field label="Next Billing Date">
            <p className="text-sm text-gray-700 dark:text-gray-300">{billing.nextBillingDate}</p>
          </Field>
          <Field label="Amount">
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{billing.amount}</p>
          </Field>
          <Field label="Payment Method">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-xs font-bold bg-blue-600 text-white rounded">{billing.paymentMethod}</span>
            </div>
          </Field>

          {/* Change plan button */}
          <div className="sm:col-span-2 mt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
            <div>
              <p className="text-xs font-bold text-gray-700 dark:text-gray-300">Upgrade or Switch Plan</p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500">View all available subscription tiers and feature quotas.</p>
            </div>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="px-6 py-2.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-full transition-all shadow-md shadow-purple-500/20 flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Sparkles size={14} className="shrink-0" />
              <span>Update Plan</span>
            </button>
          </div>
        </div>
      </div>

      <AdminSubscriptionCheckoutModal
        isOpen={isModalOpen}
        currentPlanName={billing.plan}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => fetchSettings()}
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">{label}</p>
      {children}
    </div>
  );
}
