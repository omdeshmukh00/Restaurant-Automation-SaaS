import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import type { Panel } from '../../auth/tokenStore';

const AUTH_PANEL_MAP: Array<{ prefix: string; panel: Panel; dashboardPath: string }> = [
  { prefix: '/auth/customer', panel: 'customer', dashboardPath: '/customer/home' },
  { prefix: '/auth/kitchen', panel: 'kitchen', dashboardPath: '/kitchen/orders' },
  { prefix: '/auth/staff', panel: 'staff', dashboardPath: '/staff' },
  { prefix: '/auth/cleaning', panel: 'cleaning', dashboardPath: '/cleaning' },
  { prefix: '/auth/admin', panel: 'admin', dashboardPath: '/admin' },
  { prefix: '/auth/super-admin', panel: 'superadmin', dashboardPath: '/superadmin' },
  { prefix: '/auth/superadmin', panel: 'superadmin', dashboardPath: '/superadmin' },
];

/**
 * Route guard for authentication routes (e.g., /auth/customer, /auth/kitchen).
 * If a session for the target role already exists, redirects the user immediately
 * to the corresponding dashboard. Otherwise, renders the login page.
 */
export function AuthRoute(): JSX.Element {
  const { isPanelAuthenticated, initializing } = useAuth();
  const location = useLocation();

  if (initializing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950 text-gray-800 dark:text-gray-200">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-amber-500 border-t-transparent mb-4" />
        <p className="animate-pulse text-sm font-medium">Restoring session...</p>
      </div>
    );
  }

  // Find matching panel config from location.pathname
  const matched = AUTH_PANEL_MAP.find(({ prefix }) => location.pathname.startsWith(prefix));

  if (matched && isPanelAuthenticated(matched.panel)) {
    return <Navigate replace to={matched.dashboardPath} />;
  }

  return <Outlet />;
}
