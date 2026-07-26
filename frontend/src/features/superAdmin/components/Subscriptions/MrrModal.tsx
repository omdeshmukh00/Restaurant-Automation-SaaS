import { useState, useEffect } from "react";
import { X, Search, TrendingUp, Building2, ShieldCheck, CreditCard, RefreshCw, Calendar, IndianRupee } from "lucide-react";
import type { RestaurantNode } from "./Subcriptiontypes";
import { parseRevenue, formatCurrency } from "../../utils/Subscriptionutils";
import { apiClient } from "../../../../shared/services/apiClient";

interface MrrModalProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode: boolean;
  restaurants: RestaurantNode[];
  dbPlans: any[];
}

export default function MrrModal({
  isOpen,
  onClose,
  darkMode,
  restaurants,
  dbPlans,
}: MrrModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRestaurant, setSelectedRestaurant] = useState<RestaurantNode | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyData, setHistoryData] = useState<{ subscription?: any; payments?: any[] } | null>(null);

  // Clear selections when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedRestaurant(null);
      setHistoryData(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Plan price mapping
  const planPrices: Record<string, number> = {};
  dbPlans.forEach((plan) => {
    const key = (plan.name || "").toLowerCase();
    if (key === "free") {
      planPrices["basic"] = plan.priceMonthly || 0;
      planPrices["free"] = plan.priceMonthly || 0;
    } else {
      planPrices[key] = plan.priceMonthly || 0;
    }
  });

  const getMonthlyPrice = (planName: string) => {
    const key = (planName || "").toLowerCase();
    if (planPrices[key] !== undefined) return planPrices[key];
    switch (key) {
      case "free":
      case "basic":
      case "basic plan":
        return 0;
      case "starter":
        return 299;
      case "standard":
        return 599;
      case "premium":
      case "pro":
        return 999;
      case "enterprise":
        return 1999;
      default:
        return 0;
    }
  };

  // Filtered restaurants for search
  const filtered = restaurants.filter((r) => {
    const q = searchQuery.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.owner.toLowerCase().includes(q) ||
      r.plan.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q)
    );
  });

  // Calculate totals (only summing actual monthly subscription price)
  const totalMrr = restaurants.reduce((sum, r) => {
    if (r.status === "Active") {
      return sum + (r.mrr !== undefined ? r.mrr : getMonthlyPrice(r.plan));
    }
    return sum;
  }, 0);

  const activeCount = restaurants.filter((r) => r.status === "Active").length;
  const avgMrrPerRestaurant = activeCount > 0 ? totalMrr / activeCount : 0;

  const handleSelectRestaurant = async (r: RestaurantNode) => {
    if (selectedRestaurant?.id === r.id) {
      setSelectedRestaurant(null);
      setHistoryData(null);
      return;
    }
    setSelectedRestaurant(r);
    setHistoryLoading(true);
    try {
      const res = await apiClient.get(`/superadmin/restaurants/${r.id}`);
      setHistoryData(res.data?.data || res.data || null);
    } catch (err) {
      console.error("Failed to load subscription history", err);
      setHistoryData(null);
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 sm:pt-12 pb-6 px-4 overflow-y-auto bg-black/50 backdrop-blur-sm animate-fadeIn">
      {/* Modal Container */}
      <div
        className={`w-full max-w-5xl max-h-[88vh] overflow-y-auto rounded-2xl border p-6 shadow-2xl flex flex-col ${
          darkMode
            ? "bg-slate-950 border-slate-800 text-slate-100"
            : "bg-white border-slate-200 text-slate-900"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-4 mb-5 border-slate-800/10 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
              <TrendingUp size={20} />
            </div>
            <div>
              <h2 className="text-base font-extrabold tracking-tight">Platform MRR Breakdown</h2>
              <p className="text-[11px] text-slate-400 mt-0.5 font-medium">
                Monthly Recurring Revenue per active restaurant account with payment and status history.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg border transition-all ${
              darkMode
                ? "border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                : "border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100"
            }`}
          >
            <X size={16} />
          </button>
        </div>

        {/* Summary Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5 shrink-0">
          <div
            className={`p-4 rounded-xl border ${
              darkMode ? "bg-slate-900/60 border-slate-800" : "bg-slate-50 border-slate-200"
            }`}
          >
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-450">Total Platform MRR</p>
            <p className="text-xl font-black text-emerald-500 mt-1">{formatCurrency(totalMrr)}</p>
            <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Active monthly recurring subscription fees</p>
          </div>

          <div
            className={`p-4 rounded-xl border ${
              darkMode ? "bg-slate-900/60 border-slate-800" : "bg-slate-50 border-slate-200"
            }`}
          >
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-450">Active Paying Restaurants</p>
            <p className="text-xl font-black text-blue-500 mt-1">{activeCount}</p>
            <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Out of {restaurants.length} total accounts</p>
          </div>

          <div
            className={`p-4 rounded-xl border ${
              darkMode ? "bg-slate-900/60 border-slate-800" : "bg-slate-50 border-slate-200"
            }`}
          >
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-450">Avg MRR / Restaurant</p>
            <p className="text-xl font-black text-orange-500 mt-1">{formatCurrency(avgMrrPerRestaurant)}</p>
            <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Average active plan contribution</p>
          </div>
        </div>

        {/* Main Split Layout */}
        <div className="flex-1 flex gap-5 min-h-0">
          {/* Left Panel: Restaurants MRR List */}
          <div className={`flex flex-col min-h-0 transition-all duration-300 ${selectedRestaurant ? "w-[55%]" : "w-full"}`}>
            {/* Search bar */}
            <div className="relative mb-4 shrink-0">
              <Search
                className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${
                  darkMode ? "text-slate-500" : "text-slate-400"
                }`}
              />
              <input
                type="text"
                placeholder="Search restaurant by name, owner, plan, or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full h-9 pl-10 pr-4 rounded-xl text-xs font-medium outline-none border transition-all ${
                  darkMode
                    ? "bg-slate-900/80 border-slate-800 text-white focus:border-emerald-500/60"
                    : "bg-slate-50 border-slate-200 text-slate-800 focus:border-emerald-400"
                }`}
              />
            </div>

            {/* Restaurant MRR Table */}
            <div className="flex-1 overflow-y-auto rounded-xl border divide-y dark:divide-slate-800/60 dark:border-slate-800 border-slate-200">
              <div
                className={`grid grid-cols-12 px-4 py-2 text-[10px] font-bold uppercase tracking-wider sticky top-0 z-10 ${
                  darkMode ? "bg-slate-900 text-slate-400" : "bg-slate-100 text-slate-500"
                }`}
              >
                <div className="col-span-5">Restaurant</div>
                <div className="col-span-4">Plan Tier</div>
                <div className="col-span-3 text-right">Monthly Fee</div>
              </div>

              {filtered.length > 0 ? (
                filtered.map((r) => {
                  const monthlyFee = r.mrr !== undefined ? r.mrr : getMonthlyPrice(r.plan);
                  const isSelected = selectedRestaurant?.id === r.id;

                  return (
                    <button
                      type="button"
                      key={r.id}
                      onClick={() => handleSelectRestaurant(r)}
                      className={`w-full grid grid-cols-12 items-center px-4 py-2.5 text-xs text-left border-0 transition-colors ${
                        isSelected
                          ? darkMode
                            ? "bg-orange-950/20 text-orange-400"
                            : "bg-orange-50 text-orange-600"
                          : darkMode
                          ? "hover:bg-slate-900/40 text-slate-200"
                          : "hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <div className="col-span-5 flex items-center gap-2.5 min-w-0 pr-2">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                            isSelected
                              ? darkMode
                                ? "bg-orange-950/60 text-orange-400"
                                : "bg-orange-100 text-orange-600"
                              : darkMode
                              ? "bg-slate-800 text-slate-300"
                              : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          <Building2 size={13} />
                        </div>
                        <div className="min-w-0 truncate">
                          <p className="font-bold truncate leading-tight">{r.name}</p>
                          <p className="text-[9px] text-slate-400 truncate mt-0.5">{r.status} • {r.id}</p>
                        </div>
                      </div>

                      <div className="col-span-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                            r.plan === "Enterprise"
                              ? "bg-purple-500/10 border-purple-500/20 text-purple-400"
                              : r.plan === "Premium"
                              ? "bg-orange-500/10 border-orange-500/20 text-orange-400"
                              : r.plan === "Standard"
                              ? "bg-blue-500/10 border-blue-500/20 text-blue-400"
                              : "bg-slate-500/10 border-slate-500/20 text-slate-400"
                          }`}
                        >
                          <CreditCard size={10} />
                          {r.plan}
                        </span>
                      </div>

                      <div className="col-span-3 text-right">
                        <p className="font-extrabold text-emerald-500">
                          {formatCurrency(monthlyFee)}
                        </p>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">
                  No restaurants matching "{searchQuery}"
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: Subscription & Payment History */}
          {selectedRestaurant && (
            <div
              className={`w-[45%] flex flex-col border rounded-xl p-4 min-h-0 overflow-y-auto ${
                darkMode ? "bg-slate-900/30 border-slate-800/80" : "bg-slate-50/50 border-slate-200"
              }`}
            >
              {historyLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center py-12 text-slate-400 text-xs font-semibold animate-pulse gap-2">
                  <RefreshCw size={18} className="animate-spin text-orange-500" />
                  <span>Loading history...</span>
                </div>
              ) : (
                <div className="flex flex-col h-full space-y-4">
                  {/* Selected Restaurant Info Header */}
                  <div className="border-b pb-3 border-slate-850 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Subscription History</h4>
                      <button
                        onClick={() => setSelectedRestaurant(null)}
                        className="text-slate-400 hover:text-slate-200 text-[10px] font-bold"
                      >
                        Clear
                      </button>
                    </div>
                    <p className="text-sm font-black mt-1">{selectedRestaurant.name}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Owner: {selectedRestaurant.owner} ({selectedRestaurant.email})</p>
                  </div>

                  {/* Active Subscription Details */}
                  {historyData?.subscription ? (
                    <div className={`p-3.5 rounded-xl border ${
                      darkMode ? "bg-slate-950/40 border-slate-800" : "bg-white border-slate-200"
                    } space-y-2.5`}>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Current Period Mode</span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                          historyData.subscription.isTrial
                            ? "bg-amber-500/10 text-amber-400"
                            : "bg-emerald-500/10 text-emerald-400"
                        }`}>
                          {historyData.subscription.isTrial ? "Trial Mode" : "Ongoing Mode"}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div>
                          <p className="text-slate-500 font-medium">Plan Started</p>
                          <p className="font-semibold text-slate-350 dark:text-slate-200 mt-0.5">
                            {new Date(historyData.subscription.startedAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500 font-medium">Period End</p>
                          <p className="font-semibold text-slate-350 dark:text-slate-200 mt-0.5">
                            {new Date(historyData.subscription.currentPeriodEnd).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-500 italic p-3 text-center border border-dashed rounded-xl dark:border-slate-800">
                      No active subscription record found in database.
                    </div>
                  )}

                  {/* Payments & Transitions History */}
                  <div className="flex-1 flex flex-col min-h-0">
                    <h5 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                      <Calendar size={11} className="text-orange-500" />
                      Payment & Change Logs
                    </h5>

                    <div className="flex-1 overflow-y-auto space-y-2 pr-1 sd-no-scrollbar">
                      {historyData?.payments && historyData.payments.length > 0 ? (
                        historyData.payments.map((pay: any) => {
                          // Check if payment is ongoing or upcoming
                          const payDate = new Date(pay.paidAt || pay.createdAt);
                          const isOngoing = pay.status === 'completed' && new Date() >= payDate;
                          const isUpcoming = pay.status === 'pending' || payDate > new Date();

                          let statusLabel = "Paid";
                          let statusColor = "bg-emerald-500/10 text-emerald-400";
                          if (isUpcoming) {
                            statusLabel = "Upcoming";
                            statusColor = "bg-blue-500/10 text-blue-400";
                          } else if (isOngoing) {
                            statusLabel = "Ongoing";
                            statusColor = "bg-purple-500/10 text-purple-400";
                          }

                          return (
                            <div
                              key={pay._id || pay.id}
                              className={`p-2.5 rounded-xl border text-[11px] ${
                                darkMode ? "bg-slate-950/20 border-slate-800/80" : "bg-white border-slate-200"
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="font-bold text-slate-300 dark:text-white">
                                  {pay.metadata?.newPlan ? `Plan Changed to ${pay.metadata.newPlan}` : "Manual Seeding"}
                                </span>
                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${statusColor}`}>
                                  {statusLabel}
                                </span>
                              </div>

                              <div className="flex items-center justify-between text-[10px] text-slate-405 mt-1 font-medium">
                                <span className="flex items-center gap-0.5 text-emerald-500 font-extrabold">
                                  <IndianRupee size={9} />
                                  {pay.amount?.toLocaleString('en-IN') || 0}
                                </span>
                                <span>{payDate.toLocaleDateString()}</span>
                              </div>

                              {pay.metadata?.oldPlan && (
                                <p className="text-[9px] text-slate-500 mt-1 italic">
                                  Transition: {pay.metadata.oldPlan} ➔ {pay.metadata.newPlan}
                                </p>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-[10px] text-slate-500 italic py-6 text-center">
                          No past payments found for this account.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
