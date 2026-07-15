import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { AdminSidebar } from '../features/admin/components/AdminSidebar';
import { AdminTopbar } from '../features/admin/components/AdminTopbar';
import { AdminSearchProvider } from '../features/admin/context/Adminsearchcontext';
import { AdminNotificationsProvider } from '../features/admin/context/Adminnotificationscontext';
import OnboardingWizard from '../features/admin/components/dashboard/OnboardingWizard';
import { apiClient } from '../shared/services/apiClient';
import { RefreshCw, AlertCircle } from 'lucide-react';

export default function AdminLayout(): JSX.Element {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('admin-sidebar-collapsed');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });

  const [restaurant, setRestaurant] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchOverview = async () => {
    try {
      const response = await apiClient.get('/admin/restaurant/overview');
      setRestaurant(response.data?.data?.restaurant);
    } catch (err) {
      console.error('Failed to load restaurant status overview', err);
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    fetchOverview();
  }, []);

  const handleToggleSidebar = () => {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    localStorage.setItem('admin-sidebar-collapsed', String(next));
  };

  const handleCloseSidebar = () => {
    setSidebarCollapsed(true);
    localStorage.setItem('admin-sidebar-collapsed', 'true');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950 text-slate-400 gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-orange-500" />
        <span className="text-xs">Loading RestoHub...</span>
      </div>
    );
  }

  return (
    <AdminNotificationsProvider>
      <AdminSearchProvider>
        <div className="relative flex min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-950 dark:text-gray-50 font-sans admin-panel">
          <AdminSidebar
            collapsed={sidebarCollapsed}
            onToggle={handleToggleSidebar}
            onItemClick={() => {
              if (window.innerWidth < 1024) {
                handleCloseSidebar();
              }
            }}
          />

          {/* Mobile Backdrop when Sidebar is expanded */}
          {!sidebarCollapsed && (
            <button
              className="lg:hidden fixed inset-0 bg-slate-900/30 backdrop-blur-[2px] z-40 w-full h-full border-none outline-none cursor-default"
              onClick={handleCloseSidebar}
              aria-label="Close sidebar"
            />
          )}

          {/* Main Area */}
          <div
            className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
              sidebarCollapsed ? 'ml-[72px]' : 'ml-[72px] lg:ml-64'
            }`}
          >

            <AdminTopbar onMenuToggle={handleToggleSidebar} />

            <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6">
              <Outlet context={{ restaurant, fetchOverview }} />
            </main>
          </div>

          {/* Blocked/Inactivated overlay */}
          {restaurant && restaurant.status === 'SUSPENDED' && (
            <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-950/95 text-slate-100 p-6 text-center">
              <div className="max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
                <div className="w-12 h-12 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto">
                  <AlertCircle size={24} />
                </div>
                <h2 className="text-xl font-bold tracking-tight">Restaurant Account Suspended</h2>
                <p className="text-sm text-slate-400">
                  Your restaurant has been inactivated or blocked by RestoHub.
                </p>
                {restaurant.blockReason && (
                  <div className="p-3.5 bg-slate-950/50 rounded-xl border border-slate-800 text-left">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-slate-500">Reason for Suspension</p>
                    <p className="text-sm font-medium text-slate-300 mt-1">{restaurant.blockReason}</p>
                  </div>
                )}
                <p className="text-xs text-slate-500">
                  Please contact RestoHub support at <span className="font-bold text-orange-500">support@restohub.com</span> for details.
                </p>
                <button 
                  onClick={() => {
                    localStorage.clear();
                    window.location.href = '/auth/admin';
                  }}
                  className="w-full h-10 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl text-xs transition-colors"
                >
                  Return to Login
                </button>
              </div>
            </div>
          )}

          {/* Onboarding Wizard full-page overlay */}
          {restaurant && restaurant.status !== 'ACTIVE' && restaurant.status !== 'SUSPENDED' && (
            <div className="fixed inset-0 z-[999] overflow-y-auto bg-slate-900/75 dark:bg-slate-950/90 p-4 sm:p-6 md:p-10">
              <OnboardingWizard restaurant={restaurant} onComplete={fetchOverview} />
            </div>
          )}
        </div>
      </AdminSearchProvider>
    </AdminNotificationsProvider>
  );
}