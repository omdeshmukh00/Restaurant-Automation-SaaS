import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Shield, Star, Award, Zap, Sparkles, HelpCircle, Loader2 } from 'lucide-react';
import { apiClient } from '../../../shared/services/apiClient';
import { LandingNavbar, LandingFooter } from '../components/landing';
import '../components/landing/landing.css';

export default function PricingPage() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');

  const openLogin = () => {
    navigate('/auth/customer');
  };

  useEffect(() => {
    let active = true;
    const fetchPlans = async () => {
      try {
        const response = await apiClient.get('/public/plans');
        if (active && (response.data?.success || response.data?.status === 'success') && response.data?.data?.plans) {
          // Sort plans by price to keep order
          const sorted = [...response.data.data.plans].sort((a: any, b: any) => a.priceMonthly - b.priceMonthly);
          setPlans(sorted);
        }
      } catch (err) {
        console.error('Failed to fetch pricing plans', err);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchPlans();
    return () => {
      active = false;
    };
  }, []);

  // Show all available plans
  const displayPlans = plans;

  const getPlanIcon = (name: string) => {
    const uppercaseName = name.toUpperCase();
    if (uppercaseName.includes('FREE')) return <Zap className="w-6 h-6 text-slate-400" />;
    if (uppercaseName.includes('STANDARD') || uppercaseName.includes('STARTER')) return <Shield className="w-6 h-6 text-blue-500" />;
    if (uppercaseName.includes('PREMIUM') || uppercaseName.includes('PRO')) return <Star className="w-6 h-6 text-amber-500" fill="currentColor" />;
    return <Award className="w-6 h-6 text-orange-500" fill="currentColor" />;
  };

  const getPlanIconBg = (name: string) => {
    const uppercaseName = name.toUpperCase();
    if (uppercaseName.includes('FREE')) return 'bg-slate-50 dark:bg-slate-900';
    if (uppercaseName.includes('STANDARD') || uppercaseName.includes('STARTER')) return 'bg-blue-50 dark:bg-blue-950/20';
    if (uppercaseName.includes('PREMIUM') || uppercaseName.includes('PRO')) return 'bg-amber-50 dark:bg-amber-950/20';
    return 'bg-orange-50 dark:bg-orange-950/20';
  };

  const calculateDiscountedPrice = (plan: any) => {
    if (billingPeriod === 'yearly' && plan.yearlyDiscountPercentage > 0) {
      return Math.round(plan.priceMonthly * (1 - plan.yearlyDiscountPercentage / 100));
    }
    return plan.priceMonthly;
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(price);
  };

  return (
    <div className="landing-page-container min-h-screen bg-neutral-50 font-sans relative overflow-hidden flex flex-col justify-between">
      <LandingNavbar onLoginOpen={openLogin} />

      {/* Spacer for Navbar */}
      <div className="h-[72px] shrink-0" />

      {/* Main Content Area */}
      <main className="flex-1 py-16 sm:py-20 relative overflow-hidden" style={{ backgroundColor: '#FFF8F3' }}>
        {/* Decorative background orbs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute rounded-full"
            style={{
              top: '10%', left: '5%', width: 350, height: 350,
              background: 'radial-gradient(circle, rgba(255,107,26,0.04) 0%, transparent 70%)',
            }}
          />
          <div
            className="absolute rounded-full"
            style={{
              bottom: '10%', right: '5%', width: 450, height: 450,
              background: 'radial-gradient(circle, rgba(255,107,26,0.05) 0%, transparent 70%)',
            }}
          />
        </div>

        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 relative z-10">
          {/* Section Header */}
          <div className="text-center max-w-[800px] mx-auto mb-12 sm:mb-16">

            <h1
              className="text-[32px] sm:text-[44px] lg:text-[52px] font-bold leading-tight"
              style={{ color: '#222222' }}
            >
              Choose the perfect plan for your <span style={{ color: '#FF6B1A' }}>business</span>
            </h1>
            <p className="text-[15px] sm:text-[16px] mt-4" style={{ color: '#666666' }}>
              From single food trucks to multi-location restaurant groups, we have the right features to automate your ordering, table bookings, and kitchen management.
            </p>
          </div>

          {/* Pricing Controls Toggle */}
          <div className="flex flex-col items-center gap-6 mb-12 sm:mb-16">
            {/* Monthly / Yearly Billing Toggle */}
            <div className="flex items-center gap-3 bg-white p-1.5 rounded-2xl shadow-sm border border-[#E5E7EB]">
              <button
                onClick={() => setBillingPeriod('monthly')}
                className={`px-5 py-2 text-[14px] font-semibold transition-all duration-200 ${
                  billingPeriod === 'monthly'
                    ? 'text-white'
                    : 'text-[#666666] hover:text-[#222222]'
                }`}
                style={{
                  background: billingPeriod === 'monthly' ? 'linear-gradient(135deg, #FF6B1A, #E65A0A)' : 'transparent',
                  borderRadius: '12px',
                }}
              >
                Monthly Billing
              </button>
              <button
                onClick={() => setBillingPeriod('yearly')}
                className={`px-5 py-2 text-[14px] font-semibold transition-all duration-200 flex items-center gap-2 ${
                  billingPeriod === 'yearly'
                    ? 'text-white'
                    : 'text-[#666666] hover:text-[#222222]'
                }`}
                style={{
                  background: billingPeriod === 'yearly' ? 'linear-gradient(135deg, #FF6B1A, #E65A0A)' : 'transparent',
                  borderRadius: '12px',
                }}
              >
                Yearly Billing
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider" style={{
                  backgroundColor: billingPeriod === 'yearly' ? 'rgba(255,255,255,0.2)' : 'rgba(255,107,26,0.15)',
                  color: billingPeriod === 'yearly' ? '#FFFFFF' : '#FF6B1A'
                }}>
                  Save Up to 30%
                </span>
              </button>
            </div>
          </div>

          {/* Pricing Grid */}
          {loading ? (
            <div className="min-h-[300px] flex flex-col items-center justify-center gap-4">
              <Loader2 className="w-10 h-10 animate-spin text-orange-600" />
              <p className="text-[14px] text-slate-500 font-semibold">Loading available plans...</p>
            </div>
          ) : displayPlans.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 justify-center items-stretch max-w-[1280px] mx-auto">
              {displayPlans.map((plan) => {
                const currentPrice = calculateDiscountedPrice(plan);
                const originalPrice = plan.priceMonthly;
                const discount = plan.yearlyDiscountPercentage;
                const isPopular = plan.name.toUpperCase() === 'PREMIUM' || plan.name.toUpperCase() === 'PRO';

                return (
                  <div
                    key={plan._id}
                    className={`bg-white rounded-3xl p-6 sm:p-8 flex flex-col justify-between transition-all duration-300 relative border ${
                      isPopular
                        ? 'border-orange-500 ring-2 ring-orange-500 shadow-xl scale-[1.03]'
                        : 'border-[#E5E7EB] hover:border-orange-200 hover:shadow-lg'
                    }`}
                  >
                    {/* Popular Badge */}
                    {isPopular && (
                      <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 text-[11px] font-bold uppercase tracking-wider text-white bg-gradient-to-r from-orange-500 to-red-500 rounded-full shadow-sm">
                        Most Popular
                      </span>
                    )}

                    {/* Plan Header */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className={`p-3 rounded-2xl ${getPlanIconBg(plan.name)}`}>
                          {getPlanIcon(plan.name)}
                        </div>
                        {billingPeriod === 'yearly' && discount > 0 && (
                          <span className="text-[11px] font-bold text-green-600 bg-green-50 px-2.5 py-1 rounded-full border border-green-100">
                            {discount}% OFF
                          </span>
                        )}
                      </div>

                      <h3 className="text-[20px] font-bold text-slate-900 capitalize mb-2">{plan.name}</h3>
                      
                      {/* Price Section */}
                      <div className="flex items-baseline gap-1 my-4">
                        <span className="text-[34px] font-black text-slate-900 leading-none">
                          {formatPrice(currentPrice)}
                        </span>
                        <span className="text-[13px] text-slate-500 font-semibold">/mo</span>
                      </div>

                      {/* Yearly Price Fallback */}
                      {billingPeriod === 'yearly' && discount > 0 && (
                        <div className="mb-4">
                          <p className="text-[12px] text-slate-500 line-through">
                            Was {formatPrice(originalPrice)}/mo
                          </p>
                          <p className="text-[12px] text-green-600 font-semibold">
                            Billed annually ({formatPrice(currentPrice * 12)}/yr)
                          </p>
                        </div>
                      )}

                      {/* Plan Limits / Stats */}
                      <div className="py-4 border-t border-b border-[#F4F4F5] my-4 space-y-2 text-[13px] text-slate-600 font-medium">
                        {plan.usageLimit && (
                          <p className="flex justify-between">
                            <span>Order Limit:</span>
                            <span className="font-bold text-slate-900">{plan.usageLimit} orders/mo</span>
                          </p>
                        )}
                        {plan.staffLimit !== undefined && (
                          <p className="flex justify-between">
                            <span>Staff Limit:</span>
                            <span className="font-bold text-slate-900">
                              {plan.staffLimit === null ? 'Unlimited' : `${plan.staffLimit} users`}
                            </span>
                          </p>
                        )}
                        {plan.tenantLimit && (
                          <p className="flex justify-between">
                            <span>Locations supported:</span>
                            <span className="font-bold text-slate-900">
                              {plan.tenantLimit === 1 ? 'Single Location' : `Up to ${plan.tenantLimit} locations`}
                            </span>
                          </p>
                        )}
                      </div>

                      {/* Plan Features */}
                      <h4 className="text-[12px] font-bold uppercase tracking-wider text-slate-400 mb-3">Key Features</h4>
                      <ul className="space-y-3 mb-6">
                        {plan.features?.map((feature: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-2.5">
                            <Check className="w-[16px] h-[16px] text-orange-600 shrink-0 mt-0.5" />
                            <span className="text-[13px] text-slate-700 leading-snug">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* CTA Button */}
                    <button
                      onClick={() => navigate('/partner')}
                      className={`w-full py-3.5 px-4 rounded-2xl text-[14px] font-bold transition-all duration-200 active:scale-[0.98] ${
                        isPopular
                          ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-soft'
                          : 'bg-[#F4F4F5] text-slate-800 hover:bg-slate-200 border border-[#E5E7EB]'
                      }`}
                    >
                      Get Started
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-[#E5E7EB] max-w-[600px] mx-auto">
              <HelpCircle className="w-12 h-12 text-[#999999] mx-auto mb-3" />
              <p className="text-[#666666] font-semibold text-[16px]">No pricing plans found</p>
              <p className="text-[#999999] text-[13px] mt-1">Pricing tiers are temporarily offline. Please check back later or contact support.</p>
            </div>
          )}
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
