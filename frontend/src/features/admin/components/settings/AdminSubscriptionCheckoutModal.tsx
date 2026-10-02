import React, { useState, useEffect } from 'react';
import { CreditCard, Check, Sparkles, X, AlertCircle, Phone, Mail, User, ArrowRight, ShieldCheck } from 'lucide-react';
import { useSettingsStore } from '../../store/settings.store';
import { useAuth } from '../../../../auth/AuthProvider';
import { apiClient } from '../../../../shared/services/apiClient';
import { usePlatformSettingsGuard } from '../../../../shared/hooks/usePlatformSettingsGuard';

export interface PlanItem {
  _id?: string;
  id?: string;
  name: string;
  priceMonthly: number;
  priceYearly?: number;
  yearlyDiscountPercentage?: number;
  features?: string[];
  tableLimit?: number | null;
  dailyOrderLimit?: number | null;
  monthlyOrderLimit?: number | null;
  staffLimit?: number | null;
  inventoryLimit?: number | null;
}

const DEFAULT_PLANS: PlanItem[] = [
  {
    name: 'Free',
    priceMonthly: 0,
    priceYearly: 0,
    features: ['1 Table', '10 Daily Orders', '1 Staff Member', '10 Inventory Items'],
    tableLimit: 1,
    dailyOrderLimit: 10,
    staffLimit: 1,
    inventoryLimit: 10,
  },
  {
    name: 'Basic',
    priceMonthly: 499,
    priceYearly: 4790,
    features: ['5 Tables', '100 Daily Orders', '5 Staff Members', '100 Inventory Items', 'Basic Analytics'],
    tableLimit: 5,
    dailyOrderLimit: 100,
    staffLimit: 5,
    inventoryLimit: 100,
  },
  {
    name: 'Standard',
    priceMonthly: 999,
    priceYearly: 9590,
    features: ['15 Tables', '500 Daily Orders', '15 Staff Members', '500 Inventory Items', 'Advanced Analytics'],
    tableLimit: 15,
    dailyOrderLimit: 500,
    staffLimit: 15,
    inventoryLimit: 500,
  },
  {
    name: 'Premium',
    priceMonthly: 1999,
    priceYearly: 19190,
    features: ['Unlimited Tables', 'Unlimited Orders', 'Unlimited Staff', 'Unlimited Inventory', 'Priority Support'],
    tableLimit: null,
    dailyOrderLimit: null,
    staffLimit: null,
    inventoryLimit: null,
  },
];

const loadRazorpayScript = () =>
  new Promise<boolean>((resolve) => {
    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

interface AdminSubscriptionCheckoutModalProps {
  isOpen: boolean;
  currentPlanName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function AdminSubscriptionCheckoutModal({
  isOpen,
  currentPlanName,
  onClose,
  onSuccess,
}: AdminSubscriptionCheckoutModalProps) {
  const { user } = useAuth();
  const { admin, restaurant, fetchSettings } = useSettingsStore();

  const { settings: platformSettings } = usePlatformSettingsGuard();
  const platformName = platformSettings?.platformName || 'RestoHub';

  const [plans, setPlans] = useState<PlanItem[]>(DEFAULT_PLANS);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedPlan, setSelectedPlan] = useState<PlanItem | null>(null);

  // Billing Contact Form State
  const [billingName, setBillingName] = useState('');
  const [billingEmail, setBillingEmail] = useState('');
  const [billingPhone, setBillingPhone] = useState('');

  const [showConfirmStep, setShowConfirmStep] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync default billing contact from restaurant settings & user context (prioritizing restaurant.phone)
  useEffect(() => {
    if (!isOpen) return;

    const initialPhone =
      restaurant?.phone || user?.mobile || (user as any)?.phone || admin?.mobile || '';
    const initialEmail = (restaurant as any)?.email || user?.email || admin?.email || '';
    const initialName = user?.name || admin?.name || restaurant?.name || 'Admin';

    setBillingPhone(initialPhone);
    setBillingEmail(initialEmail);
    setBillingName(initialName);
    setShowConfirmStep(false);
    setSelectedPlan(null);
    setError(null);

    let isMounted = true;
    apiClient
      .get('/public/plans')
      .then((res) => {
        if (!isMounted) return;
        const fetchedPlans = res.data?.data?.plans || res.data?.plans;
        if (Array.isArray(fetchedPlans) && fetchedPlans.length > 0) {
          setPlans(fetchedPlans);
        }
      })
      .catch((err) => {
        console.warn('Failed to load plans from backend, using defaults', err);
      });

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, restaurant, admin, user?.id]);

  if (!isOpen) return null;

  const handleInitiatePlan = (plan: PlanItem) => {
    setSelectedPlan(plan);
    setError(null);
    setShowConfirmStep(true);
  };

  const handleLaunchCheckout = async () => {
    if (!selectedPlan) return;

    const sanitizedPhone = billingPhone.replace(/[^\d+]/g, '');
    if (!sanitizedPhone || sanitizedPhone.length < 10) {
      setError('Please provide a valid 10-digit contact phone number for Razorpay receipt.');
      return;
    }

    if (!billingEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(billingEmail)) {
      setError('Please provide a valid email address for billing receipts.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // 1. Create Purchase Order
      const orderRes = await apiClient.post('/subscriptions/purchase/create-order', {
        plan: selectedPlan.name,
        billingCycle,
      });

      const orderData = orderRes.data?.data || orderRes.data;

      if (orderData?.requiresPayment) {
        const isLoaded = await loadRazorpayScript();
        if (!isLoaded) {
          throw new Error('Razorpay SDK failed to load. Please check your network connection.');
        }

        const options = {
          key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_T2OBoMpRJxZfjk',
          amount: Math.round(orderData.amount * 100),
          currency: orderData.currency || 'INR',
          name: `${platformName} SaaS Plan`,
          description: `Subscription for ${selectedPlan.name} Plan (${billingCycle})`,
          order_id: orderData.orderId,
          prefill: {
            name: billingName || 'Admin',
            email: billingEmail,
            contact: sanitizedPhone,
          },
          readonly: {
            contact: true,
            email: true,
          },
          config: {
            display: {
              blocks: {
                upi: {
                  name: 'Pay via UPI',
                  instruments: [
                    {
                      method: 'upi',
                    },
                  ],
                },
                wallets: {
                  name: 'Pay via Wallets',
                  instruments: [
                    {
                      method: 'wallet',
                    },
                  ],
                },
              },
              sequence: ['block.upi', 'block.wallets', 'block.other'],
              preferences: {
                show_default_blocks: true,
              },
            },
          },
          theme: {
            color: '#FF6B1A',
          },
          handler: async (response: any) => {
            try {
              await apiClient.post('/subscriptions/purchase/verify', {
                plan: selectedPlan.name,
                billingCycle,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });

              await fetchSettings();
              onSuccess();
              onClose();
            } catch (err: any) {
              setError(err.response?.data?.message || 'Payment verification failed.');
            } finally {
              setIsProcessing(false);
            }
          },
          modal: {
            ondismiss: () => {
              setIsProcessing(false);
            },
          },
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      } else {
        // Free / Zero-amount Plan
        await apiClient.post('/subscriptions/purchase/verify', {
          plan: selectedPlan.name,
          billingCycle,
        });

        await fetchSettings();
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      console.error('Plan subscription error:', err);
      setError(
        err.response?.data?.error?.message ||
          err.response?.data?.message ||
          err.message ||
          'Failed to initialize subscription payment.'
      );
      setIsProcessing(false);
    }
  };

  const isCurrentPlan = (planName: string) => {
    return (
      currentPlanName.trim().toLowerCase() === planName.trim().toLowerCase() ||
      currentPlanName.toLowerCase().includes(planName.toLowerCase())
    );
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-[#121214] border border-gray-200 dark:border-neutral-800 p-6 sm:p-8 shadow-2xl space-y-6 text-gray-900 dark:text-gray-100">
        
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-100 dark:border-neutral-800 pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 text-orange-500 text-xs font-semibold mb-2">
              <Sparkles size={13} /> Admin Subscription Checkout
            </div>
            <h2 className="text-xl sm:text-2xl font-bold">
              {showConfirmStep ? 'Confirm Billing Contact & Payment' : 'Choose a Subscription Plan'}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {showConfirmStep
                ? `Review contact information for ${selectedPlan?.name} Plan billing receipt`
                : 'Upgrade your restaurant quotas, tables, staff limit, and feature set.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-2 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-medium">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!showConfirmStep ? (
          <>
            {/* Billing Cycle Selector */}
            <div className="flex justify-center">
              <div className="p-1 rounded-2xl bg-gray-100 dark:bg-[#1c1c20] border border-gray-200 dark:border-neutral-800 inline-flex items-center gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-4 py-2 rounded-xl font-bold transition-all ${
                    billingCycle === 'monthly'
                      ? 'bg-white dark:bg-[#27272a] text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  Monthly Billing
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle('yearly')}
                  className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
                    billingCycle === 'yearly'
                      ? 'bg-orange-500 text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  Yearly Billing
                  <span className="px-1.5 py-0.5 rounded-md bg-white/20 text-[10px] uppercase tracking-wider">Save 20%</span>
                </button>
              </div>
            </div>

            {/* Plan Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
              {plans.map((plan) => {
                const active = isCurrentPlan(plan.name);
                const price =
                  billingCycle === 'yearly'
                    ? plan.priceYearly ?? Math.round(plan.priceMonthly * 12 * 0.8)
                    : plan.priceMonthly;

                return (
                  <div
                    key={plan.name}
                    className={`relative flex flex-col justify-between p-5 pt-7 rounded-2xl border transition-all duration-200 ${
                      active
                        ? 'border-orange-500 bg-orange-500/10 dark:bg-orange-500/10 ring-1 ring-orange-500/30'
                        : 'border-gray-200 dark:border-neutral-800 bg-white dark:bg-[#18181b] hover:border-gray-300 dark:hover:border-neutral-700'
                    }`}
                  >
                    {active && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-orange-500 text-white text-[10px] font-bold uppercase tracking-wider shadow-sm z-10 whitespace-nowrap">
                        Current Plan
                      </div>
                    )}

                    <div className="space-y-4">
                      <div>
                        <h3 className="text-base font-bold text-gray-900 dark:text-white">{plan.name}</h3>
                        <div className="mt-2 flex items-baseline gap-1">
                          <span className="text-2xl font-extrabold font-mono text-gray-900 dark:text-white">₹{price}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            /{billingCycle === 'yearly' ? 'yr' : 'mo'}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-neutral-800 text-xs">
                        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 font-medium">
                          <Check size={14} className="text-emerald-500 shrink-0" />
                          <span>Tables: {plan.tableLimit ?? 'Unlimited'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 font-medium">
                          <Check size={14} className="text-emerald-500 shrink-0" />
                          <span>Daily Orders: {plan.dailyOrderLimit ?? 'Unlimited'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 font-medium">
                          <Check size={14} className="text-emerald-500 shrink-0" />
                          <span>Staff Members: {plan.staffLimit ?? 'Unlimited'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 font-medium">
                          <Check size={14} className="text-emerald-500 shrink-0" />
                          <span>Inventory: {plan.inventoryLimit ?? 'Unlimited'}</span>
                        </div>

                        {plan.features?.slice(4).map((f, i) => (
                          <div key={i} className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                            <Check size={14} className="text-emerald-500 shrink-0" />
                            <span>{f}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-5 mt-4 border-t border-gray-100 dark:border-neutral-800">
                      {active ? (
                        <button
                          type="button"
                          disabled
                          className="w-full py-2.5 rounded-full bg-gray-200 dark:bg-neutral-800 text-gray-500 dark:text-gray-400 text-xs font-bold cursor-default"
                        >
                          Active Plan
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleInitiatePlan(plan)}
                          className="w-full py-2.5 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-all shadow-md shadow-orange-500/20 cursor-pointer"
                        >
                          {price > 0 ? 'Select & Pay' : 'Switch to Free'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          /* Step 2: Confirm Billing Contact Details before Razorpay opens */
          <div className="max-w-lg mx-auto space-y-6 py-2">
            <div className="p-5 rounded-2xl bg-gray-50 dark:bg-[#18181b] border border-gray-200 dark:border-neutral-800 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-200 dark:border-neutral-800 pb-3">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Plan Summary</span>
                <span className="text-xs font-bold text-orange-500">{selectedPlan?.name} Plan ({billingCycle})</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium">Total Amount Payable:</span>
                <span className="text-2xl font-extrabold font-mono text-gray-900 dark:text-white">
                  ₹{billingCycle === 'yearly'
                    ? selectedPlan?.priceYearly ?? Math.round((selectedPlan?.priceMonthly || 0) * 12 * 0.8)
                    : selectedPlan?.priceMonthly}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                <ShieldCheck size={16} className="text-orange-500" />
                Confirm Billing Receipt Contact Details
              </h3>
              
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                  Admin Full Name
                </label>
                <div className="relative">
                  <User size={15} className="absolute left-3.5 top-3 text-gray-400" />
                  <input
                    type="text"
                    value={billingName}
                    onChange={(e) => setBillingName(e.target.value)}
                    className="w-full bg-white dark:bg-[#1c1c20] border border-gray-200 dark:border-neutral-800 rounded-xl pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:border-orange-500"
                    placeholder="Enter Admin Name"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                  Billing Email Address
                </label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-3 text-gray-400" />
                  <input
                    type="email"
                    value={billingEmail}
                    onChange={(e) => setBillingEmail(e.target.value)}
                    className="w-full bg-white dark:bg-[#1c1c20] border border-gray-200 dark:border-neutral-800 rounded-xl pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:border-orange-500"
                    placeholder="Enter Email Address"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                  Billing Mobile Phone Number (For Razorpay & OTP SMS)
                </label>
                <div className="relative">
                  <Phone size={15} className="absolute left-3.5 top-3 text-gray-400" />
                  <input
                    type="tel"
                    value={billingPhone}
                    onChange={(e) => setBillingPhone(e.target.value)}
                    className="w-full bg-white dark:bg-[#1c1c20] border border-gray-200 dark:border-neutral-800 rounded-xl pl-10 pr-4 py-2.5 text-xs font-mono font-bold focus:outline-none focus:border-orange-500 text-orange-600 dark:text-orange-400"
                    placeholder="+91 9876543210"
                    required
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-1">
                  This exact mobile number will be locked and passed to Razorpay for SMS verification and invoice receipt.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-4 border-t border-gray-100 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setShowConfirmStep(false)}
                className="flex-1 py-3 px-4 rounded-full bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 text-gray-700 dark:text-gray-300 font-bold text-xs transition-colors"
              >
                Back to Plans
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleLaunchCheckout}
                className="flex-1 py-3 px-4 rounded-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-orange-500/20 flex items-center justify-center gap-2 transition-all"
              >
                {isProcessing ? (
                  'Initializing Razorpay…'
                ) : (
                  <>
                    <span>Proceed to Razorpay</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
