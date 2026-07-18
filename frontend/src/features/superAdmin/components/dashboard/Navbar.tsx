import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../../auth/AuthProvider";
import {
  Bell,
  Moon,
  Sun,
  Search,
  ChevronDown,
  LogOut,
  Settings,
  Volume2,
  VolumeX,
  Menu,
  X,
  Shield,
  Activity,
  Clock,
  Mail,
  Phone,
  MapPin,
  ChevronRight,
} from "lucide-react";
import { useRestaurantRequestsStore } from "../../store/RestaurantRequests";
import { useAlertsStore } from "../../store/AlertsStore";
import { useSuperAdminDashboardStore } from "../../store/Superadmindashboard";
import { usePlatformSettingsGuard } from "../../../../shared/hooks/usePlatformSettingsGuard";

interface NavbarProps {
  darkMode: boolean;
  onThemeToggle: () => void;
  /** Called when the hamburger is tapped on mobile */
  onMobileMenuToggle?: () => void;
  /** Whether the mobile sidebar drawer is currently open */
  mobileMenuOpen?: boolean;
  sidebarCollapsed: boolean;
}

// ─── Profile Card ────────────────────────────────────────────────────────────
interface ProfileCardProps {
  darkMode: boolean;
  onClose: () => void;
}

function ProfileCard({ darkMode, onClose }: ProfileCardProps) {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { data, fetchOverview } = useSuperAdminDashboardStore();
  const { settings } = usePlatformSettingsGuard();
  const platformName = settings?.platformName || "HQ Terminal";

  useEffect(() => {
    if (!data) {
      fetchOverview();
    }
  }, [data, fetchOverview]);

  const formatVal = (val: number | undefined) => {
    if (val === undefined) return "0";
    if (val >= 1000) {
      return (val / 1000).toFixed(1).replace(/\.0$/, "") + "K";
    }
    return val.toString();
  };

  const formatRev = (val: number | undefined) => {
    if (val === undefined) return "₹0";
    if (val >= 1000) {
      return "₹" + (val / 1000).toFixed(1).replace(/\.0$/, "") + "K";
    }
    return "₹" + val.toString();
  };

  const stats = [
    { label: "Orders", value: formatVal(data?.stats?.totalOrders) },
    { label: "Revenue", value: formatRev(data?.stats?.monthlyRevenue) },
    { label: "Partners", value: (data?.stats?.totalRestaurants ?? 0).toString() },
  ];

  const details = [
    { icon: Mail, label: user?.email || "souvik@hq.io" },
    { icon: Phone, label: user?.mobile || "+91 98765 43210" },
    { icon: MapPin, label: user?.location || "Kolkata, WB" },
  ];

  const handleEditProfile = () => {
    onClose();
    navigate("/superadmin/edit-profile");
  };

  return (
    <div
      className={`absolute right-0 mt-2 w-72 sm:w-80 rounded-2xl border shadow-2xl overflow-hidden z-50 ${
        darkMode
          ? "bg-slate-950 border-slate-800 text-slate-200"
          : "bg-white border-slate-200 text-slate-800"
      }`}
    >
      {/* ── Hero banner ── */}
      <div className="relative h-20 bg-gradient-to-br from-orange-600 via-amber-500 to-yellow-400">
        {/* Decorative circles */}
        <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full bg-white/10" />
        <div className="absolute top-2 right-10 w-10 h-10 rounded-full bg-white/10" />

        {/* Status badge */}
        <span className="absolute top-3 left-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/20 text-white text-[10px] font-semibold backdrop-blur-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Online
        </span>

        {/* Role chip */}
        <span className="absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/20 text-white text-[10px] font-semibold backdrop-blur-sm">
          <Shield size={10} />
          Global Admin
        </span>
      </div>

      {/* ── Avatar overlapping banner ── */}
      <div className="relative px-4 pb-3">
        <div className="flex items-end justify-between -mt-8 mb-3">
          <div className="relative">
            <div className="w-16 h-16 rounded-full overflow-hidden border-4 border-white dark:border-slate-950 shadow-md">
              <img
                src={user?.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&h=100&q=80"}
                alt={user?.name || "Mr. Souvik"}
                className="w-full h-full object-cover"
              />
            </div>
            <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-white dark:border-slate-950" />
          </div>

          {/* ── Edit Profile button — navigates to /superadmin/edit-profile ── */}
          <button
            onClick={handleEditProfile}
            className={`mb-0.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors ${
              darkMode
                ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Edit Profile
            <ChevronRight size={11} />
          </button>
        </div>

        {/* Name & role */}
        <div className="mb-3">
          <h3 className="font-bold text-sm leading-tight">{user?.name || "Mr. Souvik Dey"}</h3>
          <p className="text-[11px] text-slate-400 mt-0.5 font-medium">
            Super Administrator · {platformName}
          </p>
        </div>

        {/* Stats row */}
        <div
          className={`grid grid-cols-3 divide-x rounded-xl overflow-hidden mb-3 ${
            darkMode ? "divide-slate-800 bg-slate-900" : "divide-slate-100 bg-slate-50"
          }`}
        >
          {stats.map(({ label, value }) => (
            <div key={label} className="py-2.5 text-center">
              <p className="text-sm font-bold text-orange-500 leading-none">{value}</p>
              <p className="text-[10px] text-slate-400 mt-0.5 font-medium">{label}</p>
            </div>
          ))}
        </div>

        {/* Contact details */}
        <div className="space-y-1.5 mb-3">
          {details.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2.5 text-[11px] text-slate-400 font-medium"
            >
              <Icon size={11} className="text-orange-400 shrink-0" />
              <span className="truncate">{label}</span>
            </div>
          ))}
        </div>

        {/* Last active */}
        <div
          className={`flex items-center gap-2 text-[10px] rounded-lg px-2.5 py-2 mb-3 font-medium ${
            darkMode ? "bg-slate-900 text-slate-400" : "bg-slate-50 text-slate-500"
          }`}
        >
          <Clock size={10} className="text-orange-400" />
          Last active: Today, {new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })} IST
          <Activity size={10} className="ml-auto text-emerald-400 animate-pulse" />
        </div>

        {/* Divider */}
        <div
          className={`h-px w-full mb-2 ${darkMode ? "bg-slate-800" : "bg-slate-100"}`}
        />

        {/* Sign Out */}
        <button
          onClick={() => {
            signOut();
            onClose();
          }}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-red-500 hover:bg-red-500/10 transition-colors"
        >
          <LogOut size={14} />
          Sign Out
        </button>
      </div>
    </div>
  );
}

// ─── Navbar ──────────────────────────────────────────────────────────────────
export default function Navbar({
  darkMode,
  onThemeToggle,
  onMobileMenuToggle,
  mobileMenuOpen = false,
  sidebarCollapsed,
}: NavbarProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [systemMute, setSystemMute] = useState(false);
  const requests = useRestaurantRequestsStore((state) => state.requests);
  const alerts = useAlertsStore((state) => state.alerts);
  const fetchAlerts = useAlertsStore((state) => state.fetchAlerts);
  const setupSocketListener = useAlertsStore((state) => state.setupSocketListener);
  const acknowledgeAlert = useAlertsStore((state) => state.acknowledgeAlert);
  const dismissAlert = useAlertsStore((state) => state.dismissAlert);

  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("superadmin_dismissed_notifications");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("superadmin_dismissed_notifications", JSON.stringify(dismissedIds));
    } catch (e) {
      console.error(e);
    }
  }, [dismissedIds]);

  const handleMarkAllRead = async () => {
    const toAcknowledge = alerts.filter(a => a.status === 'new');
    for (const a of toAcknowledge) {
      await acknowledgeAlert(a.id);
    }
  };

  const handleDismissAll = async () => {
    const toDismiss = alerts.filter(a => !a.id.startsWith('request-'));
    for (const a of toDismiss) {
      await dismissAlert(a.id);
    }
    const reqIds = requests.map(r => `req-${r.id}`);
    setDismissedIds(prev => [...prev, ...reqIds]);
  };

  const handleDismissItem = async (item: any) => {
    setDismissedIds(prev => [...prev, item.id]);
    if (item.alert) {
      const alertId = item.id.replace('alert-', '');
      await dismissAlert(alertId);
    }
  };

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAlerts();
    setupSocketListener();
  }, [fetchAlerts, setupSocketListener]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setProfileDropdownOpen(false);
        setNotificationsOpen(false);
        setSettingsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleThemeClick = () => {
    const nextMode = !darkMode;
    onThemeToggle();
    window.dispatchEvent(
      new CustomEvent("sync-app-theme", { detail: { darkMode: nextMode } })
    );
  };

  const notifications = useMemo(() => {
    const activeRequests = requests
      .filter((r) => r.status === 'APPLICATION_PENDING' || r.status === 'PENDING_PAYMENT')
      .map((request) => ({
        id: `req-${request.id}`,
        title: "New Restaurant Request",
        description: `${request.name} requested ${request.plan} onboarding.`,
        time: request.requestedAt ? new Date(request.requestedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Just now",
        type: "info",
        unread: true,
        request: true,
      }));

    const activeAlerts = alerts
      .filter((alert) => alert.status === 'new')
      .map((alert) => ({
        id: `alert-${alert.id}`,
        title: alert.title,
        description: alert.description,
        time: alert.timestamp ? new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Just now",
        type: alert.type === 'critical' ? 'warning' : 'info',
        unread: true,
        alert: true,
      }));

    return [...activeRequests, ...activeAlerts].filter(item => !dismissedIds.includes(item.id));
  }, [requests, alerts, dismissedIds]);

  const pendingCount = notifications.length;
  const unresolvedCount = pendingCount;

  return (
    <>
      {/* ── MAIN NAVBAR ── */}
      <header
        className={`fixed top-0 right-0 z-40 h-16 border-b backdrop-blur-md transition-all duration-300
          left-0 ${sidebarCollapsed ? "lg:left-[72px]" : "lg:left-[260px]"}
          ${
            darkMode
              ? "bg-slate-950/80 border-slate-800 shadow-md shadow-black/10"
              : "bg-white/80 border-slate-200/80 shadow-sm shadow-slate-100/40"
          }`}
      >
        <div
          className="w-full h-full px-4 sm:px-6 flex items-center justify-between gap-3"
          ref={dropdownRef}
        >
          {/* LEFT: hamburger (mobile) + logo */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Hamburger – mobile only */}
            <button
              onClick={onMobileMenuToggle}
              className={`lg:hidden w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                darkMode
                  ? "text-slate-400 hover:text-slate-100 hover:bg-slate-900"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
              }`}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>

            {/* Brand – mobile */}
            <div className="flex items-center gap-2 lg:hidden min-w-0">
              <div className="h-9 w-9 p-1 rounded-full bg-white flex items-center justify-center shrink-0 overflow-hidden shadow-md ring-2 ring-white/30">
                <img
                  src="/Graphura logo.png"
                  alt="Graphura Logo"
                  className="w-full h-full object-contain rounded-full bg-white"
                />
              </div>
              <img
                src={darkMode ? "/Graphura-Dark-Mode.png" : "/Graphuara-Light-Mode.jpg"}
                alt="Graphura"
                className="h-7 max-w-[115px] object-contain shrink min-w-0"
              />
            </div>

            {/* Brand – desktop (hidden to prevent clashing and redundancy with sidebar) */}
            <div className="hidden"></div>
          </div>

          {/* CENTER: Search bar */}
          <div
            className={`flex-1 max-w-xl transition-all duration-200 ${
              searchOpen ? "block" : "hidden md:block"
            }`}
          >
            <div className="relative group">
              <Search
                className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${
                  darkMode
                    ? "text-slate-500 group-focus-within:text-orange-500"
                    : "text-slate-400 group-focus-within:text-orange-500"
                }`}
              />
              <input
                type="text"
                placeholder="Search orders, metrics, partners..."
                className={`w-full h-10 pl-10 pr-4 rounded-xl text-xs font-medium outline-none border transition-all duration-200 ${
                  darkMode
                    ? "bg-slate-900/60 border-slate-800 text-slate-100 focus:border-slate-700 focus:bg-slate-900"
                    : "bg-slate-50 border-slate-200 text-slate-800 focus:border-slate-300 focus:bg-white"
                }`}
              />
            </div>
          </div>

          {/* RIGHT: actions */}
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            {/* Mobile search toggle */}
            <button
              onClick={() => setSearchOpen((v) => !v)}
              className={`md:hidden w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                darkMode
                  ? "text-slate-400 hover:text-slate-100 hover:bg-slate-900"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
              }`}
              aria-label="Toggle search"
            >
              <Search size={16} />
            </button>

            <div className="flex items-center gap-1 sm:gap-1.5">
              {/* Theme toggle */}
              <button
                onClick={handleThemeClick}
                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                  darkMode
                    ? "text-slate-400 hover:text-slate-100 hover:bg-slate-900"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                }`}
              >
                {darkMode ? <Sun size={16} /> : <Moon size={16} />}
              </button>

              {/* Notifications */}
              <div className="relative">
                <button
                  onClick={() => {
                    setNotificationsOpen((v) => !v);
                    setSettingsOpen(false);
                    setProfileDropdownOpen(false);
                  }}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center relative ${
                    darkMode
                      ? "text-slate-400 hover:text-slate-100"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Bell size={16} />
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                  {pendingCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-orange-600 text-white text-[9px] font-bold flex items-center justify-center">
                      {pendingCount}
                    </span>
                  )}
                </button>

                {notificationsOpen && (
                  <div
                    className={`absolute right-0 mt-2 w-72 sm:w-80 rounded-2xl border shadow-xl overflow-hidden z-50 ${
                      darkMode
                        ? "bg-slate-950 border-slate-800 text-slate-200"
                        : "bg-white border-slate-200 text-slate-800"
                    }`}
                  >
                    <div className="px-4 py-3 border-b dark:border-slate-900 flex justify-between items-center">
                      <div>
                        <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400">
                          Activity Center
                        </h3>
                        <p className="text-[10px] text-orange-500 font-semibold mt-0.5">
                          {unresolvedCount} Action items unresolved
                        </p>
                      </div>

                      <div className="flex items-center gap-3 select-none">
                        {alerts.filter(a => !a.id.startsWith('request-')).length > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDismissAll();
                            }}
                            className="text-[9px] font-bold text-slate-400 hover:text-red-500 transition-colors uppercase tracking-wider bg-transparent border-none p-0 cursor-pointer"
                          >
                            Clear all
                          </button>
                        )}
                        {pendingCount > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMarkAllRead();
                            }}
                            className="text-[9px] font-bold text-orange-500 hover:text-orange-600 transition-colors uppercase tracking-wider bg-transparent border-none p-0 cursor-pointer"
                          >
                            Mark all read
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto divide-y dark:divide-slate-900">
                      {notifications.length > 0 ? (
                        notifications.map((item) => (
                          <div
                            key={item.id}
                            onClick={() => {
                              setNotificationsOpen(false);
                              if ("request" in item && item.request) {
                                navigate("/superadmin?requests=new");
                              } else if ("alert" in item && item.alert) {
                                navigate("/superadmin/alerts");
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setNotificationsOpen(false);
                                if ("request" in item && item.request) {
                                  navigate("/superadmin?requests=new");
                                } else if ("alert" in item && item.alert) {
                                  navigate("/superadmin/alerts");
                                }
                              }
                            }}
                            role="button"
                            tabIndex={0}
                            className={`p-3.5 flex gap-3 cursor-pointer group relative ${
                              item.unread
                                ? darkMode
                                  ? "bg-slate-900/30"
                                  : "bg-orange-50/20"
                                : ""
                            }`}
                          >
                            <div className="flex-1 min-w-0 pr-6">
                              <p className="font-semibold text-xs truncate">
                                {item.title}
                              </p>
                              <p className="text-[11px] mt-0.5 text-slate-400">
                                {item.description}
                              </p>
                              <p className="text-[10px] mt-1 text-slate-500">
                                {item.time}
                              </p>
                            </div>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDismissItem(item);
                              }}
                              className="absolute right-3 top-1/2 -translate-y-1/2 opacity-40 sm:opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition-all z-10"
                              title="Dismiss notification"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="py-8 text-center text-xs text-slate-500">
                          No active notifications
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Settings */}
              <div className="relative">
                <button
                 onClick={() => navigate("/superadmin/settings")}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                      darkMode
                  ? "text-slate-400 hover:bg-slate-900"
                       : "text-slate-500 hover:bg-slate-100"
               }`}
                    >
                  <Settings size={16} />
                </button>

                {settingsOpen && (
                  <div
                    className={`absolute right-0 mt-2 w-56 rounded-2xl border p-1 shadow-xl z-50 ${
                      darkMode
                        ? "bg-slate-950 border-slate-800 text-slate-200"
                        : "bg-white border-slate-200 text-slate-800"
                    }`}
                  >
                    <div className="px-3 py-2 font-bold text-[11px] uppercase tracking-wider border-b dark:border-slate-900 text-slate-400">
                      Control Center
                    </div>
                    <div className="p-1.5 space-y-1">
                      <div className="flex items-center justify-between px-2 py-1.5 text-xs">
                        <span className="flex items-center gap-2 text-slate-400 font-medium">
                          {systemMute ? (
                            <VolumeX size={13} className="text-red-400" />
                          ) : (
                            <Volume2 size={13} />
                          )}
                          Alert Sounds
                        </span>
                        <button
                          onClick={() => setSystemMute((v) => !v)}
                          className={`w-8 h-5 rounded-full relative p-0.5 transition-colors ${
                            systemMute ? "bg-red-500" : "bg-orange-500"
                          }`}
                        >
                          <div
                            className={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${
                              systemMute ? "translate-x-3" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />

            {/* ── User profile ── */}
            <div className="relative">
              <button
                onClick={() => {
                  setProfileDropdownOpen((v) => !v);
                  setNotificationsOpen(false);
                  setSettingsOpen(false);
                }}
                className="flex items-center gap-2 p-1 rounded-xl"
                aria-expanded={profileDropdownOpen}
                aria-label="Open profile menu"
              >
                <img
                  src={user?.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&h=100&q=80"}
                  alt="profile"
                  className="w-7 h-7 rounded-full object-cover"
                />
                <div className="hidden lg:block text-left leading-none">
                  <h4 className="font-semibold text-xs">{user?.name || "Mr. Souvik"}</h4>
                  <p className="text-[10px] text-slate-400">Global Admin</p>
                </div>
                <ChevronDown
                  size={14}
                  className={`hidden sm:block ${
                    profileDropdownOpen ? "rotate-180" : ""
                  } transition-transform text-slate-400`}
                />
              </button>

              {/* ── Profile dropdown card ── */}
              {profileDropdownOpen && (
                <ProfileCard
                  darkMode={darkMode}
                  onClose={() => setProfileDropdownOpen(false)}
                />
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile full-width search bar */}
      {searchOpen && (
        <div
          className={`md:hidden fixed top-16 left-0 right-0 z-30 px-4 py-3 border-b transition-colors duration-300 ${
            darkMode
              ? "bg-slate-950 border-slate-800"
              : "bg-white border-slate-200"
          }`}
        >
          <div className="relative group">
            <Search
              className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${
                darkMode ? "text-slate-500" : "text-slate-400"
              }`}
            />
            <input
              type="text"
              placeholder="Search orders, metrics, partners..."
              className={`w-full h-10 pl-10 pr-4 rounded-xl text-xs font-medium outline-none border transition-all duration-200 ${
                darkMode
                  ? "bg-slate-900/60 border-slate-800 text-slate-100"
                  : "bg-slate-50 border-slate-200 text-slate-800"
              }`}
            />
          </div>
        </div>
      )}
    </>
  );
}
