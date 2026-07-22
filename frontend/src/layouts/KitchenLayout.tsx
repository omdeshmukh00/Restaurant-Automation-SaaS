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
    
    // Initial fetch on mount is handled by connect event below if socket connects.
    // We still fetch once initially in case socket is already connected.
    void refreshDashboard();

    const socket = getSocket();
    
    const handleOrderUpsert = (payload: any, ack?: Function) => {
      // payload could be { order, _version } or just order
      const order = payload.order || payload;
      useKitchenStore.getState().upsertOrder(order);
      if (typeof ack === 'function') ack({ status: 'ok' });
    };

    const handleBatchUpsert = (payload: any, ack?: Function) => {
      const batch = payload.batch || payload;
      useKitchenStore.getState().upsertBatch(batch);
      if (typeof ack === 'function') ack({ status: 'ok' });
    };

    if (socket) {
      socket.on('connect', refreshDashboard);
      socket.on('reconnect', refreshDashboard);
      socket.on('order.created', handleOrderUpsert);
      socket.on('order.updated', handleOrderUpsert);
      socket.on('order.ready', handleOrderUpsert);
      socket.on('order.served', handleOrderUpsert);
      socket.on('order.cancelled', handleOrderUpsert);
      socket.on('order.deleted', scheduleRefresh); // deleted might need a full refresh or custom store logic
      socket.on('kitchen:batch-updated', handleBatchUpsert);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (socket) {
        socket.off('connect', refreshDashboard);
        socket.off('reconnect', refreshDashboard);
        socket.off('order.created', handleOrderUpsert);
        socket.off('order.updated', handleOrderUpsert);
        socket.off('order.ready', handleOrderUpsert);
        socket.off('order.served', handleOrderUpsert);
        socket.off('order.cancelled', handleOrderUpsert);
        socket.off('order.deleted', scheduleRefresh);
        socket.off('kitchen:batch-updated', handleBatchUpsert);
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

