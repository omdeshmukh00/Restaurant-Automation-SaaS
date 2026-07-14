import { useState, useEffect, useRef } from "react";
import { Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useTheme } from "../app/providers/ThemeProvider";
import Navbar from "../features/superAdmin/components/dashboard/Navbar";
import Sidebar from "../features/superAdmin/components/Sidebar";
import { useRestaurantRequestsStore } from "../features/superAdmin/store/RestaurantRequests";
import { apiClient } from "../shared/services/apiClient";
import { getStoredUser, setStoredUser } from "../auth/tokenStore";

export default function SuperAdminLayout() {
  const { user, setUser } = useAuth();

  const fetchRequests = useRestaurantRequestsStore((state) => state.fetchRequests);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const { theme: themePreference, setTheme: setThemePreference, syncThemeFromProfile } = useTheme();

  const lastSyncedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (user && user.id !== lastSyncedUserIdRef.current && user.themeMode) {
      syncThemeFromProfile(user.themeMode);
      lastSyncedUserIdRef.current = user.id;
    }
  }, [user, syncThemeFromProfile]);

  const [isSystemDark, setIsSystemDark] = useState(() => {
    if (typeof window !== "undefined") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });

  useEffect(() => {
    if (themePreference !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = (e: MediaQueryListEvent) => {
      setIsSystemDark(e.matches);
    };
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [themePreference]);

  const darkMode = themePreference === "dark" || (themePreference === "system" && isSystemDark);

  // Sync state changes with the custom event for any sub-components
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("theme", darkMode ? "dark" : "light");
    }
    window.dispatchEvent(
      new CustomEvent("sync-app-theme", { detail: { darkMode } })
    );
  }, [darkMode]);

  // ── Sidebar collapsed state (persisted) ──────────────────────────────────
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("superadmin-sidebar-collapsed");
      if (saved !== null) {
        return saved === "true";
      }
      return window.innerWidth < 1024;
    }
    return false;
  });

  const handleToggleSidebar = () => {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    localStorage.setItem("superadmin-sidebar-collapsed", String(next));
  };

  // ── Mobile sidebar drawer state ──────────────────────────────────────────
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Close drawer on window resize to desktop breakpoint
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) setMobileSidebarOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Prevent body scroll when drawer is open on mobile
  useEffect(() => {
    if (mobileSidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileSidebarOpen]);

  // ── Theme toggle ─────────────────────────────────────────────────────────
  const updateThemePreference = async (nextPref: "dark" | "light" | "system") => {
    setThemePreference(nextPref);
    if (user) {
      setUser({ ...user, themeMode: nextPref });
    }
    try {
      await apiClient.patch('/users/me', { themeMode: nextPref });
      const panel = 'superadmin';
      const stored = getStoredUser(panel);
      if (stored) {
        stored.themeMode = nextPref;
        setStoredUser(panel, stored);
      }
    } catch (e) {
      console.warn("Failed to persist theme preference to backend", e);
    }
  };

  const toggleTheme = () => {
    const nextPref = themePreference === "dark" ? "light" : "dark";
    updateThemePreference(nextPref);
  };

  return (
    <div
      className={`flex min-h-screen font-sans antialiased transition-colors duration-300 superadmin-panel ${
        darkMode ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900"
      }`}
    >
      {/* ── SIDEBAR ─────────────────────────────────────────────────────── */}
      <Sidebar
        darkMode={darkMode}
        toggleTheme={toggleTheme}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggle={handleToggleSidebar}
      />

      {/* ── MAIN CONTENT AREA ───────────────────────────────────────────── */}
      <main
        className={`flex-1 min-w-0 flex flex-col overflow-y-auto pt-16 h-screen transition-all duration-300 ${
          sidebarCollapsed ? "lg:ml-[72px]" : "lg:ml-[260px]"
        }`}
      >
        {/* ── NAVBAR ────────────────────────────────────────────────────── */}
        <Navbar
          darkMode={darkMode}
          onThemeToggle={toggleTheme}
          onMobileMenuToggle={() => setMobileSidebarOpen((v) => !v)}
          mobileMenuOpen={mobileSidebarOpen}
          sidebarCollapsed={sidebarCollapsed}
        />

        {/* ── PAGE CONTENT ──────────────────────────────────────────────── */}
        <div className="flex-1">
          <Outlet context={{ darkMode, themePreference, setThemePreference: updateThemePreference }} />
        </div>
      </main>
    </div>
  );
}