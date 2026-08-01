import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Sparkles,
  Building2,
  ArrowUpDown,
  Users,
  RefreshCw,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronDown,
  ChevronUp,
  Wallet,
  Banknote,
  DollarSign,
  Save,
  AlertCircle,
} from 'lucide-react';
import { useSettingsStore } from '../../store/settings.store';
import { useStaffStore } from '../../store/staff.store';
import { AdminSubscriptionCheckoutModal } from './AdminSubscriptionCheckoutModal';

// ── Sub-tab type ───────────────────────────────────────────────────────
type BillingTab = 'overview' | 'bank' | 'settlements' | 'salary';

const TABS: { id: BillingTab; label: string; icon: React.ComponentType<any> }[] = [
  { id: 'overview', label: 'Subscription', icon: CreditCard },
  { id: 'bank', label: 'Bank Details', icon: Building2 },
  { id: 'settlements', label: 'Settlements', icon: ArrowUpDown },
  { id: 'salary', label: 'Salary', icon: Users },
];

// ── Main Component ─────────────────────────────────────────────────────
export function BillingSettlementCard(): JSX.Element {
  const [activeTab, setActiveTab] = useState<BillingTab>('overview');
  const { fetchBillingData } = useSettingsStore();

  useEffect(() => {
    fetchBillingData();
  }, [fetchBillingData]);

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex-1 justify-center ${
              activeTab === id
                ? 'bg-white dark:bg-gray-900 text-purple-600 dark:text-purple-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 sm:p-6">
        {activeTab === 'overview' && <SubscriptionOverview />}
        {activeTab === 'bank' && <BankDetailsForm />}
        {activeTab === 'settlements' && <SettlementsSummary />}
        {activeTab === 'salary' && <SalaryPaymentSection />}
      </div>
    </div>
  );
}

// ── Subscription Overview ──────────────────────────────────────────────
function SubscriptionOverview(): JSX.Element {
  const { billing, fetchSettings, autoRenew, toggleAutoRenew } = useSettingsStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toggling, setToggling] = useState(false);

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

  const handleToggle = async () => {
    setToggling(true);
    try {
      await toggleAutoRenew(!autoRenew);
    } finally {
      setToggling(false);
    }
  };

  return (
    <>
      <h3 className="text-base font-bold text-gray-800 dark:text-gray-100 mb-5 flex items-center gap-2">
        <CreditCard className="w-5 h-5 text-purple-500" />
        Billing & Subscription
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 mb-6">
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
          <span className="px-2 py-0.5 text-xs font-bold bg-blue-600 text-white rounded">{billing.paymentMethod}</span>
        </Field>
      </div>

      {/* Auto-Renewal Toggle */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700 mb-4">
        <div>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-purple-500" />
            Auto-Renewal
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Automatically renew subscription when billing period ends
          </p>
        </div>
        <button
          onClick={handleToggle}
          disabled={toggling}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${
            autoRenew ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-600'
          } ${toggling ? 'opacity-50' : ''}`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
              autoRenew ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Upgrade Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
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

      <AdminSubscriptionCheckoutModal
        isOpen={isModalOpen}
        currentPlanName={billing.plan}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => fetchSettings()}
      />
    </>
  );
}

// ── Bank Details Form ──────────────────────────────────────────────────
function BankDetailsForm(): JSX.Element {
  const { bankDetails, updateBankDetails } = useSettingsStore();
  const [form, setForm] = useState({
    accountHolderName: bankDetails?.accountHolderName || '',
    accountNumber: bankDetails?.accountNumber || '',
    ifscCode: bankDetails?.ifscCode || '',
    bankName: bankDetails?.bankName || '',
    branch: bankDetails?.branch || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [detectingIfsc, setDetectingIfsc] = useState(false);
  const [ifscSuccess, setIfscSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (bankDetails) {
      setForm({
        accountHolderName: bankDetails.accountHolderName || '',
        accountNumber: bankDetails.accountNumber || '',
        ifscCode: bankDetails.ifscCode || '',
        bankName: bankDetails.bankName || '',
        branch: bankDetails.branch || '',
      });
    }
  }, [bankDetails]);

  const handleIfscChange = (val: string) => {
    const code = val.toUpperCase().trim();
    setForm((p) => ({ ...p, ifscCode: code }));
    setIfscSuccess(null);

    if (code.length === 11 && /^[A-Z]{4}0[A-Z0-9]{6}$/.test(code)) {
      detectIfsc(code);
    }
  };

  const detectIfsc = async (code: string) => {
    setDetectingIfsc(true);
    try {
      const res = await fetch(`https://ifsc.razorpay.com/${code}`);
      if (res.ok) {
        const data = await res.json();
        const detectedBank = data.BANK || '';
        const detectedBranch = data.BRANCH ? `${data.BRANCH}${data.CITY ? `, ${data.CITY}` : ''}` : '';
        setForm((p) => ({
          ...p,
          bankName: detectedBank || p.bankName,
          branch: detectedBranch || p.branch,
        }));
        setIfscSuccess(`Auto-detected: ${detectedBank} ${detectedBranch ? `(${detectedBranch})` : ''}`);
      }
    } catch {
      // User can manually fill if lookup fails
    } finally {
      setDetectingIfsc(false);
    }
  };

  const handleSave = async () => {
    setError('');
    if (!form.accountHolderName || !form.accountNumber || !form.ifscCode || !form.bankName) {
      setError('Please fill in all required fields');
      return;
    }
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.ifscCode.toUpperCase())) {
      setError('Invalid IFSC code format (e.g. SBIN0001234)');
      return;
    }

    setSaving(true);
    try {
      await updateBankDetails({ ...form, ifscCode: form.ifscCode.toUpperCase() });
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to save bank details');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <h3 className="text-base font-bold text-gray-800 dark:text-gray-100 mb-1 flex items-center gap-2">
        <Building2 className="w-5 h-5 text-purple-500" />
        Bank Account Details
      </h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
        Add your bank account details for settlement payouts
      </p>

      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800">
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
          <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        <InputField
          label="Account Holder Name *"
          value={form.accountHolderName}
          onChange={(v) => setForm((p) => ({ ...p, accountHolderName: v }))}
          placeholder="e.g. Restaurant Pvt Ltd"
        />
        <InputField
          label="Account Number *"
          value={form.accountNumber}
          onChange={(v) => setForm((p) => ({ ...p, accountNumber: v }))}
          placeholder="e.g. 1234567890123"
        />
        <div>
          <InputField
            label="IFSC Code *"
            value={form.ifscCode}
            onChange={handleIfscChange}
            placeholder="e.g. SBIN0001234"
            maxLength={11}
          />
          {detectingIfsc && (
            <p className="text-[11px] text-purple-500 dark:text-purple-400 mt-1 flex items-center gap-1">
              <RefreshCw className="w-3 h-3 animate-spin" />
              Detecting bank name & branch...
            </p>
          )}
          {ifscSuccess && !detectingIfsc && (
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1 font-medium">
              <CheckCircle2 className="w-3 h-3" />
              {ifscSuccess}
            </p>
          )}
        </div>
        <InputField
          label="Bank Name *"
          value={form.bankName}
          onChange={(v) => setForm((p) => ({ ...p, bankName: v }))}
          placeholder="e.g. State Bank of India"
        />
        <InputField
          label="Branch (Optional)"
          value={form.branch}
          onChange={(v) => setForm((p) => ({ ...p, branch: v }))}
          placeholder="e.g. MG Road Branch"
        />
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="px-6 py-2.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-full transition-all shadow-md shadow-purple-500/20 flex items-center gap-2 cursor-pointer"
      >
        <Save className="w-3.5 h-3.5" />
        {saving ? 'Saving...' : 'Save Bank Details'}
      </button>
    </>
  );
}

// ── Settlements Summary ────────────────────────────────────────────────
function SettlementsSummary(): JSX.Element {
  const { settlements, settlementSummary, billingLoading } = useSettingsStore();
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <h3 className="text-base font-bold text-gray-800 dark:text-gray-100 mb-5 flex items-center gap-2">
        <ArrowUpDown className="w-5 h-5 text-purple-500" />
        Settlements & Transactions
      </h3>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <SummaryCard
          label="Pending Settlements"
          value={settlementSummary?.pendingSettlements ?? 0}
          icon={Clock}
          color="amber"
        />
        <SummaryCard
          label="Completed Settlements"
          value={settlementSummary?.completedSettlements ?? 0}
          icon={CheckCircle2}
          color="emerald"
        />
        <SummaryCard
          label="Total Net Settlement"
          value={`₹${(settlementSummary?.totalNetSettlement ?? 0).toLocaleString('en-IN')}`}
          icon={Wallet}
          color="purple"
        />
      </div>

      {/* Settlement List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">Recent Settlements</p>
          {settlements.length > 3 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs font-medium text-purple-500 hover:text-purple-600 flex items-center gap-1 cursor-pointer"
            >
              {expanded ? 'Show Less' : 'Show All'}
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}
        </div>

        {billingLoading && (
          <div className="text-center py-8 text-sm text-gray-400">Loading settlements...</div>
        )}

        {!billingLoading && settlements.length === 0 && (
          <div className="text-center py-8">
            <ArrowUpDown className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-400 dark:text-gray-500">No settlements yet</p>
          </div>
        )}

        {(expanded ? settlements : settlements.slice(0, 3)).map((s) => (
          <div
            key={s._id}
            className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700"
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-800 dark:text-gray-100 truncate">
                {new Date(s.settlementPeriod.from).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                {' - '}
                {new Date(s.settlementPeriod.to).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                Gross: ₹{s.grossSales.toLocaleString('en-IN')} · Commission: ₹{s.platformCommission.toLocaleString('en-IN')}
              </p>
            </div>
            <div className="text-right ml-3">
              <p className="text-sm font-bold text-gray-800 dark:text-gray-100">
                ₹{s.netSettlement.toLocaleString('en-IN')}
              </p>
              <StatusBadge status={s.status} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ── Salary Payment Section ─────────────────────────────────────────────
function SalaryPaymentSection(): JSX.Element {
  const { salaryHistory, paySalary, payAllSalaries, billingLoading, fetchBillingData } = useSettingsStore();
  const { members, fetchMembers } = useStaffStore();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [paying, setPaying] = useState<string | null>(null);
  const [payingAll, setPayingAll] = useState(false);

  useEffect(() => {
    if (!members || members.length === 0) fetchMembers();
  }, [members, fetchMembers]);

  const staffWithSalary = (members || []).filter((m: any) => (m.salary || 0) > 0);

  const isPaidThisMonth = (staffId: string) => {
    return salaryHistory.some(
      (s) => s.staffId === staffId && s.month === selectedMonth && s.year === selectedYear && s.status === 'PAID'
    );
  };

  const handlePaySingle = async (staffId: string) => {
    setPaying(staffId);
    try {
      await paySalary(staffId, selectedMonth, selectedYear);
    } finally {
      setPaying(null);
    }
  };

  const handlePayAll = async () => {
    setPayingAll(true);
    try {
      await payAllSalaries(selectedMonth, selectedYear);
    } finally {
      setPayingAll(false);
    }
  };

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  return (
    <>
      <h3 className="text-base font-bold text-gray-800 dark:text-gray-100 mb-1 flex items-center gap-2">
        <Users className="w-5 h-5 text-purple-500" />
        Salary Payments
      </h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
        Pay salaries to your staff members
      </p>

      {/* Month/Year Selector */}
      <div className="flex items-center gap-3 mb-5">
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(Number(e.target.value))}
          className="px-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
        >
          {months.map((m, i) => (
            <option key={i} value={i + 1}>{m}</option>
          ))}
        </select>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="px-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
        >
          {[2025, 2026, 2027].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <button
          onClick={handlePayAll}
          disabled={payingAll || staffWithSalary.length === 0}
          className="ml-auto px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg transition-all flex items-center gap-2 cursor-pointer"
        >
          <Banknote className="w-3.5 h-3.5" />
          {payingAll ? 'Paying...' : 'Pay All'}
        </button>
      </div>

      {/* Staff List */}
      {staffWithSalary.length === 0 && (
        <div className="text-center py-8">
          <Users className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
          <p className="text-sm text-gray-400 dark:text-gray-500">No staff with salary configured</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Set salary amounts in Staff Management</p>
        </div>
      )}

      <div className="space-y-2">
        {staffWithSalary.map((member: any) => {
          const paid = isPaidThisMonth(member.id || member._id);
          return (
            <div
              key={member.id || member._id}
              className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center text-xs font-bold text-purple-600 dark:text-purple-400 shrink-0">
                  {(member.name || '?')[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-100 truncate">{member.name}</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">{member.role}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 ml-3">
                <p className="text-sm font-bold text-gray-800 dark:text-gray-100 whitespace-nowrap">
                  ₹{(member.salary || 0).toLocaleString('en-IN')}
                </p>
                {paid ? (
                  <span className="px-2.5 py-1 text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Paid
                  </span>
                ) : (
                  <button
                    onClick={() => handlePaySingle(member.id || member._id)}
                    disabled={paying === (member.id || member._id)}
                    className="px-3 py-1.5 text-[10px] font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg transition-all cursor-pointer"
                  >
                    {paying === (member.id || member._id) ? 'Paying...' : 'Pay'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Salary History */}
      {salaryHistory.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-3">Recent Salary Payments</p>
          <div className="space-y-2">
            {salaryHistory.slice(0, 5).map((record) => (
              <div
                key={record._id}
                className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-700/50"
              >
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{record.staffName}</p>
                  <p className="text-[10px] text-gray-400">
                    {months[record.month - 1]} {record.year} · {record.paymentMethod}
                  </p>
                </div>
                <div className="text-right ml-2">
                  <p className="text-xs font-bold text-gray-800 dark:text-gray-100">
                    ₹{record.amount.toLocaleString('en-IN')}
                  </p>
                  <StatusBadge status={record.status} size="sm" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ── Helper Components ──────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">{label}</p>
      {children}
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="w-full px-3 py-2.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-all"
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<any>;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    amber: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400',
    emerald: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400',
    purple: 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400',
  };

  return (
    <div className={`p-3 rounded-xl border ${colorClasses[color] || colorClasses.purple}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4" />
        <p className="text-[11px] font-medium opacity-80">{label}</p>
      </div>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}

function StatusBadge({ status, size = 'md' }: { status: string; size?: 'sm' | 'md' }) {
  const s = status.toUpperCase();
  const base = size === 'sm' ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-0.5';

  if (s === 'PAID' || s === 'COMPLETED') {
    return <span className={`${base} font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 rounded-full`}>{s}</span>;
  }
  if (s === 'PENDING' || s === 'GENERATED') {
    return <span className={`${base} font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 rounded-full`}>{s}</span>;
  }
  if (s === 'FAILED') {
    return <span className={`${base} font-bold bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 rounded-full`}>{s}</span>;
  }
  return <span className={`${base} font-bold bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 rounded-full`}>{s}</span>;
}
