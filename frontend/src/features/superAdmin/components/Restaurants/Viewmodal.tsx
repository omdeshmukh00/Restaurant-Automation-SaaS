import { useState, useEffect } from "react";
import { X, Mail, Phone, MapPin, CreditCard, Building2, Calendar, ShieldAlert, SlidersHorizontal } from "lucide-react";
import { apiClient } from "../../../../shared/services/apiClient";

interface ViewModalProps {
  restaurant: any;
  darkMode: boolean;
  onClose: () => void;
}

export default function ViewModal({ restaurant, darkMode, onClose }: ViewModalProps) {
  // Extract onboarding request details if populated
  const requestInfo = restaurant?.onboardingRequestId || {};
  const isPopulated = !!restaurant?.onboardingRequestId;

  // Fields fallback logic
  const owner = restaurant.ownerName || restaurant.owner || "N/A";
  const cuisine = restaurant.cuisine || "N/A";
  const branches = restaurant.branches || 1;
  const expectedOrders = restaurant.expectedMonthlyOrders || 0;
  const gst = restaurant.gstNumber || "None Provided";

  const email = restaurant.email || "N/A";
  const phone = restaurant.phone || "N/A";

  const streetAddress = restaurant.address || "N/A";
  const city = restaurant.city || "N/A";
  const state = restaurant.state || "N/A";
  const pinCode = restaurant.pinCode || "N/A";
  const coords = restaurant.latitude !== undefined && restaurant.longitude !== undefined
    ? `${Number(restaurant.latitude).toFixed(5)}, ${Number(restaurant.longitude).toFixed(5)}`
    : "N/A";
  const mapUrl = restaurant.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${restaurant.latitude},${restaurant.longitude}`;

  const paymentId = requestInfo.paymentId || "N/A";
  const paymentAmount = requestInfo.paymentAmount || 0;
  const paymentStatus = requestInfo.paymentStatus || "N/A";

  // Formatted date
  const submittedDate = restaurant.createdAt || requestInfo.submittedAt;
  const formattedDate = submittedDate
    ? new Date(submittedDate).toLocaleString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "N/A";

  const [usageDashboard, setUsageDashboard] = useState<any>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);

  useEffect(() => {
    const restaurantId = restaurant._id || restaurant.id;
    if (restaurantId) {
      setLoadingUsage(true);
      apiClient.get(`/subscriptions/usage-dashboard?restaurantId=${restaurantId}`)
        .then(res => {
          if (res.data && res.data.data) {
            setUsageDashboard(res.data.data);
          }
        })
        .catch(err => console.error("Failed to fetch subscription usage dashboard", err))
        .finally(() => setLoadingUsage(false));
    }
  }, [restaurant]);

  const getProgressBarColor = (percent: number) => {
    if (percent >= 100) return "bg-red-500";
    if (percent >= 80) return "bg-orange-500";
    if (percent >= 50) return "bg-amber-500";
    return "bg-emerald-500";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 sm:pt-12 pb-6 px-4 overflow-y-auto bg-black/50 backdrop-blur-sm animate-fadeIn">
      {/* Backdrop listener to close when clicking outside */}
      <button
        type="button"
        className="fixed inset-0 -z-10 bg-transparent border-0 outline-none appearance-none cursor-default"
        onClick={onClose}
        aria-label="Close backdrop overlay"
      />

      <div className={`w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-2xl border shadow-2xl relative ${
        darkMode ? "bg-slate-950 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-900"
      }`}>
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className={`absolute right-4 top-4 p-2 rounded-full transition-colors z-10 ${
            darkMode ? "hover:bg-slate-900 text-slate-400 hover:text-slate-200" : "hover:bg-slate-50 text-slate-400 hover:text-slate-700"
          }`}
          aria-label="Close modal"
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div className="p-6 pb-4 border-b border-slate-100 dark:border-slate-905 border-slate-100/10">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider bg-orange-500/10 text-orange-500 uppercase">
            {usageDashboard?.planName ? `${usageDashboard.planName} Plan` : "Paid Onboarding Plan"}
          </span>
          <h2 className="text-2xl font-bold tracking-tight mt-2 text-slate-900 dark:text-white">
            {restaurant.name || "Restaurant Details"}
          </h2>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
            <Calendar size={12} />
            Submitted: {formattedDate}
          </p>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          
          {/* USAGE TELEMETRY METERS */}
          <div className={`rounded-2xl border p-4 space-y-3.5 ${
            darkMode ? "bg-slate-900/30 border-slate-900" : "bg-slate-50/50 border-slate-100"
          }`}>
            <h3 className="text-[10px] font-bold text-orange-500 uppercase tracking-widest flex items-center gap-1.5">
              <SlidersHorizontal size={12} />
              Plan Limits & Current Usage
            </h3>
            {loadingUsage && (
              <div className="text-xs text-slate-400 animate-pulse py-2 flex items-center gap-2">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-orange-500" />
                Loading usage telemetry meters...
              </div>
            )}
            {!loadingUsage && usageDashboard && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {usageDashboard.quotas.map((quota: any) => {
                  const hasLimit = quota.limit !== null;
                  return (
                    <div key={quota.key} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-600 dark:text-slate-350">{quota.label}</span>
                        <span className="text-slate-500 dark:text-slate-400 font-mono">
                          {quota.used} / {hasLimit ? quota.limit : "∞"}
                        </span>
                      </div>
                      <div className={`h-2 rounded-full overflow-hidden ${darkMode ? "bg-slate-800" : "bg-slate-200"}`}>
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${getProgressBarColor(quota.percent)}`}
                          style={{ width: `${hasLimit ? quota.percent : 100}%`, opacity: hasLimit ? 1 : 0.4 }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          {/* BUSINESS INFORMATION CARD */}
          <div className={`rounded-2xl border p-4 space-y-3.5 ${
            darkMode ? "bg-slate-900/30 border-slate-900" : "bg-slate-50/50 border-slate-100"
          }`}>
            <h3 className="text-[10px] font-bold text-orange-500 uppercase tracking-widest flex items-center gap-1.5">
              <Building2 size={12} />
              Business Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Owner Name</p>
                <p className="text-xs font-bold text-slate-850 dark:text-slate-200 mt-0.5">{owner}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Cuisine Category</p>
                <p className="text-xs font-bold text-slate-850 dark:text-slate-200 mt-0.5">{cuisine}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Total Branches</p>
                <p className="text-xs font-bold text-slate-850 dark:text-slate-200 mt-0.5">{branches} outlet(s)</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Expected Monthly Orders</p>
                <p className="text-xs font-bold text-slate-850 dark:text-slate-200 mt-0.5">{expectedOrders}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">GST Number</p>
                <p className="text-xs font-mono font-bold text-slate-850 dark:text-slate-200 mt-0.5">{gst}</p>
              </div>
            </div>
          </div>

          {/* CONTACT DETAILS CARD */}
          <div className={`rounded-2xl border p-4 space-y-3.5 ${
            darkMode ? "bg-slate-900/30 border-slate-900" : "bg-slate-50/50 border-slate-100"
          }`}>
            <h3 className="text-[10px] font-bold text-orange-500 uppercase tracking-widest flex items-center gap-1.5">
              <Mail size={12} />
              Contact Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Email Address</p>
                <p className="text-xs font-bold text-slate-850 dark:text-slate-200 mt-0.5 flex items-center gap-1.5">
                  <Mail size={11} className="text-slate-400 shrink-0" />
                  {email}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Phone Number</p>
                <p className="text-xs font-bold text-slate-850 dark:text-slate-200 mt-0.5 flex items-center gap-1.5">
                  <Phone size={11} className="text-slate-400 shrink-0" />
                  {phone}
                </p>
              </div>
            </div>
          </div>

          {/* ADDRESS & LOCATION CARD */}
          <div className={`rounded-2xl border p-4 space-y-3.5 ${
            darkMode ? "bg-slate-900/30 border-slate-900" : "bg-slate-50/50 border-slate-100"
          }`}>
            <h3 className="text-[10px] font-bold text-orange-500 uppercase tracking-widest flex items-center gap-1.5">
              <MapPin size={12} />
              Address & Location
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-3">
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Street Address</p>
                <p className="text-xs font-bold text-slate-850 dark:text-slate-200 mt-0.5">{streetAddress}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">City</p>
                <p className="text-xs font-bold text-slate-850 dark:text-slate-200 mt-0.5">{city}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">State</p>
                <p className="text-xs font-bold text-slate-850 dark:text-slate-200 mt-0.5">{state}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">PIN Code</p>
                <p className="text-xs font-bold text-slate-850 dark:text-slate-200 mt-0.5">{pinCode}</p>
              </div>
              <div className="sm:col-span-3 pt-2 border-t border-slate-100 dark:border-slate-900 flex items-center justify-between gap-4">
                <div className="text-[10px] text-slate-400">
                  <span className="font-semibold uppercase tracking-wider block">Coords</span>
                  <span className="font-mono mt-0.5 block">{coords}</span>
                </div>
                {restaurant.latitude && (
                  <a
                    href={mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-bold text-orange-500 hover:text-orange-600 transition-colors flex items-center gap-1 shrink-0"
                  >
                    Open Google Maps <span className="text-[10px]">↗</span>
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* BILLING & PAYMENT INFO CARD */}
          <div className={`rounded-2xl border p-4 space-y-3.5 ${
            darkMode ? "bg-slate-900/30 border-slate-900" : "bg-slate-50/50 border-slate-100"
          }`}>
            <h3 className="text-[10px] font-bold text-orange-500 uppercase tracking-widest flex items-center gap-1.5">
              <CreditCard size={12} />
              Billing & Payment Info
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Payment ID</p>
                <p className="text-xs font-mono font-bold text-slate-850 dark:text-slate-200 mt-0.5">{paymentId}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Amount Paid</p>
                <p className="text-xs font-extrabold text-emerald-500 mt-0.5">₹{paymentAmount}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Payment Status</p>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold mt-1 uppercase ${
                  paymentStatus === 'CAPTURED' || paymentStatus === 'SUCCESS'
                    ? "bg-emerald-500/10 text-emerald-500"
                    : "bg-slate-500/10 text-slate-400"
                }`}>
                  {paymentStatus}
                </span>
              </div>
            </div>
          </div>

          {/* Suspension Reason Card (If active is suspended) */}
          {restaurant.status === 'Inactive' && restaurant.blockReason && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 space-y-2">
              <h3 className="text-[10px] font-bold text-red-500 uppercase tracking-widest flex items-center gap-1.5">
                <ShieldAlert size={12} />
                Suspension Details
              </h3>
              <div>
                <p className="text-[10px] text-red-400/80 font-semibold uppercase tracking-wider">Reason for Block</p>
                <p className="text-xs font-medium text-red-700 dark:text-red-300 mt-0.5">{restaurant.blockReason}</p>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}