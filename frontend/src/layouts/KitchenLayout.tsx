import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, Navigate } from 'react-router-dom';
import { KitchenSearchProvider } from '../features/kitchen/components/dashboard/KitchenSearchContext';
import KitchenSidebar from '../features/kitchen/components/dashboard/KitchenSidebar';
import KitchenTopBar from '../features/kitchen/components/dashboard/KitchenTopBar';
import LiveAlertsBar from '../features/kitchen/components/dashboard/LiveAlertsBar';
import KitchenProfilePanel from '../features/kitchen/components/dashboard/KitchenProfilePanel';
import { useKitchenStore } from '../features/kitchen/store/kitchen.store';
import { getKitchenRolePermissions } from '../features/kitchen/utils/kitchenRoleAccess';
import { usePlatformSettingsGuard } from '../shared/hooks/usePlatformSettingsGuard';
import MaintenanceAlertModal from '../shared/components/MaintenanceAlertModal';
import { connectSocket, getSocket } from '../lib/socket';
import { refreshDashboard, scheduleRefresh } from '../features/kitchen/hooks/useKitchenDashboard';
export default function KitchenLayout(): JSX.Element {
  const { settings } = usePlatformSettingsGuard();
  const { profile } = useKitchenStore();
  const location = useLocation();

  const allowedPaths = getKitchenRolePermissions(profile.role);
  const currentPath = location.pathname.replace(/\/$/, '');

  const isAllowed = allowedPaths.includes(currentPath);

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      if (window.innerWidth < 1024) {
        return true; // Always collapsed (minimized) by default on mobile/tablet viewports
      }
      const stored = localStorage.getItem('kitchen_sidebar_collapsed');
      if (stored !== null) return stored === 'true';
    }
    return false;
  });

  const handleToggleSidebar = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      // Only store user preference for desktop viewports
      if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
        localStorage.setItem('kitchen_sidebar_collapsed', String(next));
      }
      return next;
    });
  };

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setSidebarCollapsed(true);
      }
    };
    window.addEventListener('resize', handleResize);
    
    // Initial fetch on mount
    void refreshDashboard();

    connectSocket();
    const socket = getSocket();
    if (socket) {
      socket.on('order.created', scheduleRefresh);
      socket.on('order.updated', scheduleRefresh);
      socket.on('order.ready', scheduleRefresh);
      socket.on('kitchen:batch-updated', scheduleRefresh);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (socket) {
        socket.off('order.created', scheduleRefresh);
        socket.off('order.updated', scheduleRefresh);
        socket.off('order.ready', scheduleRefresh);
        socket.off('kitchen:batch-updated', scheduleRefresh);
      }
    };
  }, []);

  if (!isAllowed && allowedPaths.length > 0) {
    return <Navigate to={allowedPaths[0]} replace />;
  }

  return (
    <KitchenSearchProvider>
      <div className="flex h-screen overflow-hidden bg-sd-surface text-sd-on-surface font-sans kitchen-panel">
        {/* Sidebar */}
        <KitchenSidebar
          collapsed={sidebarCollapsed}
          onToggle={handleToggleSidebar}
          onProfileClick={() => setIsProfileOpen(true)}
          onItemClick={() => {
            if (window.innerWidth < 1024) {
              setSidebarCollapsed(true);
              localStorage.setItem('kitchen_sidebar_collapsed', 'true');
            }
          }}
        />

        {/* Mobile Backdrop when Sidebar is expanded */}
        {!sidebarCollapsed && (
          <button
            className="lg:hidden fixed inset-0 bg-slate-900/30 backdrop-blur-[2px] z-40 w-full h-full border-none outline-none cursor-default"
            onClick={() => {
              setSidebarCollapsed(true);
              localStorage.setItem('kitchen_sidebar_collapsed', 'true');
            }}
            aria-label="Close sidebar"
          />
        )}

        {/* Main Area */}
        <div
          className={`flex-1 flex flex-col min-w-0 h-full overflow-hidden transition-all duration-300 ${
            sidebarCollapsed ? 'ml-[72px]' : 'ml-[72px] lg:ml-64'
          }`}
        >
          <KitchenTopBar onProfileClick={() => setIsProfileOpen(true)} />

          {/* Page Content */}
          <main className="flex-1 overflow-hidden pb-0 lg:pb-14">
            <Outlet />
          </main>
        </div>

        {/* Live Alerts Footer (Desktop) */}
        <LiveAlertsBar sidebarCollapsed={sidebarCollapsed} />

        {/* Profile Panel Drawer */}
        <KitchenProfilePanel isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />

        {/* Maintenance Alert Modal overlay */}
        <MaintenanceAlertModal
          isOpen={!!settings?.disableKitchenPanel}
          title="Kitchen Panel Disabled"
          message="Due to temporary platform maintenance, the Kitchen Panel is currently disabled."
        />
      </div>
    </KitchenSearchProvider>
  );
}

