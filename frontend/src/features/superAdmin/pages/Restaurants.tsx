// pages/Restaurants.tsx
// Fully responsive restaurants management page

import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Building2 } from "lucide-react";
import { useRestaurantRequestsStore } from "../store/RestaurantRequests";
import { superAdminRestaurantRequestsApi } from "../api/superAdmin.api";
import type {
  RestaurantsRow,
  StatusFilter,
  NewRestaurantForm,
} from "../components/Restaurants/Restauranttypes";

import MetricCards from "../components/Restaurants/Metriccards";
import FilterBar from "../components/Restaurants/Filterbar";
import RestaurantTable from "../components/Restaurants/RestaurantTable";
import ViewModal from "../components/Restaurants/Viewmodal";
import AddRestaurantModal from "../components/Restaurants/AddRestaurantModal";
import LiveActivityModal from "../components/Subscriptions/LiveActivityModal";
import TablePagination from "../components/common/TablePagination";

const DEFAULT_FORM: NewRestaurantForm = {
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

export default function Restaurant() {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("theme");
      return saved ? saved === "dark" : false;
    }
    return false;
  });

  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  const restaurants = useRestaurantRequestsStore((state) => state.restaurants);
  const requests = useRestaurantRequestsStore((state) => state.requests);
  const [plans, setPlans] = useState<any[]>([]);
  const pendingCount = requests.filter(r => r.status === 'APPLICATION_PENDING' || r.status === 'PENDING_PAYMENT').length;
  const addRestaurant = useRestaurantRequestsStore((state) => state.addRestaurant);
  const updateRestaurantStatus = useRestaurantRequestsStore(
    (state) => state.updateRestaurantStatus
  );
  const updateRestaurantPlan = useRestaurantRequestsStore(
    (state) => state.updateRestaurantPlan
  );
  const deleteRestaurantById = useRestaurantRequestsStore(
    (state) => state.deleteRestaurant
  );
  const fetchRequests = useRestaurantRequestsStore((state) => state.fetchRequests);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [viewingRestaurant, setViewingRestaurant] = useState<any | null>(null);
  const [liveActivityRestaurant, setLiveActivityRestaurant] = useState<RestaurantsRow | null>(null);
  const [newRestaurant, setNewRestaurant] = useState<NewRestaurantForm>(() => {
    try {
      const saved = sessionStorage.getItem("ra/add-restaurant-draft");
      return saved ? JSON.parse(saved) : DEFAULT_FORM;
    } catch {
      return DEFAULT_FORM;
    }
  });

  const fetchPlans = async () => {
    try {
      const list = await superAdminRestaurantRequestsApi.getPlans();
      setPlans(list || []);
      if (list && list.length > 0) {
        const activePlans = list.filter((p: any) => p.isActive !== false);
        const defaultPlan = activePlans.length > 0 ? activePlans[0].name : list[0].name;
        setNewRestaurant(prev => ({ ...prev, plan: prev.plan || defaultPlan }));
      }
    } catch (err) {
      console.error("Failed to fetch plans", err);
    }
  };

  useEffect(() => {
    fetchRequests();
    fetchPlans();
  }, [fetchRequests]);



  useEffect(() => {
    sessionStorage.setItem("ra/add-restaurant-draft", JSON.stringify(newRestaurant));
  }, [newRestaurant]);

  const handleViewRestaurant = async (row: RestaurantsRow) => {
    try {
      const fullDetails = await superAdminRestaurantRequestsApi.getRestaurantById(row.id);
      setViewingRestaurant(fullDetails?.restaurant || fullDetails || row);
    } catch (err) {
      console.error("Failed to load restaurant details", err);
      setViewingRestaurant(row);
    }
  };

  // Sync dark mode from parent layout
  useEffect(() => {
    const handleThemeSync = (e: Event) => {
      const custom = e as CustomEvent<{ darkMode: boolean }>;
      if (custom.detail !== undefined) setDarkMode(custom.detail.darkMode);
    };
    window.addEventListener("sync-app-theme", handleThemeSync);
    return () => window.removeEventListener("sync-app-theme", handleThemeSync);
  }, []);

  // Handle escape key to close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsModalOpen(false);
        setViewingRestaurant(null);
        setLiveActivityRestaurant(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Calculate metrics
  const metrics = useMemo(() => ({
    total: restaurants.length,
    active: restaurants.filter((r) => r.status === "Active").length,
    trial: restaurants.filter((r) => r.status === "Trial").length,
    branches: restaurants.reduce((acc, r) => acc + r.branches, 0),
  }), [restaurants]);

  // Filter restaurants based on search and status
  const filteredRestaurants = useMemo(() => {
    return restaurants.filter((item) => {
      const matchesStatus = statusFilter === "All" || item.status === statusFilter;
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        item.name.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        item.owner.toLowerCase().includes(q) ||
        item.location.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [restaurants, searchQuery, statusFilter]);

  // Update restaurant status
  const updateStatus = (id: string, status: "Active" | "Trial" | "Inactive", blockReason?: string) =>
    updateRestaurantStatus(id, status, blockReason);

  // Update restaurant plan
  const updatePlan = (id: string, plan: string) =>
    updateRestaurantPlan(id, plan);

  // Delete restaurant
  const deleteRestaurant = async (id: string) => {
    const restaurantObj = filteredRestaurants.find(r => r.id === id);
    const name = restaurantObj ? restaurantObj.name : "this restaurant";

    let reason = "";
    let isConfirmed = false;
    while (!isConfirmed) {
      const input = window.prompt(`Are you sure you want to permanently delete "${name}"? Enter the reason to confirm (this will be sent to the owner):`);
      if (input === null) return; // Cancelled
      if (input.trim().length > 0) {
        reason = input.trim();
        isConfirmed = true;
      } else {
        window.alert("A reason is required to delete the restaurant.");
      }
    }

    await deleteRestaurantById(id, reason);
  };

  // Handle form submission for new restaurant
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRestaurant.name || !newRestaurant.owner || !newRestaurant.email || !newRestaurant.phone) {
      window.alert("Please fill out all required fields.");
      return;
    }
    if (!newRestaurant.googleMapsUrl) {
      window.alert("Google Maps URL is required to extract coordinates.");
      return;
    }
    try {
      await addRestaurant({
        ...newRestaurant,
        // sync the display 'location' string using city, state, country
        location: `${newRestaurant.city || ""}, ${newRestaurant.state || ""}, ${newRestaurant.country || ""}`.replace(/,\s*,/g, ',').replace(/,\s*$/, '').trim()
      });
      setIsModalOpen(false);
      setNewRestaurant(DEFAULT_FORM);
      sessionStorage.removeItem("ra/add-restaurant-draft");
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
  const paginatedRestaurants = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRestaurants.slice(start, start + pageSize);
  }, [filteredRestaurants, currentPage, pageSize]);

  return (
    <div
      className={`min-h-screen font-sans antialiased transition-colors duration-300 px-4 sm:px-6 py-6 sm:py-8 ${
        darkMode ? "bg-slate-950 text-slate-50" : "bg-slate-50 text-slate-900"
      }`}
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Restaurants</h1>
            <p className={`text-xs sm:text-sm mt-1 font-medium ${darkMode ? "text-slate-400" : "text-slate-600"}`}>
              Manage all onboarded restaurants, active plans, and operational statuses.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/superadmin?requests=new')}
              className={`group py-2 px-3.5 rounded-xl border text-[11px] font-bold hover:bg-orange-500 hover:text-white hover:border-orange-500 transition-all flex items-center gap-1.5 whitespace-nowrap ${
                darkMode
                  ? 'bg-slate-900/50 border-slate-800 text-slate-300'
                  : 'bg-white border-slate-200 text-slate-700 shadow-sm'
              }`}
            >
              New Requests
              {pendingCount > 0 && (
                <span className="ml-1 min-w-4 h-4 px-1 rounded-full bg-orange-600 text-white text-[9px] flex items-center justify-center font-bold">
                  {pendingCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Metric Cards */}
        <MetricCards
          metrics={metrics}
          statusFilter={statusFilter}
          darkMode={darkMode}
          onFilterChange={setStatusFilter}
        />

        {/* Filter Bar */}
        <FilterBar
          searchQuery={searchQuery}
          statusFilter={statusFilter}
          darkMode={darkMode}
          onSearchChange={setSearchQuery}
          onResetFilter={() => setStatusFilter("All")}
          onAddClick={() => setIsModalOpen(true)}
        />

        {/* Restaurant Table/Cards Container */}
        <div className={`rounded-2xl border overflow-hidden shadow-sm ${
          darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/80'
        }`}>
          <div className="max-h-[620px] overflow-auto">
            <RestaurantTable
              restaurants={paginatedRestaurants}
              darkMode={darkMode}
              searchQuery={searchQuery}
              statusFilter={statusFilter}
              onView={handleViewRestaurant}
              onLiveActivity={setLiveActivityRestaurant}
              onUpdateStatus={updateStatus}
              onUpdatePlan={updatePlan}
              onDelete={deleteRestaurant}
              plans={plans}
              onResetFilters={() => {
                setSearchQuery("");
                setStatusFilter("All");
              }}
            />
          </div>

          <TablePagination
            currentPage={currentPage}
            pageSize={pageSize}
            totalItems={filteredRestaurants.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            darkMode={darkMode}
            itemLabel="restaurants"
          />
        </div>
      </div>

      {/* View Restaurant Modal */}
      {viewingRestaurant && (
        <ViewModal
          restaurant={viewingRestaurant}
          darkMode={darkMode}
          onClose={() => setViewingRestaurant(null)}
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

      {/* Add Restaurant Modal */}
      {isModalOpen && (
        <AddRestaurantModal
          darkMode={darkMode}
          formData={newRestaurant}
          plans={plans}
          onChange={(data) => setNewRestaurant((prev) => ({ ...prev, ...data }))}
          onSubmit={handleSubmit}
          onClose={() => setIsModalOpen(false)}
          onClear={() => {
            setNewRestaurant(DEFAULT_FORM);
            sessionStorage.removeItem("ra/add-restaurant-draft");
          }}
        />
      )}
    </div>
  );
}
