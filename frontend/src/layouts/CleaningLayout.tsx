import React, { useState } from 'react';
import { Outlet, useLocation, Navigate } from 'react-router-dom';
import { CleaningSearchProvider } from '../features/cleaning/components/dashboard/CleaningSearchContext';
import CleaningSidebar from '../features/cleaning/components/dashboard/CleaningSidebar';
import CleaningTopBar from '../features/cleaning/components/dashboard/CleaningTopBar';
import { ToastProvider } from '../features/cleaning/components/dashboard/Toast';
import { useCleaning } from '../features/cleaning/hooks/usecleaning';
import { getCleaningRolePermissions } from '../features/cleaning/utils/cleaningRoleAccess';
import { usePlatformSettingsGuard } from '../shared/hooks/usePlatformSettingsGuard';
import MaintenanceAlertModal from '../shared/components/MaintenanceAlertModal';
import { useTranslation } from '../features/cleaning/hooks/useTranslation';
import { useAuth } from '../auth/AuthProvider';

import CleaningBottomNav from '../features/cleaning/components/dashboard/CleaningBottomNav';

export default function CleaningLayout(): JSX.Element {
  const { settings } = usePlatformSettingsGuard();
  const { profile } = useCleaning();
  const { user, getPanelUser } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();

  const activeUser = getPanelUser('cleaning') || user;
  const userRole = activeUser?.internal_role || activeUser?.role || profile.role;
  const allowedPaths = getCleaningRolePermissions(userRole);
  const currentPath = location.pathname.replace(/\/$/, '');

  const isAllowed = allowedPaths.includes(currentPath);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('cleaning-sidebar-collapsed');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });

  // Determine page title based on path
  const getPageDetails = (): { title: string; subtitle: string; badge?: React.ReactNode } | null => {
    switch (location.pathname) {
      case '/cleaning':
        return null;
      case '/cleaning/tables':
        return { title: t('tablesTitle'), subtitle: t('tablesSubtitle') };
      case '/cleaning/requests':
        return { 
          title: t('requestsTitle'), 
          subtitle: t('requestsSubtitle')
        };
      case '/cleaning/tasks':
        return { title: t('tasksTitle'), subtitle: t('tasksSubtitle') };
      case '/cleaning/monitor':
      case '/cleaning/profile':
      case '/cleaning/settings':
        return null;
      default:
        return { title: 'CleanServe', subtitle: 'Management Panel' };
    }
  };

  const pageDetails = getPageDetails();

  if (!isAllowed && allowedPaths.length > 0) {
    return <Navigate to={allowedPaths[0]} replace />;
  }

  return (
    <ToastProvider>
    <CleaningSearchProvider>
      <div className="flex h-screen max-h-screen overflow-hidden bg-sd-surface text-sd-on-surface font-sans cleaning-panel w-full">
        {/* Sidebar */}
        <CleaningSidebar
          collapsed={sidebarCollapsed}
          onToggle={() => {
            const next = !sidebarCollapsed;
            setSidebarCollapsed(next);
            localStorage.setItem('cleaning-sidebar-collapsed', String(next));
          }}
          onItemClick={() => {
            if (window.innerWidth < 1024) {
              setSidebarCollapsed(true);
              localStorage.setItem('cleaning-sidebar-collapsed', 'true');
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
          className={`flex-1 flex flex-col h-full min-w-0 transition-all duration-300 ml-0 ${
            sidebarCollapsed ? 'lg:ml-[72px]' : 'lg:ml-60'
          }`}
        >
          <CleaningTopBar
            onToggleSidebar={() => {
              const next = !sidebarCollapsed;
              setSidebarCollapsed(next);
              localStorage.setItem('cleaning-sidebar-collapsed', String(next));
            }}
          />

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 pb-24 lg:pb-8">
            {/* Dynamic Page Header below the Navbar */}
            {pageDetails && (
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-sans tracking-tight leading-snug flex items-center">
                  {pageDetails.title}
                  {pageDetails.badge}
                </h1>
                <p className="text-xs text-slate-400 dark:text-slate-400 font-sans mt-0.5">{pageDetails.subtitle}</p>
              </div>
            )}
            <Outlet />
          </main>
        </div>

        {/* Mobile Bottom Nav */}
        <CleaningBottomNav />

        {/* Maintenance Alert Modal overlay */}
        <MaintenanceAlertModal
          isOpen={!!settings?.disableCleaningPanel}
          title="Cleaning Panel Disabled"
          message="Due to temporary platform maintenance, the Cleaning Panel is currently disabled."
        />
      </div>
    </CleaningSearchProvider>
    </ToastProvider>
  );
}