import React, { useState, useEffect } from 'react';
import { HelpCircle, Mail, Loader2 } from 'lucide-react';
import { apiClient } from '../../shared/services/apiClient';

interface PlanSelectorProps {
  selectedPlan: string;
  onChange: (plan: string) => void;
  plans?: any[];
  loading?: boolean;
}

export default function PlanSelector({ selectedPlan, onChange, plans: propPlans, loading: propLoading }: PlanSelectorProps) {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (propPlans !== undefined) {
      setPlans(propPlans);
      if (propLoading !== undefined) {
        setLoading(propLoading);
      } else {
        setLoading(false);
      }
      return;
    }

    apiClient.get('/public/plans')
      .then((res) => {
        const list = res.data?.data?.plans || [];
        setPlans(list);
      })
      .catch((err) => console.error('Failed to load plans', err))
      .finally(() => setLoading(false));
  }, [propPlans, propLoading]);

  // Auto-select first active plan if current selection is invalid
  useEffect(() => {
    if (plans.length > 0 && !plans.some((p: any) => p.name === selectedPlan)) {
      const defaultPlan = plans.find((p: any) => p.name.toLowerCase() === 'free' || p.name.toLowerCase() === 'basic') || plans[0];
      onChange(defaultPlan.name);
    }
  }, [plans, selectedPlan, onChange]);

  const badges = [
    { text: 'Best for Starters', color: 'text-emerald-700', bg: 'bg-emerald-50' },
    { text: 'Most Popular', color: 'text-blue-700', bg: 'bg-blue-50' },
    { text: 'For Growing Business', color: 'text-purple-700', bg: 'bg-purple-50' },
    { text: 'For Large Chains', color: 'text-teal-700', bg: 'bg-teal-50' },
  ];

  if (loading) {
    return (
      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
        <span className="text-xs">Loading available subscription plans...</span>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
          <HelpCircle className="w-4.5 h-4.5" />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-800">Select Your Plan</h3>
          <p className="text-[11px] text-slate-500">Choose the plan that best fits your restaurant's needs.</p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {plans.map((plan, index) => {
          const isSelected = selectedPlan === plan.name;
          const badge = badges[index] || { text: 'Premium Plan', color: 'text-orange-700', bg: 'bg-orange-50' };

          return (
            <div
              key={plan._id}
              onClick={() => onChange(plan.name)}
              className={`cursor-pointer rounded-2xl border p-4 transition-all duration-200 flex flex-col gap-3 relative ${
                isSelected
                  ? 'bg-slate-50/50 border-orange-500 ring-1 ring-orange-500/25'
                  : 'bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50/20'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-extrabold text-slate-400 tracking-wider block uppercase">
                    {plan.name} PLAN
                  </span>
                  <div className="flex items-baseline mt-1">
                    {plan.originalPriceMonthly && plan.originalPriceMonthly > plan.priceMonthly && (
                      <span className="line-through text-slate-450 text-xs mr-1.5 font-semibold text-red-500/80">
                        ₹{plan.originalPriceMonthly}
                      </span>
                    )}
                    <span className="text-xl font-extrabold text-slate-800">
                      {plan.priceMonthly === 0 ? 'Free' : `₹${plan.priceMonthly}`}
                    </span>
                    <span className="text-slate-450 text-[10px] font-semibold ml-0.5">
                      {plan.priceMonthly === 0 ? '/forever' : '/mo'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider ${badge.color} ${badge.bg}`}>
                    {badge.text}
                  </span>
                  
                  {/* Custom Radio Button */}
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    isSelected ? 'border-orange-500 bg-orange-500' : 'border-slate-300 bg-white'
                  }`}>
                    {isSelected && (
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </div>
                </div>
              </div>

              {/* Horizontal List of Features */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1.5 border-t border-slate-100/80">
                <span className="text-[10px] font-bold text-orange-600 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                  {plan.staffLimit ? `Up to ${plan.staffLimit} Staff` : 'Unlimited Staff'}
                </span>
                {plan.features && plan.features.map((feature: string, idx: number) => (
                  <span key={idx} className="text-[10px] text-slate-500 flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-slate-300" />
                    {feature}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Contact Sales CTA Box */}
      <div className="bg-purple-50/50 border border-purple-100 rounded-2xl p-4 flex flex-col gap-3 text-center sm:text-left sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-0.5">
          <p className="text-[11px] font-bold text-slate-800">Not sure which plan to choose?</p>
          <p className="text-[10px] text-slate-500">Our team will help you choose the perfect plan for your business.</p>
        </div>
        <button
          type="button"
          onClick={() => window.open('mailto:sales@restohub.in')}
          className="self-center sm:self-auto py-2 px-4 rounded-xl border border-purple-200 bg-white hover:bg-purple-50 text-purple-700 text-[10px] font-bold shadow-sm transition-all flex items-center gap-1.5"
        >
          <Mail className="w-3.5 h-3.5" />
          Contact Sales Team
        </button>
      </div>
    </div>
  );
}
