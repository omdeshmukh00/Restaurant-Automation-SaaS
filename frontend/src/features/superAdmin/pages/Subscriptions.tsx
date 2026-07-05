// pages/Subscriptions.tsx
// Main orchestrator — all state lives here; components are pure/presentational.

import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, Trash, Plus, Sparkles, Building2, X } from "lucide-react";
import { apiClient } from "../../../shared/services/apiClient";

import type {
  RestaurantNode,
  StatusFilter,
  TierFilter,
  SortField,
  SortOrder,
  PlanType,
  StatusType,
  NewRestaurantForm,
} from "../components/Subscriptions/Subcriptiontypes";

import { restaurantData } from "../store/Subscriptions";
import { useRestaurantRequestsStore } from "../store/RestaurantRequests";
import { computeTierMetrics, exportToCSV, parseRevenue, generateId, formatCurrency } from "../utils/Subscriptionutils";

import TierCards from "../components/Subscriptions/Tiercards";
import SubscriptionControls from "../components/Subscriptions/Subscriptioncontrols";
import SubscriptionTable from "../components/Subscriptions/Subcriptiontable";
import ViewModal from "../components/Subscriptions/Viewmodal";
import AddRestaurantModal from "../components/Subscriptions/Addrestaurantmodal";

const EMPTY_FORM: NewRestaurantForm = {
  name: "", owner: "", email: "", phone: "",
  location: "", plan: "Basic", status: "Trial",
  revenue: "₹0", branches: 1, tags: "",
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
  const [viewingNode, setViewingNode] = useState<RestaurantNode | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formData, setFormData] = useState<NewRestaurantForm>(EMPTY_FORM);

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
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── Data state ────────────────────────────────────────────────────────────
  const navigate = useNavigate();
  const [restaurants, setRestaurants] = useState<RestaurantNode[]>(restaurantData);
  const approvedRestaurants = useRestaurantRequestsStore((state) => state.restaurants);
  const requests = useRestaurantRequestsStore((state) => state.requests);
  const updateApprovedRestaurantStatus = useRestaurantRequestsStore(
    (state) => state.updateRestaurantStatus
  );
  const updateApprovedRestaurantPlan = useRestaurantRequestsStore(
    (state) => state.updateRestaurantPlan
  );
  const deleteApprovedRestaurant = useRestaurantRequestsStore(
    (state) => state.deleteRestaurant
  );

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
  const updateStatus = (id: string, status: StatusType) => {
    updateApprovedRestaurantStatus(id, status);
    setRestaurants((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  };

  const updatePlan = (id: string, plan: PlanType) => {
    if (plan !== "Enterprise") updateApprovedRestaurantPlan(id, plan);
    setRestaurants((prev) => prev.map((r) => (r.id === id ? { ...r, plan } : r)));
  };

  const deleteNode = (id: string) => {
    deleteApprovedRestaurant(id);
    setRestaurants((prev) => prev.filter((r) => r.id !== id));
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.owner.trim()) return;

    const newNode: RestaurantNode = {
      id: generateId(),
      name: formData.name.trim(),
      owner: formData.owner.trim(),
      email: formData.email.trim() || "info@restaurant.com",
      phone: formData.phone.trim() || "+1 (555) 000-0000",
      location: formData.location.trim() || "Location TBD",
      plan: formData.plan,
      status: formData.status,
      revenue: formData.revenue.startsWith("₹") ? formData.revenue : `₹${formData.revenue}`,
      branches: Math.max(1, Number(formData.branches) || 1),
      joinedDate: new Date().toISOString().slice(0, 10),
      lastActive: new Date().toISOString().slice(0, 10),
      tags: formData.tags
        ? formData.tags.split(",").map((t: string) => t.trim()).filter(Boolean)
        : [],
    };

    setRestaurants((prev) => [newNode, ...prev]);
    setIsAddModalOpen(false);
    setFormData(EMPTY_FORM);
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
        joinedDate: new Date().toISOString().slice(0, 10),
        lastActive: new Date().toISOString().slice(0, 10),
        tags: ["New Request", "Placeholder"],
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

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/superadmin?requests=new')}
            className={`py-2 px-3.5 rounded-xl border text-[11px] font-bold hover:bg-orange-500 hover:text-white hover:border-orange-500 transition-all flex items-center gap-1.5 ${
              darkMode
                ? 'bg-slate-900/50 border-slate-800 text-slate-300'
                : 'bg-white border-slate-200 text-slate-700 shadow-sm'
            }`}
          >
            <Building2 size={13} />
            New Requests
            {requests.length > 0 && (
              <span className="ml-1 min-w-4 h-4 px-1 rounded-full bg-orange-600 text-white text-[9px] flex items-center justify-center font-bold">
                {requests.length}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setEditingPlan({
                name: '',
                priceMonthly: 0,
                originalPriceMonthly: null,
                tenantLimit: 1,
                staffLimit: 5,
                isActive: true,
                features: [],
                isNew: true
              });
            }}
            className={`py-2 px-3.5 rounded-xl border text-[11px] font-bold hover:bg-orange-500 hover:text-white hover:border-orange-500 transition-all flex items-center gap-1.5 ${
              darkMode
                ? 'bg-slate-900/50 border-slate-800 text-slate-300'
                : 'bg-white border-slate-200 text-slate-700 shadow-sm'
            }`}
          >
            <Plus size={13} />
            Add New Plan
          </button>

          <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-xs font-semibold shrink-0 ${
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
        onAddClick={() => { setFormData(EMPTY_FORM); setIsAddModalOpen(true); }}
      />

      {/* Table */}
      <SubscriptionTable
        restaurants={sorted}
        darkMode={darkMode}
        searchQuery={searchQuery}
        statusFilter={statusFilter}
        tierFilter={tierFilter}
        onView={setViewingNode}
        onUpdateStatus={updateStatus}
        onUpdatePlan={updatePlan}
        onDelete={deleteNode}
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

      {/* View Modal */}
      {viewingNode && (
        <ViewModal
          restaurant={viewingNode}
          darkMode={darkMode}
          onClose={() => setViewingNode(null)}
          onEditClick={() => {
            setViewingNode(null);
          }}
        />
      )}

      {/* Add Modal */}
      {isAddModalOpen && (
        <AddRestaurantModal
          darkMode={darkMode}
          formData={formData}
          onChange={(partial) => setFormData((prev) => ({ ...prev, ...partial }))}
          onSubmit={handleAddSubmit}
          onClose={() => { setIsAddModalOpen(false); setFormData(EMPTY_FORM); }}
        />
      )}

      {/* Edit Plan Modal */}
      {editingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className={`w-full max-w-lg rounded-3xl p-6 border shadow-2xl flex flex-col ${
            darkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-800'
          }`}>
            <div className="flex items-center justify-between border-b pb-4 mb-4 border-slate-800/10">
              <div>
                <h3 className="text-base font-bold">
                  {editingPlan.isNew ? 'Create Subscription Plan' : `Edit ${editingPlan.name} Plan`}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
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
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-500 hover:text-orange-500 transition-colors">
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Offer Price (₹)</label>
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

    </div>
  );
}
