import React, { useState, useEffect } from 'react';
import { Check, User, MapPin, CreditCard, RefreshCw, KeyRound, Building, Compass, Sparkles, AlertCircle } from 'lucide-react';
import { apiClient } from '../../../../shared/services/apiClient';
import { usePlatformSettingsGuard } from '../../../../shared/hooks/usePlatformSettingsGuard';

interface OnboardingWizardProps {
  restaurant: any;
  onComplete: () => void;
}

export default function OnboardingWizard({ restaurant: initialRestaurant, onComplete }: OnboardingWizardProps) {
  const { settings: platformSettings } = usePlatformSettingsGuard();
  const platformName = platformSettings?.platformName || 'RestoHub';

  const [restaurant, setRestaurant] = useState(initialRestaurant);
  const [activeStep, setActiveStep] = useState(2); // Step 1 (Change Password) is already done

  // Profile Form States
  const [profileData, setProfileData] = useState({
    ownerName: restaurant.ownerName || '',
    phone: restaurant.phone || '',
    address: restaurant.address || '',
    city: restaurant.city || '',
    state: restaurant.state || '',
    country: restaurant.country || 'India',
    pinCode: restaurant.pinCode || '',
    gstNumber: restaurant.gstNumber || '',
    cuisine: restaurant.cuisine || '',
    branches: restaurant.branches || 1,
    expectedMonthlyOrders: restaurant.expectedMonthlyOrders || 500,
    latitude: restaurant.latitude || 0,
    longitude: restaurant.longitude || 0,
    googleMapsUrl: restaurant.googleMapsUrl || '',
  });

  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Plans & Payment States
  const [plans, setPlans] = useState<any[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Sync state with restaurant status
  useEffect(() => {
    if (restaurant.status === 'PLAN_SELECTION_PENDING' || restaurant.status === 'PAYMENT_PENDING') {
      setActiveStep(3);
    } else {
      setActiveStep(2);
    }
  }, [restaurant.status]);

  // Fetch plans
  useEffect(() => {
    if (activeStep === 3) {
      setPlansLoading(true);
      apiClient.get('/public/plans')
        .then((res) => {
          const list = res.data?.data?.plans || [];
          setPlans(list);
          if (list.length > 0) {
            setSelectedPlan(list[0].name);
          }
        })
        .catch((err) => console.error('Failed to fetch plans', err))
        .finally(() => setPlansLoading(false));
    }
  }, [activeStep]);

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setProfileData((prev) => ({
      ...prev,
      [name]: name === 'branches' || name === 'expectedMonthlyOrders' || name === 'latitude' || name === 'longitude' ? parseFloat(value) || 0 : value,
    }));
  };

  const validateProfile = () => {
    const errors: Record<string, string> = {};
    if (!profileData.ownerName.trim()) errors.ownerName = 'Owner name is required';
    if (!profileData.phone.trim()) errors.phone = 'Contact phone number is required';
    if (!profileData.address.trim()) errors.address = 'Street address is required';
    if (!profileData.city.trim()) errors.city = 'City is required';
    if (!profileData.state.trim()) errors.state = 'State is required';
    if (!profileData.pinCode.trim()) errors.pinCode = 'PIN Code is required';
    if (!profileData.cuisine.trim()) errors.cuisine = 'Cuisine type is required';
    if (profileData.branches <= 0) errors.branches = 'Must have at least 1 branch';
    
    setProfileErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    if (!validateProfile()) return;

    setProfileLoading(true);
    try {
      const response = await apiClient.patch('/admin/restaurant/profile', profileData);
      const updatedRest = response.data?.data?.restaurant || response.data?.restaurant;
      if (updatedRest) {
        setRestaurant(updatedRest);
        setActiveStep(3);
      }
    } catch (err: any) {
      console.error(err);
      setProfileError(err.response?.data?.message || err.message || 'Failed to update profile.');
    } finally {
      setProfileLoading(false);
    }
  };

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.id = 'razorpay-checkout-sdk';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePlanCheckout = async () => {
    if (!selectedPlan) return;
    setPaymentLoading(true);
    setPaymentError(null);

    const chosenPlanDoc = plans.find((p) => p.name === selectedPlan);
    if (!chosenPlanDoc) return;

    try {
      // 1. Create Purchase Order
      const orderRes = await apiClient.post('/subscriptions/purchase/create-order', {
        plan: selectedPlan,
        billingCycle,
      });

      const orderData = orderRes.data?.data;

      if (orderData.requiresPayment) {
        // 2. Load Razorpay script
        const isLoaded = await loadRazorpayScript();
        if (!isLoaded) {
          throw new Error('Razorpay SDK failed to load.');
        }

        // 3. Launch Razorpay popup
        const options = {
          key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_T2OBoMpRJxZfjk',
          amount: orderData.amount * 100, // Razorpay expects paise
          currency: orderData.currency,
          name: `${platformName} SaaS Plan`,
          description: `Subscription for ${selectedPlan} Plan`,
          order_id: orderData.orderId,
          handler: async function (response: any) {
            try {
              // Verify on backend
              await apiClient.post('/subscriptions/purchase/verify', {
                plan: selectedPlan,
                billingCycle,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });

              onComplete();
            } catch (err: any) {
              setPaymentError(err.response?.data?.message || err.message || 'Payment verification failed.');
              setPaymentLoading(false);
            }
          },
          prefill: {
            name: profileData.ownerName || restaurant.ownerName || '',
            email: restaurant.email || '',
            contact: (profileData.phone || restaurant.phone || '').replace(/[^\d+]/g, ''),
          },
          readonly: {
            contact: true,
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
          modal: {
            ondismiss: function () {
              setPaymentLoading(false);
              setPaymentError('Checkout cancelled by user.');
            },
          },
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      } else {
        // Free Plan - Verify instantly
        await apiClient.post('/subscriptions/purchase/verify', {
          plan: selectedPlan,
          billingCycle,
        });
        onComplete();
      }
    } catch (err: any) {
      console.error(err);
      setPaymentError(err.response?.data?.message || err.message || 'Payment checkout initialization failed.');
      setPaymentLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
      {/* Main Unified White Card Container */}
      <div className="bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-900 rounded-[2rem] p-6 sm:p-10 shadow-2xl space-y-8 text-slate-800 dark:text-slate-100">
        
        {/* Header Banner */}
        <div className="text-center space-y-3 pb-6 border-b border-slate-100 dark:border-slate-900">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 dark:bg-orange-950/40 text-orange-500 text-xs font-semibold border border-orange-200/50">
            <Sparkles size={12} className="animate-pulse" />
            Onboarding Setup Wizard
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 dark:text-slate-100">Welcome to RestoHub!</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Complete these simple steps to configure your restaurant profile and launch your services.</p>
        </div>

        {/* Progress Wizard Bar */}
        <div className="grid grid-cols-3 gap-3 sm:gap-6 pb-6 border-b border-slate-100 dark:border-slate-900">
          {/* Step 1 */}
          <div className="relative flex flex-col items-center">
            <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold shadow-md shadow-emerald-500/20 transition-all duration-300">
              <Check size={16} />
            </div>
            <span className="text-xs font-semibold text-slate-550 dark:text-slate-400 mt-2.5">Change Password</span>
            <span className="text-[10px] text-emerald-500 font-medium">Completed</span>
          </div>

          {/* Step 2 */}
          <div className="relative flex flex-col items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all duration-300 border ${
              activeStep === 2
                ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20 border-orange-500'
                : activeStep > 2
                ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20 border-emerald-500'
                : 'bg-slate-100 dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-800'
            }`}>
              {activeStep > 2 ? <Check size={16} /> : <User size={16} />}
            </div>
            <span className="text-xs font-semibold text-slate-550 dark:text-slate-400 mt-2.5">Restaurant Profile</span>
            <span className={`text-[10px] font-medium ${activeStep === 2 ? 'text-orange-500 animate-pulse' : activeStep > 2 ? 'text-emerald-500' : 'text-slate-400'}`}>
              {activeStep === 2 ? 'In Progress' : activeStep > 2 ? 'Completed' : 'Pending'}
            </span>
          </div>

          {/* Step 3 */}
          <div className="relative flex flex-col items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all duration-300 border ${
              activeStep === 3
                ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20 border-orange-500'
                : 'bg-slate-100 dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-800'
            }`}>
              <CreditCard size={16} />
            </div>
            <span className="text-xs font-semibold text-slate-550 dark:text-slate-400 mt-2.5">Select Plan & Pay</span>
            <span className={`text-[10px] font-medium ${activeStep === 3 ? 'text-orange-500 animate-pulse' : 'text-slate-400'}`}>
              {activeStep === 3 ? 'In Progress' : 'Pending'}
            </span>
          </div>
        </div>

        {/* Step Contents */}
        {activeStep === 2 && (
          <form onSubmit={handleProfileSubmit} className="space-y-6">
            <div className="flex items-center gap-3 border-b dark:border-slate-900 pb-4">
              <div className="w-9 h-9 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
                <Building size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Step 2: Complete Restaurant Details</h3>
                <p className="text-xs text-slate-450 dark:text-slate-400">Fill in the required information to set up your restaurant storefront.</p>
              </div>
            </div>

            {profileError && (
              <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/35 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{profileError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Owner Full Name *</label>
                <input
                  type="text"
                  name="ownerName"
                  value={profileData.ownerName}
                  onChange={handleProfileChange}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-orange-500 rounded-xl px-4 py-2.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
                  required
                />
                {profileErrors.ownerName && <p className="text-[10px] text-red-500 mt-1">{profileErrors.ownerName}</p>}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Contact Phone *</label>
                <input
                  type="tel"
                  name="phone"
                  value={profileData.phone}
                  onChange={handleProfileChange}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-orange-500 rounded-xl px-4 py-2.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
                  required
                />
                {profileErrors.phone && <p className="text-[10px] text-red-500 mt-1">{profileErrors.phone}</p>}
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Street Address *</label>
                <input
                  type="text"
                  name="address"
                  value={profileData.address}
                  onChange={handleProfileChange}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-orange-500 rounded-xl px-4 py-2.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
                  required
                />
                {profileErrors.address && <p className="text-[10px] text-red-500 mt-1">{profileErrors.address}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4 sm:col-span-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">City *</label>
                  <input
                    type="text"
                    name="city"
                    value={profileData.city}
                    onChange={handleProfileChange}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-orange-500 rounded-xl px-3 py-2.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
                    required
                  />
                  {profileErrors.city && <p className="text-[10px] text-red-500 mt-1">{profileErrors.city}</p>}
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">State *</label>
                  <input
                    type="text"
                    name="state"
                    value={profileData.state}
                    onChange={handleProfileChange}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-orange-500 rounded-xl px-3 py-2.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
                    required
                  />
                  {profileErrors.state && <p className="text-[10px] text-red-500 mt-1">{profileErrors.state}</p>}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">PIN Code *</label>
                <input
                  type="text"
                  name="pinCode"
                  value={profileData.pinCode}
                  onChange={handleProfileChange}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-orange-500 rounded-xl px-4 py-2.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
                  required
                />
                {profileErrors.pinCode && <p className="text-[10px] text-red-500 mt-1">{profileErrors.pinCode}</p>}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">GST Number</label>
                <input
                  type="text"
                  name="gstNumber"
                  value={profileData.gstNumber}
                  onChange={handleProfileChange}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-orange-500 rounded-xl px-4 py-2.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Cuisine Type *</label>
                <input
                  type="text"
                  name="cuisine"
                  value={profileData.cuisine}
                  onChange={handleProfileChange}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-orange-500 rounded-xl px-4 py-2.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
                  required
                />
                {profileErrors.cuisine && <p className="text-[10px] text-red-500 mt-1">{profileErrors.cuisine}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    name="latitude"
                    value={profileData.latitude}
                    onChange={handleProfileChange}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-orange-500 rounded-xl px-3 py-2.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    name="longitude"
                    value={profileData.longitude}
                    onChange={handleProfileChange}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-orange-500 rounded-xl px-3 py-2.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-4 pt-4 border-t dark:border-slate-900">
              <button
                type="submit"
                disabled={profileLoading}
                className="w-full sm:w-auto ml-auto py-3 px-6 rounded-2xl bg-[#FF6B1A] hover:bg-orange-600 disabled:bg-slate-200 dark:disabled:bg-slate-900 disabled:text-slate-400 dark:disabled:text-slate-500 text-white font-extrabold text-xs shadow-md shadow-orange-500/10 flex items-center justify-center gap-2 transition-all"
              >
                {profileLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Saving Details...
                  </>
                ) : (
                  <>
                    Save & Proceed
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {activeStep === 3 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 border-b dark:border-slate-900 pb-4">
              <div className="w-9 h-9 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
                <CreditCard size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Step 3: Select Plan & Activate</h3>
                <p className="text-xs text-slate-450 dark:text-slate-400">Choose a platform subscription plan. You can pay via credit card, UPI, or wallet.</p>
              </div>
            </div>

            {paymentError && (
              <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/35 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{paymentError}</span>
              </div>
            )}

            {/* Toggle Billing Frequency */}
            <div className="flex justify-center mb-6">
              <div className="inline-flex items-center bg-slate-50 dark:bg-slate-900 p-1 rounded-xl border dark:border-slate-800">
                <button
                  onClick={() => setBillingCycle('monthly')}
                  className={`py-1.5 px-4 text-xs font-bold rounded-lg transition-all ${
                    billingCycle === 'monthly'
                      ? 'bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Monthly Billing
                </button>
                <button
                  onClick={() => setBillingCycle('yearly')}
                  className={`py-1.5 px-4 text-xs font-bold rounded-lg transition-all ${
                    billingCycle === 'yearly'
                      ? 'bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Yearly Billing (Save {
                    (() => {
                      const selectedDoc = plans.find((p) => p.name === selectedPlan);
                      return selectedDoc && (selectedDoc.yearlyDiscountPercentage !== undefined && selectedDoc.yearlyDiscountPercentage !== null)
                        ? selectedDoc.yearlyDiscountPercentage
                        : 20;
                    })()
                  }%)
                </button>
              </div>
            </div>

            {plansLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
                <RefreshCw className="w-8 h-8 animate-spin text-orange-500" />
                <span className="text-xs">Fetching RestoHub plans...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {plans.map((planDoc) => {
                  const isSelected = selectedPlan === planDoc.name;
                  const monthlyPrice = planDoc.priceMonthly;
                  const discountPct = planDoc.yearlyDiscountPercentage !== undefined && planDoc.yearlyDiscountPercentage !== null
                    ? planDoc.yearlyDiscountPercentage
                    : 20;
                  const yearlyPrice = planDoc.priceYearly || Math.round(planDoc.priceMonthly * 12 * (1 - discountPct / 100));
                  const activePrice = billingCycle === 'monthly' ? monthlyPrice : Math.round(yearlyPrice / 12);
                  const totalBillingAmount = billingCycle === 'monthly' ? monthlyPrice : yearlyPrice;

                  return (
                    <div
                      key={planDoc._id}
                      onClick={() => setSelectedPlan(planDoc.name)}
                      className={`relative rounded-3xl border p-6 cursor-pointer flex flex-col justify-between transition-all select-none ${
                        isSelected
                          ? 'border-orange-500 ring-1 ring-orange-500/25 bg-orange-50/10 dark:bg-orange-500/10'
                          : 'border-gray-200 dark:border-neutral-800 bg-white dark:bg-[#18181b] hover:border-gray-300 dark:hover:border-neutral-700'
                      }`}
                    >
                      {isSelected && (
                        <span className="absolute -top-2.5 right-6 bg-orange-500 text-white text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full shadow-sm">
                          Selected
                        </span>
                      )}

                      <div className="space-y-4">
                        <div>
                          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">{planDoc.name} Plan</h4>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{planDoc.description || 'Access basic dining tools.'}</p>
                        </div>

                        <div className="flex items-baseline gap-1 flex-wrap">
                          <span className="text-3xl font-extrabold font-sans text-slate-800 dark:text-slate-100">₹{activePrice}</span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">/mo</span>
                          {billingCycle === 'yearly' && discountPct > 0 && (
                            <span className="text-[9px] font-extrabold text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-250 dark:border-emerald-800 px-1.5 py-0.5 rounded-md ml-1 inline-flex items-center">
                              {discountPct}% OFF
                            </span>
                          )}
                        </div>
                        {billingCycle === 'yearly' && monthlyPrice > 0 && (
                          <div className="text-[10px] text-orange-500 font-semibold">
                            Billed ₹{totalBillingAmount} annually
                          </div>
                        )}

                        <div className="border-t dark:border-slate-900 pt-4">
                          <ul className="text-[11px] text-slate-550 dark:text-slate-400 space-y-2.5">
                            <li className="flex items-center gap-2">
                              <Check size={12} className="text-emerald-500" />
                              <span>{planDoc.tenantLimit} Restaurant Admin</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <Check size={12} className="text-emerald-500" />
                              <span>{planDoc.tableLimit ? `${planDoc.tableLimit} Tables limit` : 'Unlimited Tables'}</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <Check size={12} className="text-emerald-500" />
                              <span>{planDoc.features?.length || 0} Premium Features</span>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex gap-4 pt-6 border-t dark:border-slate-900">
              <button
                type="button"
                onClick={() => setActiveStep(2)}
                disabled={paymentLoading}
                className="py-3 px-6 rounded-2xl border dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 disabled:opacity-50 text-xs font-semibold text-slate-650 dark:text-slate-305 transition-colors"
              >
                Back to Profile
              </button>
              <button
                type="button"
                onClick={handlePlanCheckout}
                disabled={paymentLoading || plansLoading || !selectedPlan}
                className="ml-auto py-3 px-6 rounded-2xl bg-[#FF6B1A] hover:bg-orange-600 disabled:bg-slate-200 dark:disabled:bg-slate-900 disabled:text-slate-400 dark:disabled:text-slate-500 text-white font-extrabold text-xs shadow-md shadow-orange-500/10 flex items-center justify-center gap-2 transition-all"
              >
                {paymentLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Processing Payment...
                  </>
                ) : (
                  <>
                    <CreditCard size={14} />
                    Pay & Activate Account
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
