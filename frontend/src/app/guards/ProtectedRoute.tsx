import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import type { Panel } from '../../auth/tokenStore';
import { getCustomerRouteAccessLevel } from '../routeAccess';

// ── Path-to-panel mapping ─────────────────────────────────────────────

const PATH_PANEL_MAP: Array<{ prefix: string; panel: Panel; loginPath: string }> = [
  { prefix: '/customer', panel: 'customer', loginPath: '/auth/customer' },
  { prefix: '/kitchen', panel: 'kitchen', loginPath: '/auth/kitchen' },
  { prefix: '/staff', panel: 'staff', loginPath: '/auth/staff' },
  { prefix: '/cleaning', panel: 'cleaning', loginPath: '/auth/cleaning' },
  { prefix: '/admin', panel: 'admin', loginPath: '/auth/admin' },
  { prefix: '/superadmin', panel: 'superadmin', loginPath: '/auth/superadmin' },
];

/**
 * Panel-aware ProtectedRoute.
 *
 * Instead of checking a single global `isAuthenticated`, this guard
 * determines which panel the user is trying to access (from the URL
 * prefix) and checks whether *that specific panel* has a valid session.
 *
 * This allows a user to be logged into /kitchen and /admin at the same
 * time without one session blocking or overwriting the other.
 */
export function ProtectedRoute(): JSX.Element {
  const { user, isPanelAuthenticated, switchPanel, initializing, activePanel } = useAuth();
  const location = useLocation();

  // Find the matching panel config for the current path
  const matched = PATH_PANEL_MAP.find(({ prefix }) => location.pathname.startsWith(prefix));

  const searchParams = new URLSearchParams(location.search);
  const qrToken =
    searchParams.get('qr_token') ||
    searchParams.get('table_token') ||
    searchParams.get('qr') ||
    searchParams.get('table') ||
    searchParams.get('tableId');

  useEffect(() => {
    if (qrToken) {
      sessionStorage.setItem('pending_qr_token', qrToken);
    }
  }, [qrToken]);

  useEffect(() => {
    if (matched) {
      let shouldSwitchPanel = isPanelAuthenticated(matched.panel);
      
      // For customer panel, allow guests on PUBLIC or SESSION routes
      if (!shouldSwitchPanel && matched.panel === 'customer') {
        const accessLevel = getCustomerRouteAccessLevel(location.pathname);
        if (accessLevel !== 'AUTH') {
          shouldSwitchPanel = true;
        }
      }

      if (shouldSwitchPanel) {
        switchPanel(matched.panel);
      }
    }
  }, [location.pathname, matched, isPanelAuthenticated, switchPanel]);

  if (initializing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950 text-gray-800 dark:text-gray-200">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-amber-500 border-t-transparent mb-4" />
        <p className="animate-pulse text-sm font-medium">Restoring session...</p>
      </div>
    );
  }

  if (!matched) {
    return <Navigate replace state={{ from: location }} to="/auth/restaurant" />;
  }

  if (!isPanelAuthenticated(matched.panel)) {
    if (matched.panel === 'customer') {
      const accessLevel = getCustomerRouteAccessLevel(location.pathname);
      if (accessLevel === 'AUTH') {
        return <Navigate replace state={{ from: location }} to={matched.loginPath} />;
      }
      // For PUBLIC and SESSION routes, allow access without JWT.
      // CustomerLayout will enforce the x-session-token requirement for SESSION routes.
    } else {
      return <Navigate replace state={{ from: location }} to={matched.loginPath} />;
    }
  }

  // To prevent rendering children with the wrong/stale user context during
  // the transition, only render Outlet after the active panel has switched.
  if (activePanel !== matched.panel) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  // Redirect first-time Restaurant Admins who must reset their password
  if (user && user.mustResetPassword && matched.panel === 'admin' && location.pathname !== '/admin/reset-password') {
    return <Navigate replace to="/admin/reset-password" />;
  }

  return <Outlet />;
}
