import React from 'react';
import { CreditCard } from 'lucide-react';
import { useSettingsStore } from '../../store/settings.store';

const PLAN_OPTIONS = ['Free', 'Standard', 'Premium', 'Enterprise'];

export function BillingCard(): JSX.Element {
  const { billing, changePlan } = useSettingsStore();
  const [plan, setPlan] = React.useState(billing.plan);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setPlan(billing.plan);
  }, [billing.plan]);

  async function handleChangePlan(e: React.FormEvent) {
    e.preventDefault();
    if (plan === billing.plan) return;
    setSaving(true);
    try {
      await changePlan(plan);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 sm:p-6">
      <h3 className="text-base font-bold text-gray-800 dark:text-gray-100 mb-5">Billing &amp; Subscription</h3>

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
          <div className="hidden sm:block" /> {/* spacer */}
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
              <span className="text-sm text-gray-600 dark:text-gray-400">•••• {billing.cardLast4}</span>
            </div>
          </Field>

          {/* Change plan */}
          <div className="sm:col-span-2 mt-1">
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Change Plan</p>
            <form onSubmit={handleChangePlan} className="flex items-end gap-2">
              <select
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {PLAN_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <button
                type="submit"
                disabled={saving || plan === billing.plan}
                className="px-4 py-2 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition-colors disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Update Plan'}
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <button className="w-full sm:w-auto px-4 py-2 text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-xl transition-colors">
          Manage Billing
        </button>
      </div>
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
