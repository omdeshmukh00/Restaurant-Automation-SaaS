import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../../auth/AuthProvider";
import {
  LayoutDashboard,
  UtensilsCrossed,
  CreditCard,
  BarChart3,
  IndianRupee,
  Bell,
  FileText,
  Users,
  Settings,
  ChevronDown,
  ChevronUp,
  User,
  LogOut,
  X,
} from "lucide-react";

interface SidebarProps {
  darkMode: boolean;
  toggleTheme: () => void;
  /** Mobile drawer open state – controlled by the layout */
  mobileOpen?: boolean;
  /** Close the mobile drawer */
  onMobileClose?: () => void;
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({
  darkMode,
  toggleTheme: _toggleTheme,
  mobileOpen = false,
  onMobileClose,
  collapsed,
  onToggle,
}: SidebarProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const navItems = [
    { path: "/superadmin", label: "Dashboard", icon: LayoutDashboard },
    { path: "/superadmin/restaurants", label: "Restaurants", icon: UtensilsCrossed },
    { path: "/superadmin/subscriptions", label: "Subscriptions", icon: CreditCard },
    { path: "/superadmin/analytics", label: "Analytics", icon: BarChart3 },
    { path: "/superadmin/transactions", label: "Transactions", icon: IndianRupee },
    { path: "/superadmin/alerts", label: "Alerts", icon: Bell },
    { path: "/superadmin/audit-logs", label: "Audit Logs", icon: FileText },
    { path: "/superadmin/users", label: "Users", icon: Users },
    { path: "/superadmin/edit-profile", label: "Profile", icon: User },
    { path: "/superadmin/settings", label: "Settings", icon: Settings },
  ];

  const renderSidebarContent = (isCollapsed: boolean) => (
    <aside
      className={`h-screen flex flex-col shrink-0 select-none transition-all duration-300 border-r ${
        isCollapsed ? "w-[72px] p-3" : "w-[260px] p-5"
      } ${
        darkMode
          ? "bg-slate-900 border-slate-900 text-slate-200"
          : "bg-white border-slate-200/80 text-slate-900"
      }`}
    >
      {/* LOGO AREA */}
      <div
        className={`flex ${
          isCollapsed ? "flex-col items-center gap-3 px-1 py-2" : "items-center justify-between px-1 pb-4"
        } border-b mb-6 shrink-0 ${
          darkMode ? "border-slate-800/60" : "border-slate-200/80"
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="h-10 w-10 p-1 rounded-full bg-white flex items-center justify-center shrink-0 overflow-hidden shadow-md ring-2 ring-white/30"
          >
            <img
              src="/Graphura logo.png"
              alt="Graphura Logo"
              className="w-full h-full object-contain rounded-full bg-white"
            />
          </div>
          {!isCollapsed && (
            <img
              src={darkMode ? "/Graphura-Dark-Mode.png" : "/Graphuara-Light-Mode.jpg"}
              alt="Graphura"
              className="h-7 max-w-[120px] object-contain shrink min-w-0"
            />
          )}
        </div>

        {/* Mobile close button (inside mobile drawer only) */}
        {!isCollapsed && onMobileClose && (
          <button
            onClick={onMobileClose}
            className={`lg:hidden ml-auto w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
              darkMode
                ? "text-slate-400 hover:text-slate-100 hover:bg-slate-800"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
            }`}
            aria-label="Close sidebar"
          >
            <X size={16} />
          </button>
        )}

        {/* Desktop Collapse Toggle */}
        <button
          onClick={onToggle}
          className={`hidden lg:flex p-1.5 rounded-lg transition-all items-center justify-center cursor-pointer ${
            darkMode ? "text-slate-400 hover:bg-slate-800" : "text-slate-400 hover:bg-slate-100"
          }`}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <span className="material-symbols-outlined text-[20px]">{isCollapsed ? "menu_open" : "menu"}</span>
        </button>
      </div>

      {/* NAVIGATION LINKS */}
      <nav className="space-y-1.5 flex-1 overflow-y-auto pr-1 sd-no-scrollbar">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/superadmin"}
              onClick={onMobileClose}
              className={({ isActive }) =>
                `flex items-center gap-3.5 rounded-xl transition-all duration-200 ${
                  isCollapsed ? "justify-center p-2.5 w-11 h-11 mx-auto" : "px-4 py-3 text-sm font-medium"
                } ${
                  isActive
                    ? "bg-orange-600 text-white font-semibold shadow-lg shadow-orange-600/10"
                    : darkMode
                    ? "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`
              }
              title={isCollapsed ? item.label : undefined}
            >
              <Icon size={18} />
              {!isCollapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* FOOTER PROFILE */}
      <div
        className={`pt-3 mt-2 border-t relative ${
          darkMode ? "border-slate-800/60" : "border-slate-200/80"
        }`}
        onMouseLeave={() => setProfileMenuOpen(false)}
      >
        {/* Profile Popover Menu */}
        {profileMenuOpen && (
          <div
            className={`absolute bottom-full pb-2 z-50 animate-scaleUp ${
              isCollapsed ? "left-0 w-48" : "left-0 right-0 w-full"
            }`}
          >
            <div
              className={`rounded-2xl border p-1.5 shadow-2xl ${
                darkMode
                  ? "bg-slate-950 border-slate-800 text-white shadow-black"
                  : "bg-white border-slate-200 text-slate-900 shadow-slate-300/50"
              }`}
            >
              <button
                onClick={() => {
                  setProfileMenuOpen(false);
                  if (onMobileClose) onMobileClose();
                  navigate("/superadmin/edit-profile");
                }}
                className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                  darkMode ? "hover:bg-orange-500/10 text-slate-200 hover:text-orange-400" : "hover:bg-orange-50 text-slate-700 hover:text-orange-600"
                }`}
              >
                <User size={14} className="text-orange-500" />
                <span>Edit Profile</span>
              </button>
              <button
                onClick={() => {
                  setProfileMenuOpen(false);
                  if (onMobileClose) onMobileClose();
                  signOut();
                }}
                className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                  darkMode ? "hover:bg-red-500/10 text-red-400" : "hover:bg-red-50 text-red-600"
                }`}
              >
                <LogOut size={14} className="text-red-500" />
                <span>Log Out</span>
              </button>
            </div>
          </div>
        )}

        <button
          onClick={() => setProfileMenuOpen((prev) => !prev)}
          onMouseEnter={() => setProfileMenuOpen(true)}
          className={`w-full flex items-center gap-2.5 p-2 rounded-xl transition-all ${
            isCollapsed ? "justify-center" : "justify-between"
          } ${
            darkMode
              ? "hover:bg-slate-800/80 text-slate-200"
              : "hover:bg-slate-100 text-slate-800"
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt="profile"
                className="w-8 h-8 rounded-full object-cover shrink-0 ring-2 ring-orange-500/20"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-orange-500 text-white font-bold flex items-center justify-center text-xs shrink-0 ring-2 ring-orange-500/20">
                {(user?.name || "Graphura").charAt(0).toUpperCase()}
              </div>
            )}
            {!isCollapsed && (
              <div className="text-left min-w-0 truncate">
                <p className="text-xs font-bold truncate leading-tight">
                  {user?.name || "Graphura"}
                </p>
                <p className={`text-[10px] truncate ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                  Super Admin
                </p>
              </div>
            )}
          </div>
          {!isCollapsed && (
            <div className="shrink-0 text-slate-400">
              {profileMenuOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </div>
          )}
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop fixed sidebar */}
      <div
        className={`hidden lg:block fixed top-0 left-0 z-50 h-screen border-r transition-all duration-300 ${
          collapsed ? "w-[72px]" : "w-[260px]"
        } ${darkMode ? "border-r-slate-800/60" : "border-r-slate-200/80"}`}
      >
        {renderSidebarContent(collapsed)}
      </div>

      {/* Mobile drawer backdrop */}
      <div
        className={`lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onMobileClose}
        aria-hidden="true"
      />

      {/* Mobile drawer content */}
      <div
        className={`lg:hidden fixed top-0 left-0 z-50 h-screen border-r transition-transform duration-300 ease-in-out ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${darkMode ? "border-slate-800" : "border-slate-200/80"}`}
      >
        {renderSidebarContent(false)}
      </div>
    </>
  );
}