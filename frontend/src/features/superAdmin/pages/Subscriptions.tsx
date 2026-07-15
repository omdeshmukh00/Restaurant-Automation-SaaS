// pages/Subscriptions.tsx
// Main orchestrator — all state lives here; components are pure/presentational.

import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, Trash, Plus, Sparkles, Building2, X, CreditCard, RefreshCw, Percent } from "lucide-react";
import { apiClient } from "../../../shared/services/apiClient";

import type {
  RestaurantNode,
  StatusFilter,
  TierFilter,
  SortField,
  SortOrder,
  PlanType,
  StatusType,
} from "../components/Subscriptions/Subcriptiontypes";
import type { NewRestaurantForm } from "../components/Restaurants/Restauranttypes";

import { useRestaurantRequestsStore } from "../store/RestaurantRequests";
import { superAdminRestaurantRequestsApi } from "../api/superAdmin.api";
import { computeTierMetrics, exportToCSV, parseRevenue, generateId, formatCurrency } from "../utils/Subscriptionutils";

import TierCards from "../components/Subscriptions/Tiercards";
import SubscriptionControls from "../components/Subscriptions/Subscriptioncontrols";
import SubscriptionTable from "../components/Subscriptions/Subcriptiontable";
import ViewModal from "../components/Restaurants/Viewmodal";
import AddRestaurantModal from "../components/Restaurants/AddRestaurantModal";
import LiveActivityModal from "../components/Subscriptions/LiveActivityModal";

const EMPTY_FORM: NewRestaurantForm = {
  name: "",
  owner: "",
  email: "",
  phone: "",
  location: "",
  plan: "Basic",
  status: "Trial",
  revenue: "₹0",
  branches: 1,
  address: "",
  city: "",
  state: "",
  country: "India",
  pinCode: "",
  gstNumber: "",
  cuisine: "",
  expectedMonthlyOrders: 500,
  latitude: null,
  longitude: null,
  googleMapsUrl: "",
  message: "",
};

const PLAN_ORDER: Record<PlanType, number> = { Basic: 0, Standard: 1, Premium: 2, Enterprise: 3 };
const STATUS_ORDER: Record<StatusType, number> = { Active: 0, Trial: 1, Inactive: 2 };

export default function Subscriptions() {
  // ── Theme ─────────────────────────────────────────────────────────────────
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("theme");
      return saved ? saved === "dark" : false;
    }
    return false;
  });

  // ── Plan Pricing State ───────────────────────────────────────────────────
  const [planPrices, setPlanPrices] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('ra/subscription-prices');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return {
      Basic: 299,
      Standard: 599,
      Premium: 999,
      Enterprise: 1999,
    };
  });
  const [editingPlan, setEditingPlan] = useState<any | null>(null);
  const [dbPlans, setDbPlans] = useState<any[]>([]);
  const [isBulkOffersOpen, setIsBulkOffersOpen] = useState(false);
  const [bulkYearlyDiscount, setBulkYearlyDiscount] = useState<number>(20);
  const [bulkMonthlyDiscount, setBulkMonthlyDiscount] = useState<number>(0);
  const [bulkApplying, setBulkApplying] = useState(false);

  // Fetch plans from backend
  const fetchPlans = async () => {
    try {
      const response = await apiClient.get('/superadmin/plans');
      const plansList = response.data?.data?.plans || [];
      setDbPlans(plansList);

      const prices: Record<string, number> = {};
      plansList.forEach((plan: any) => {
        if (plan.name === 'Free') {
          prices['Basic'] = plan.priceMonthly;
        } else {
          prices[plan.name] = plan.priceMonthly;
        }
      });

      if (Object.keys(prices).length > 0) {
        setPlanPrices((prev) => {
          const merged = { ...prev, ...prices };
          localStorage.setItem('ra/subscription-prices', JSON.stringify(merged));
          return merged;
        });
      }
    } catch (error) {
      console.error('Failed to fetch plans from backend', error);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const handleEditPlanClick = (planName: string) => {
    const plan = dbPlans.find(p => p.name === planName);
    if (plan) {
      setEditingPlan({ ...plan });
    }
  };

  const handleSavePlan = async () => {
    if (!editingPlan) return;
    try {
      if (editingPlan.isNew) {
        await apiClient.post('/superadmin/plans', {
          name: editingPlan.name,
          priceMonthly: editingPlan.priceMonthly,
          originalPriceMonthly: editingPlan.originalPriceMonthly,
          yearlyDiscountPercentage: editingPlan.yearlyDiscountPercentage,
          tenantLimit: editingPlan.tenantLimit,
          staffLimit: editingPlan.staffLimit,
          isActive: editingPlan.isActive,
          features: editingPlan.features
        });
      } else {
        await apiClient.patch(`/superadmin/plans/${editingPlan._id}`, {
          name: editingPlan.name,
          priceMonthly: editingPlan.priceMonthly,
          originalPriceMonthly: editingPlan.originalPriceMonthly,
          yearlyDiscountPercentage: editingPlan.yearlyDiscountPercentage,
          tenantLimit: editingPlan.tenantLimit,
          staffLimit: editingPlan.staffLimit,
          isActive: editingPlan.isActive,
          features: editingPlan.features
        });
      }
      setEditingPlan(null);
      await fetchPlans();
    } catch (err) {
      console.error('Failed to save plan', err);
    }
  };

  const handleDeletePlan = async () => {
    if (!editingPlan || !editingPlan._id) return;
    if (window.confirm(`Are you sure you want to delete the ${editingPlan.name} plan?`)) {
      try {
        await apiClient.delete(`/superadmin/plans/${editingPlan._id}`);
        setEditingPlan(null);
        await fetchPlans();
      } catch (err) {
        console.error('Failed to delete plan', err);
      }
    }
  };

  // ── Modal state ───────────────────────────────────────────────────────────
  const [viewingNode, setViewingNode] = useState<any | null>(null);
  const [liveActivityRestaurant, setLiveActivityRestaurant] = useState<RestaurantNode | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isCommissionOpen, setIsCommissionOpen] = useState(false);
  const [formData, setFormData] = useState<NewRestaurantForm>(() => {
    try {
      const saved = sessionStorage.getItem("ra/subscription-add-restaurant-draft");
      return saved ? JSON.parse(saved) : EMPTY_FORM;
    } catch {
      return EMPTY_FORM;
    }
  });

  useEffect(() => {
    sessionStorage.setItem("ra/subscription-add-restaurant-draft", JSON.stringify(formData));
  }, [formData]);

  const handleViewRestaurant = async (row: RestaurantNode) => {
    try {
      const fullDetails = await superAdminRestaurantRequestsApi.getRestaurantById(row.id);
      setViewingNode(fullDetails || row);
    } catch (err) {
      console.error("Failed to load restaurant details", err);
      setViewingNode(row);
    }
  };

  const handleLiveActivity = (row: RestaurantNode) => {
    setLiveActivityRestaurant(row);
  };

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ darkMode: boolean }>;
      if (ce.detail !== undefined) setDarkMode(ce.detail.darkMode);
    };
    window.addEventListener("sync-app-theme", handler);
    return () => window.removeEventListener("sync-app-theme", handler);
  }, []);

  // Global Escape closes all modals
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { 
        setViewingNode(null); 
        setIsAddModalOpen(false); 
        setIsSettingsModalOpen(false);
        setIsCommissionOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── Data state ────────────────────────────────────────────────────────────
  const navigate = useNavigate();
  const [restaurants, setRestaurants] = useState<RestaurantNode[]>([]);
  const approvedRestaurants = useRestaurantRequestsStore((state) => state.restaurants);
  const requests = useRestaurantRequestsStore((state) => state.requests);
  const pendingCount = requests.filter(r => r.status === 'APPLICATION_PENDING' || r.status === 'PENDING_PAYMENT').length;
  const addRestaurant = useRestaurantRequestsStore((state) => state.addRestaurant);
  const updateApprovedRestaurantStatus = useRestaurantRequestsStore(
    (state) => state.updateRestaurantStatus
  );
  const updateApprovedRestaurantPlan = useRestaurantRequestsStore(
    (state) => state.updateRestaurantPlan
  );
  const deleteApprovedRestaurant = useRestaurantRequestsStore(
    (state) => state.deleteRestaurant
  );
  const fetchRequests = useRestaurantRequestsStore((state) => state.fetchRequests);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Platform Settings State
  const [platformSettings, setPlatformSettings] = useState({
    applicationFeeEnabled: false,
    applicationFeeAmount: 0,
    currency: "INR",
    refundPolicy: "refundable",
    enablePartnerRegistration: true,
    maxPendingApplications: 50,
    applicationExpiryDays: 30,
    platformCommissionRate: 10,
    totalRevenue: 0,
    history: [] as Array<{
      id: string;
      restaurantName: string;
      ownerName: string;
      amount: number;
      currency: string;
      paymentId: string;
      timestamp: string;
    }>
  });
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const fetchPlatformSettings = async () => {
    try {
      const res = await apiClient.get('/superadmin/platform-settings');
      if (res.data?.data) {
        setPlatformSettings(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch platform settings', err);
    } finally {
      setSettingsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlatformSettings();
  }, []);

  const handleSavePlatformSettings = async () => {
    try {
      const res = await apiClient.patch('/superadmin/platform-settings', {
        applicationFeeEnabled: platformSettings.applicationFeeEnabled,
        applicationFeeAmount: platformSettings.applicationFeeAmount,
        currency: platformSettings.currency,
        refundPolicy: platformSettings.refundPolicy,
        enablePartnerRegistration: platformSettings.enablePartnerRegistration,
        maxPendingApplications: platformSettings.maxPendingApplications,
        applicationExpiryDays: platformSettings.applicationExpiryDays,
        platformCommissionRate: platformSettings.platformCommissionRate,
      });
      if (res.data?.data) {
        setPlatformSettings(prev => ({
          ...prev,
          ...res.data.data
        }));
        setSettingsSaved(true);
        setTimeout(() => setSettingsSaved(false), 2000);
      }
    } catch (err) {
      console.error('Failed to save platform settings', err);
    }
  };

  // ── Filter state ──────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [tierFilter, setTierFilter] = useState<TierFilter>("All");

  // ── Sort state ────────────────────────────────────────────────────────────
  const [sortField, setSortField] = useState<SortField>("revenue");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortOrder((p) => (p === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortOrder("desc"); }
  };

  // ── CRUD handlers ─────────────────────────────────────────────────────────
  const updateStatus = (id: string, status: StatusType, blockReason?: string) => {
    updateApprovedRestaurantStatus(id, status as any, blockReason);
    setRestaurants((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  };

  const updatePlan = (id: string, plan: string) => {
    updateApprovedRestaurantPlan(id, plan);
    setRestaurants((prev) => prev.map((r) => (r.id === id ? { ...r, plan: plan as any } : r)));
  };

  const deleteNode = (id: string) => {
    deleteApprovedRestaurant(id);
    setRestaurants((prev) => prev.filter((r) => r.id !== id));
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.owner || !formData.email || !formData.phone) {
      window.alert("Please fill out all required fields.");
      return;
    }
    if (!formData.googleMapsUrl) {
      window.alert("Google Maps URL is required to extract coordinates.");
      return;
    }

    try {
      await addRestaurant({
        ...formData,
        location: `${formData.city || ""}, ${formData.state || ""}, ${formData.country || ""}`.replace(/,\s*,/g, ',').replace(/,\s*$/, '').trim()
      });
      setIsAddModalOpen(false);
      setFormData(EMPTY_FORM);
      sessionStorage.removeItem("ra/subscription-add-restaurant-draft");
    } catch (err: any) {
      console.error(err);
      let msg = err.response?.data?.error?.message || err.message || "Failed to register new restaurant.";
      const fields = err.response?.data?.error?.fields;
      if (fields) {
        const details = Object.entries(fields)
          .map(([field, msgs]: any) => `${field}: ${msgs.join(", ")}`)
          .join("\n");
        msg = `${msg}\n\n${details}`;
      }
      window.alert(msg);
    }
  };

  const handleResetAll = () => {
    setSearchQuery("");
    setStatusFilter("All");
    setTierFilter("All");
  };

  // ── Derived data ──────────────────────────────────────────────────────────
  const linkedRestaurants = useMemo<RestaurantNode[]>(() => {
    const existingKeys = new Set(
      restaurants.flatMap((restaurant) => [
        restaurant.id.toLowerCase(),
        restaurant.name.toLowerCase(),
      ])
    );

    const approvedSubscriptionRows = approvedRestaurants
      .filter(
        (restaurant) =>
          !existingKeys.has(restaurant.id.toLowerCase()) &&
          !existingKeys.has(restaurant.name.toLowerCase())
      )
      .map<RestaurantNode>((restaurant) => ({
        id: restaurant.id,
        name: restaurant.name,
        owner: restaurant.owner,
        email: restaurant.email,
        phone: restaurant.phone,
        location: restaurant.location,
        plan: restaurant.plan,
        status: restaurant.status,
        revenue: restaurant.revenue,
        branches: restaurant.branches,
        joinedDate: restaurant.joinedDate || new Date().toISOString().slice(0, 10),
        lastActive: restaurant.lastActive || new Date().toISOString().slice(0, 10),
        tags: restaurant.tags || [],
        cooldownRemaining: restaurant.cooldownRemaining,
      }));

    return [...approvedSubscriptionRows, ...restaurants];
  }, [approvedRestaurants, restaurants]);

  const tierMetrics = useMemo(() => computeTierMetrics(linkedRestaurants), [linkedRestaurants]);

  const dynamicTierMetrics = useMemo(() => {
    return dbPlans.map(plan => {
      const matchingRestaurants = linkedRestaurants.filter(
        r => r.plan.toLowerCase() === plan.name.toLowerCase() || (plan.name === 'Free' && r.plan === 'Basic')
      );
      const revenue = matchingRestaurants.reduce((acc, r) => acc + parseRevenue(r.revenue), 0);
      return {
        name: plan.name,
        price: plan.priceMonthly,
        isActive: plan.isActive,
        count: matchingRestaurants.length,
        revenue,
        formattedRevenue: formatCurrency(revenue),
        activeCount: matchingRestaurants.filter(r => r.status === 'Active').length,
        trialCount: matchingRestaurants.filter(r => r.status === 'Trial').length,
        yearlyDiscountPercentage: plan.yearlyDiscountPercentage,
      };
    });
  }, [dbPlans, linkedRestaurants]);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return linkedRestaurants.filter((r) => {
      const matchSearch =
        r.name.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q) ||
        r.owner.toLowerCase().includes(q) ||
        r.location.toLowerCase().includes(q);
      const matchStatus = statusFilter === "All" || r.status === statusFilter;
      const matchTier = tierFilter === "All" || r.plan === tierFilter;
      return matchSearch && matchStatus && matchTier;
    });
  }, [linkedRestaurants, searchQuery, statusFilter, tierFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const dir = sortOrder === "asc" ? 1 : -1;
      switch (sortField) {
        case "name":     return dir * a.name.localeCompare(b.name);
        case "revenue":  return dir * (parseRevenue(a.revenue) - parseRevenue(b.revenue));
        case "branches": return dir * (a.branches - b.branches);
        case "plan":     return dir * (PLAN_ORDER[a.plan] - PLAN_ORDER[b.plan]);
        case "status":   return dir * (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
        default:         return 0;
      }
    });
  }, [filtered, sortField, sortOrder]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={`min-h-screen px-6 py-8 transition-colors duration-300 ${
      darkMode ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-800"
    }`}>

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-7">
        <div>
          <h1 className={`text-2xl font-extrabold tracking-tight ${darkMode ? "text-white" : "text-slate-900"}`}>
            Subscriptions
          </h1>
          <p className={`text-sm mt-0.5 ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
            Manage restaurant accounts, plans, and billing across the platform.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsBulkOffersOpen(true)}
            className={`py-2 px-3.5 rounded-xl border text-[11px] font-bold hover:bg-orange-500 hover:text-white hover:border-orange-500 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              darkMode
                ? 'bg-slate-900/50 border-slate-800 text-slate-300'
                : 'bg-white border-slate-200 text-slate-700 shadow-sm'
            }`}
          >
            <Sparkles size={13} className="text-orange-500" />
            Bulk Offers
          </button>

          <button
            onClick={() => setIsCommissionOpen(true)}
            className={`py-2 px-3.5 rounded-xl border text-[11px] font-bold hover:bg-orange-500 hover:text-white hover:border-orange-500 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              darkMode
                ? 'bg-slate-900/50 border-slate-800 text-slate-300'
                : 'bg-white border-slate-200 text-slate-700 shadow-sm'
            }`}
          >
            <Percent size={13} className="text-orange-500" />
            Commission [{platformSettings.platformCommissionRate ?? 10}%]
          </button>

          <button
            onClick={() => navigate('/superadmin?requests=new')}
            className={`py-2 px-3.5 rounded-xl border text-[11px] font-bold hover:bg-orange-500 hover:text-white hover:border-orange-500 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              darkMode
                ? 'bg-slate-900/50 border-slate-800 text-slate-300'
                : 'bg-white border-slate-200 text-slate-700 shadow-sm'
            }`}
          >
            <Building2 size={13} />
            New Requests
            {pendingCount > 0 && (
              <span className="ml-1 min-w-4 h-4 px-1 rounded-full bg-orange-600 text-white text-[9px] flex items-center justify-center font-bold">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setIsSettingsModalOpen(true)}
            className={`py-2 px-3.5 rounded-xl border text-[11px] font-bold hover:bg-emerald-500 hover:text-white hover:border-emerald-500 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              darkMode
                ? 'bg-slate-900/50 border-slate-800 text-slate-300'
                : 'bg-white border-slate-200 text-slate-700 shadow-sm'
            }`}
          >
            <CreditCard size={13} />
            Processing Fee
            {platformSettings.applicationFeeEnabled && (
              <span className="ml-1 min-w-4 h-4 px-1 rounded-full bg-emerald-600 text-white text-[9px] flex items-center justify-center font-bold">
                ₹{platformSettings.applicationFeeAmount}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setEditingPlan({
                name: '',
                priceMonthly: 0,
                originalPriceMonthly: null,
                yearlyDiscountPercentage: 20,
                tenantLimit: 1,
                staffLimit: 5,
                isActive: true,
                features: [],
                isNew: true
              });
            }}
            className={`py-2 px-3.5 rounded-xl border text-[11px] font-bold hover:bg-orange-500 hover:text-white hover:border-orange-500 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              darkMode
                ? 'bg-slate-900/50 border-slate-800 text-slate-300'
                : 'bg-white border-slate-200 text-slate-700 shadow-sm'
            }`}
          >
            <Plus size={13} />
            Add New Plan
          </button>

          <div className={`flex items-center gap-2.5 px-4 py-2 rounded-xl border text-xs font-semibold shrink-0 whitespace-nowrap ${
            darkMode ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200 shadow-sm"
          }`}>
            <BarChart3 size={15} className="text-orange-500" />
            <span className={darkMode ? "text-slate-400" : "text-slate-500"}>Platform MRR</span>
            <span className="text-emerald-500 font-extrabold text-sm">
              {formatCurrency(tierMetrics.totalRevenue)}
            </span>
          </div>
        </div>
      </div>

      {/* Tier Cards */}
      <TierCards
        plans={dynamicTierMetrics}
        tierFilter={tierFilter}
        darkMode={darkMode}
        onTierChange={(tier) => setTierFilter(tier as TierFilter)}
        onEditClick={handleEditPlanClick}
      />

      {/* Controls */}
      <SubscriptionControls
        searchQuery={searchQuery}
        statusFilter={statusFilter}
        tierFilter={tierFilter}
        sortField={sortField}
        sortOrder={sortOrder}
        darkMode={darkMode}
        totalCount={linkedRestaurants.length}
        filteredCount={filtered.length}
        onSearchChange={setSearchQuery}
        onStatusChange={setStatusFilter}
        onSortChange={handleSort}
        onExport={() => exportToCSV(sorted)}
        onResetAll={handleResetAll}
        onAddClick={() => {
          const activePlans = dbPlans.filter((p: any) => p.isActive !== false);
          const defaultPlan = activePlans.length > 0 ? activePlans[0].name : "Basic";
          setFormData({ ...EMPTY_FORM, plan: defaultPlan });
          setIsAddModalOpen(true);
        }}
      />

      {/* Table */}
      <SubscriptionTable
        restaurants={sorted}
        darkMode={darkMode}
        searchQuery={searchQuery}
        statusFilter={statusFilter}
        tierFilter={tierFilter}
        onView={handleViewRestaurant}
        onLiveActivity={handleLiveActivity}
        onUpdateStatus={updateStatus}
        onUpdatePlan={updatePlan}
        onDelete={deleteNode}
        plans={dbPlans}
        onResetFilters={handleResetAll}
      />

      {/* Summary footer */}
      <div className={`mt-4 px-5 py-3 rounded-xl border flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs ${
        darkMode ? "bg-slate-900/30 border-slate-800/80" : "bg-slate-50 border-slate-200/60"
      }`}>
        <span className={darkMode ? "text-slate-400" : "text-slate-500"}>
          Showing <span className={`font-bold ${darkMode ? "text-slate-100" : "text-slate-900"}`}>{sorted.length}</span> of{" "}
          <span className={`font-bold ${darkMode ? "text-slate-100" : "text-slate-900"}`}>{linkedRestaurants.length}</span> restaurants
        </span>
        <div className={`h-4 w-px ${darkMode ? "bg-slate-800" : "bg-slate-300"}`} />
        <span className={darkMode ? "text-slate-400" : "text-slate-500"}>
          <span className="font-bold text-emerald-500">{filtered.filter(r => r.status === "Active").length}</span> active ·{" "}
          <span className="font-bold text-amber-500">{filtered.filter(r => r.status === "Trial").length}</span> trial ·{" "}
          <span className={`font-bold ${darkMode ? "text-slate-500" : "text-slate-400"}`}>{filtered.filter(r => r.status === "Inactive").length}</span> inactive
        </span>
        <div className={`h-4 w-px ${darkMode ? "bg-slate-800" : "bg-slate-300"}`} />
        <span className={darkMode ? "text-slate-400" : "text-slate-500"}>
          Revenue in view: <span className="font-bold text-blue-500">
            {formatCurrency(filtered.reduce((s, r) => s + parseRevenue(r.revenue), 0))}
          </span>
        </span>
      </div>

      {/* Platform Settings Modal */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
          {/* Backdrop */}
          <button 
            type="button" 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-0" 
            onClick={() => setIsSettingsModalOpen(false)} 
            aria-label="Close modal"
          />
          
          {/* Modal Container */}
          <div className={`w-full max-w-4xl rounded-2xl border p-6 shadow-2xl z-10 max-h-[90vh] overflow-y-auto ${
            darkMode ? "bg-slate-950 border-slate-800 text-white shadow-black/85" : "bg-white border-slate-200 text-slate-800 shadow-slate-300/40"
          }`}>
            <div className="flex items-center justify-between border-b pb-4 mb-6 border-slate-800/10 dark:border-slate-800">
              <div>
                <h2 className="text-base font-bold">Platform Settings & Onboarding Fee</h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Configure global partner application fees, refund policies, and view onboarding revenue.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {settingsSaved && (
                  <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full animate-pulse">
                    Settings Saved!
                  </span>
                )}
                <button
                  onClick={() => setIsSettingsModalOpen(false)}
                  className={`p-1.5 rounded-lg border hover:bg-slate-500/5 transition-all ${
                    darkMode ? "border-slate-800 text-slate-400 hover:text-slate-200" : "border-slate-200 text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Config column */}
              <div className="space-y-4 text-xs">
                <div className="flex items-center justify-between py-2 border-b border-slate-800/5">
                  <div>
                    <p className="font-bold">Enable Application Processing Fee</p>
                    <p className="text-[10px] text-slate-500">Require paid review fee before a partner can submit their application.</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={platformSettings.applicationFeeEnabled}
                    onClick={() => setPlatformSettings(prev => ({ ...prev, applicationFeeEnabled: !prev.applicationFeeEnabled }))}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:ring-offset-2 ${
                      platformSettings.applicationFeeEnabled
                        ? 'bg-orange-500'
                        : darkMode ? 'bg-slate-700' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        platformSettings.applicationFeeEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Fee Amount</label>
                    <input
                      type="number"
                      min="0"
                      value={platformSettings.applicationFeeAmount}
                      onChange={(e) => setPlatformSettings(prev => ({ ...prev, applicationFeeAmount: Number(e.target.value) }))}
                      className={`w-full h-9 rounded-xl border px-3 text-xs outline-none focus:border-orange-500 ${
                        darkMode ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-slate-800"
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Currency</label>
                    <select
                      value={platformSettings.currency}
                      onChange={(e) => setPlatformSettings(prev => ({ ...prev, currency: e.target.value }))}
                      className={`w-full h-9 rounded-xl border px-3 text-xs outline-none focus:border-orange-500 ${
                        darkMode ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-slate-800"
                      }`}
                    >
                      <option value="INR">INR — Indian Rupee (₹)</option>
                      <option value="USD">USD — US Dollar ($)</option>
                      <option value="EUR">EUR — Euro (€)</option>
                      <option value="GBP">GBP — British Pound (£)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Refund Policy</label>
                    <select
                      value={platformSettings.refundPolicy}
                      onChange={(e) => setPlatformSettings(prev => ({ ...prev, refundPolicy: e.target.value }))}
                      className={`w-full h-9 rounded-xl border px-3 text-xs outline-none focus:border-orange-500 ${
                        darkMode ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-slate-800"
                      }`}
                    >
                      <option value="refundable">Refundable upon rejection</option>
                      <option value="non-refundable">Non-Refundable</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Max Pending Requests</label>
                    <input
                      type="number"
                      min="1"
                      value={platformSettings.maxPendingApplications}
                      onChange={(e) => setPlatformSettings(prev => ({ ...prev, maxPendingApplications: Number(e.target.value) }))}
                      className={`w-full h-9 rounded-xl border px-3 text-xs outline-none focus:border-orange-500 ${
                        darkMode ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-slate-800"
                      }`}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-slate-800/5">
                  <div>
                    <p className="font-bold">Allow Partner Self-Registration</p>
                    <p className="text-[10px] text-slate-500">Enable the public registration page for new partners.</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={platformSettings.enablePartnerRegistration}
                    onClick={() => setPlatformSettings(prev => ({ ...prev, enablePartnerRegistration: !prev.enablePartnerRegistration }))}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:ring-offset-2 ${
                      platformSettings.enablePartnerRegistration
                        ? 'bg-orange-500'
                        : darkMode ? 'bg-slate-700' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        platformSettings.enablePartnerRegistration ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <button
                  onClick={handleSavePlatformSettings}
                  className="py-2.5 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition-all shadow-md shadow-orange-600/10"
                >
                  Save Platform Settings
                </button>
              </div>

              {/* Revenue & history column */}
              <div className="space-y-4 text-xs border-t lg:border-t-0 lg:border-l pt-6 lg:pt-0 lg:pl-6 border-slate-800/10 dark:border-slate-800">
                <div>
                  <span className="text-slate-500 block uppercase tracking-wider text-[10px] font-bold mb-1">Total Onboarding Revenue</span>
                  <span className="text-xl font-extrabold text-emerald-500">
                    {platformSettings.currency === 'INR' ? '₹' : platformSettings.currency + ' '}{platformSettings.totalRevenue?.toLocaleString()}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 block uppercase tracking-wider text-[10px] font-bold mb-2">Collected Fee History</span>
                  {platformSettings.history && platformSettings.history.length > 0 ? (
                    <div className="max-h-52 overflow-y-auto border border-slate-800/10 dark:border-slate-850 rounded-xl">
                      <table className="w-full text-left text-[11px] border-collapse">
                        <thead>
                          <tr className={`border-b ${darkMode ? "bg-slate-950/60 border-slate-800/80" : "bg-slate-50 border-slate-200"}`}>
                            <th className="p-2 font-bold">Restaurant</th>
                            <th className="p-2 font-bold">Amount</th>
                            <th className="p-2 font-bold">Payment ID</th>
                            <th className="p-2 font-bold">Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {platformSettings.history.map(row => (
                            <tr key={row.id} className={`border-b ${darkMode ? "border-slate-800/50 hover:bg-slate-800/20" : "border-slate-100 hover:bg-slate-50"}`}>
                              <td className="p-2 font-semibold">{row.restaurantName}</td>
                              <td className="p-2 text-emerald-500 font-bold">
                                {row.currency === 'INR' ? '₹' : row.currency + ' '}{row.amount}
                              </td>
                              <td className="p-2 font-mono text-[9px]">{row.paymentId}</td>
                              <td className="p-2 text-slate-500">{new Date(row.timestamp).toLocaleDateString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-500 italic py-4">No processing fee payments recorded yet.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewingNode && (
        <ViewModal
          restaurant={viewingNode}
          darkMode={darkMode}
          onClose={() => setViewingNode(null)}
        />
      )}

      {/* Live Activity Modal */}
      {liveActivityRestaurant && (
        <LiveActivityModal
          restaurantId={liveActivityRestaurant.id}
          restaurantName={liveActivityRestaurant.name}
          darkMode={darkMode}
          onClose={() => setLiveActivityRestaurant(null)}
        />
      )}

      {/* Add Modal */}
      {isAddModalOpen && (
        <AddRestaurantModal
          darkMode={darkMode}
          formData={formData}
          plans={dbPlans}
          onChange={(partial) => setFormData((prev) => ({ ...prev, ...partial }))}
          onSubmit={handleAddSubmit}
          onClose={() => setIsAddModalOpen(false)}
          onClear={() => {
            setFormData(EMPTY_FORM);
            sessionStorage.removeItem("ra/subscription-add-restaurant-draft");
          }}
        />
      )}

      {/* Edit Plan Modal */}
      {editingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 p-4 animate-fade-in">
          <div className={`w-full max-w-lg rounded-3xl p-6 border shadow-2xl flex flex-col ${
            darkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-800'
          }`}>
            <div className="flex items-center justify-between border-b pb-4 mb-4 border-slate-800/10">
              <div>
                <h3 className="text-base font-bold">
                  {editingPlan.isNew ? 'Create Subscription Plan' : `Edit ${editingPlan.name} Plan`}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5 font-semibold">
                  Configure pricing, limits, and core features for this plan tier.
                </p>
              </div>
              <button
                onClick={() => setEditingPlan(null)}
                className={`p-1.5 rounded-lg transition-colors ${
                  darkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 flex-1 overflow-y-auto pr-1">
              {/* Plan Name & Active status */}
              <div className="flex gap-4 items-center">
                <div className="flex-1">
                  <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Plan Name</label>
                  <input
                    type="text"
                    disabled={!editingPlan.isNew && ['Free', 'Standard', 'Premium', 'Enterprise'].includes(editingPlan.name)}
                    value={editingPlan.name}
                    onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                    className={`w-full bg-transparent border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-orange-500 disabled:opacity-50 ${
                      darkMode ? 'border-slate-800 text-white bg-slate-950/45' : 'border-slate-200 text-slate-800 bg-slate-50/45'
                    }`}
                  />
                </div>
                <div className="pt-5 shrink-0">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-550 hover:text-orange-500 transition-colors">
                    <input
                      type="checkbox"
                      checked={editingPlan.isActive !== false}
                      onChange={(e) => setEditingPlan({ ...editingPlan, isActive: e.target.checked })}
                      className="rounded text-orange-500 focus:ring-orange-500 border-slate-350"
                    />
                    Active Plan
                  </label>
                </div>
              </div>

              {/* Pricing Row */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Monthly Price (₹)</label>
                  <input
                    type="number"
                    min="0"
                    disabled={editingPlan.name.toLowerCase() === 'free'}
                    value={editingPlan.priceMonthly}
                    onChange={(e) => setEditingPlan({ ...editingPlan, priceMonthly: parseInt(e.target.value) || 0 })}
                    className={`w-full bg-transparent border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-orange-500 disabled:opacity-50 ${
                      darkMode ? 'border-slate-800 text-white' : 'border-slate-200 text-slate-800'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Original Price (₹)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="No discount"
                    value={editingPlan.originalPriceMonthly || ''}
                    onChange={(e) => setEditingPlan({ ...editingPlan, originalPriceMonthly: e.target.value === '' ? null : (parseInt(e.target.value) || null) })}
                    className={`w-full bg-transparent border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-orange-500 ${
                      darkMode ? 'border-slate-800 text-white' : 'border-slate-200 text-slate-800'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Yearly Discount (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="20"
                    value={editingPlan.yearlyDiscountPercentage === null || editingPlan.yearlyDiscountPercentage === undefined ? '' : editingPlan.yearlyDiscountPercentage}
                    onChange={(e) => setEditingPlan({ ...editingPlan, yearlyDiscountPercentage: e.target.value === '' ? null : (parseInt(e.target.value) || 0) })}
                    className={`w-full bg-transparent border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-orange-500 ${
                      darkMode ? 'border-slate-800 text-white' : 'border-slate-200 text-slate-800'
                    }`}
                  />
                </div>
              </div>

              {/* Limits Row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Max Staff Limit</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Unlimited"
                    value={editingPlan.staffLimit === null || editingPlan.staffLimit === undefined ? '' : editingPlan.staffLimit}
                    onChange={(e) => setEditingPlan({ ...editingPlan, staffLimit: e.target.value === '' ? null : (parseInt(e.target.value) || 0) })}
                    className={`w-full bg-transparent border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-orange-500 ${
                      darkMode ? 'border-slate-800 text-white' : 'border-slate-200 text-slate-800'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Max Restaurants</label>
                  <input
                    type="number"
                    min="1"
                    value={editingPlan.tenantLimit}
                    onChange={(e) => setEditingPlan({ ...editingPlan, tenantLimit: parseInt(e.target.value) || 1 })}
                    className={`w-full bg-transparent border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-orange-500 ${
                      darkMode ? 'border-slate-800 text-white' : 'border-slate-200 text-slate-800'
                    }`}
                  />
                </div>
              </div>

              {/* Features List */}
              <div>
                <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Features (comma-separated)</label>
                <input
                  type="text"
                  placeholder="eg. 15 Staff, Advanced Reports"
                  value={editingPlan.features ? editingPlan.features.join(', ') : ''}
                  onChange={(e) => setEditingPlan({ ...editingPlan, features: e.target.value.split(',').map(f => f.trim()).filter(Boolean) })}
                  className={`w-full bg-transparent border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-orange-500 ${
                    darkMode ? 'border-slate-800 text-white' : 'border-slate-200 text-slate-800'
                  }`}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6 pt-4 border-t border-slate-800/10">
              {!editingPlan.isNew && (
                <button
                  onClick={handleDeletePlan}
                  disabled={['Free', 'Standard', 'Premium', 'Enterprise'].includes(editingPlan.name)}
                  className={`py-2.5 px-4 rounded-xl text-xs font-semibold border border-red-500/20 text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-30`}
                >
                  Delete Plan
                </button>
              )}
              <button
                onClick={() => setEditingPlan(null)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border ${
                  darkMode ? 'border-slate-800 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleSavePlan}
                className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow-md shadow-orange-500/10"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Offers Modal */}
      {isBulkOffersOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 p-4 animate-fade-in">
          <div className={`w-full max-w-md rounded-3xl p-6 border shadow-2xl flex flex-col ${
            darkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-800'
          }`}>
            <div className="flex items-center justify-between border-b pb-4 mb-4 border-slate-800/10">
              <div>
                <h3 className="text-base font-bold">Configure Bulk Offers</h3>
                <p className="text-[11px] text-slate-550 mt-0.5 font-semibold">
                  Apply discounts globally to all active subscription plans.
                </p>
              </div>
              <button
                onClick={() => setIsBulkOffersOpen(false)}
                className={`p-1.5 rounded-lg transition-colors ${
                  darkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">
                  Global Yearly Discount (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={bulkYearlyDiscount}
                  onChange={(e) => setBulkYearlyDiscount(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                  className={`w-full bg-transparent border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-orange-500 ${
                    darkMode ? 'border-slate-800 text-white' : 'border-slate-200 text-slate-800'
                  }`}
                  placeholder="eg. 20"
                />
                <p className="text-[9px] text-slate-550 mt-1 leading-normal">
                  Updates the yearly subscription discount percentage across all plan options.
                </p>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">
                  Global Monthly Offer Discount (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={bulkMonthlyDiscount}
                  onChange={(e) => setBulkMonthlyDiscount(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                  className={`w-full bg-transparent border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-orange-500 ${
                    darkMode ? 'border-slate-800 text-white' : 'border-slate-200 text-slate-800'
                  }`}
                  placeholder="eg. 10 (Set to 0 to restore original prices)"
                />
                <p className="text-[9px] text-slate-550 mt-1 leading-normal">
                  Updates all monthly subscription rates based on their original baseline price. Set to 0 to restore original price.
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6 pt-4 border-t border-slate-800/10">
              <button
                onClick={() => setIsBulkOffersOpen(false)}
                disabled={bulkApplying}
                className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border ${
                  darkMode ? 'border-slate-800 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setBulkApplying(true);
                  try {
                    await apiClient.post('/superadmin/plans/bulk-offers', {
                      yearlyDiscountPercentage: bulkYearlyDiscount,
                      monthlyDiscountPercentage: bulkMonthlyDiscount,
                    });
                    setIsBulkOffersOpen(false);
                    await fetchPlans();
                  } catch (err) {
                    console.error('Failed to apply bulk offers', err);
                  } finally {
                    setBulkApplying(false);
                  }
                }}
                disabled={bulkApplying}
                className="flex-1 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-md shadow-orange-600/10 flex items-center justify-center gap-1.5"
              >
                {bulkApplying ? (
                  <>
                    <RefreshCw size={12} className="animate-spin" />
                    Applying...
                  </>
                ) : (
                  'Apply to All Plans'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Commission Modal */}
      {isCommissionOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 p-4 animate-fade-in">
          <div className={`w-full max-w-md rounded-3xl p-6 border shadow-2xl flex flex-col ${
            darkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-800'
          }`}>
            <div className="flex items-center justify-between border-b pb-4 mb-4 border-slate-800/10">
              <div>
                <h3 className="text-base font-bold">Configure Platform Commission</h3>
                <p className="text-[11px] text-slate-550 mt-0.5 font-semibold">
                  Set the default platform cut percentage for restaurant dining payments.
                </p>
              </div>
              <button
                onClick={() => setIsCommissionOpen(false)}
                className={`p-1.5 rounded-lg transition-colors ${
                  darkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">
                  Platform Commission Rate (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={platformSettings.platformCommissionRate ?? 10}
                  onChange={(e) => setPlatformSettings(prev => ({ ...prev, platformCommissionRate: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) }))}
                  className={`w-full bg-transparent border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-orange-500 ${
                    darkMode ? 'border-slate-800 text-white' : 'border-slate-200 text-slate-800'
                  }`}
                  placeholder="eg. 10"
                />
                <p className="text-[9px] text-slate-550 mt-1 leading-normal">
                  This rate determines the platform commission cut display and metrics on both the Transactions and Analytics dashboards.
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6 pt-4 border-t border-slate-800/10">
              <button
                onClick={() => setIsCommissionOpen(false)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border ${
                  darkMode ? 'border-slate-800 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await handleSavePlatformSettings();
                  setIsCommissionOpen(false);
                }}
                className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow-md shadow-orange-500/10"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
