import React, { useState } from 'react';
import { Outlet, useLocation, Navigate } from 'react-router-dom';
import { StaffSearchProvider } from '../features/staff/components/dashboard/StaffSearchContext';
import StaffSidebar from '../features/staff/components/dashboard/StaffSidebar';
import StaffTopBar from '../features/staff/components/dashboard/StaffTopBar';
import { NotificationWindow } from '../features/staff/components/NotificationWindow';
import { useStaffProfile } from '../features/staff/hooks/useStaffProfile';
import { getRolePermissions } from '../features/staff/utils/roleAccess';

export default function StaffLayout(): JSX.Element {
  const { profile } = useStaffProfile();
  const location = useLocation();

  const allowedPaths = getRolePermissions(profile.role);
  const currentPath = location.pathname.replace(/\/$/, '');

  const isAllowed = allowedPaths.includes(currentPath);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('staff-sidebar-collapsed');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });

  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  if (!isAllowed && allowedPaths.length > 0) {
    return <Navigate to={allowedPaths[0]} replace />;
  }

  return (
    <StaffSearchProvider>
      <div className="flex min-h-screen bg-sd-surface text-sd-on-surface font-sans staff-panel">
        {/* Sidebar */}
        <StaffSidebar
          collapsed={sidebarCollapsed}
          onToggle={() => {
            const next = !sidebarCollapsed;
            setSidebarCollapsed(next);
            localStorage.setItem('staff-sidebar-collapsed', String(next));
          }}
          onItemClick={() => {
            if (window.innerWidth < 1024) {
              setSidebarCollapsed(true);
              localStorage.setItem('staff-sidebar-collapsed', 'true');
            }
          }}
        />

        {/* Mobile Backdrop when Sidebar is expanded */}
        {!sidebarCollapsed && (
          <button
            className="lg:hidden fixed inset-0 bg-slate-900/30 backdrop-blur-[2px] z-40 w-full h-full border-none outline-none cursor-default"
            onClick={() => setSidebarCollapsed(true)}
            aria-label="Close sidebar"
          />
        )}

        {/* Main Area */}
        <div
          className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
            sidebarCollapsed ? 'ml-[72px]' : 'ml-[72px] lg:ml-64'
          }`}
        >
          <StaffTopBar onNotificationClick={() => setIsNotificationOpen(true)} />

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
            <Outlet />
          </main>
        </div>
      </div>

      <NotificationWindow
        open={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
        theme={{
          cardBg: '#1e293b', // slate-800
          cardBorder: '#334155', // slate-700
          miniCardBg: '#0f172a', // slate-900
          textPrimary: '#ffffff',
          textSecondary: '#cbd5e1', // slate-300
          textMuted: '#94a3b8', // slate-400
          font: 'sans-serif'
        }}
      />
    </StaffSearchProvider>
  );
}