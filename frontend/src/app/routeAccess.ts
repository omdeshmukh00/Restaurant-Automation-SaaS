import type { DiningSession } from '../features/customer/store/customer.store';

export type RouteAccessLevel = 'PUBLIC' | 'SESSION' | 'AUTH';

export const CUSTOMER_AUTH_ROUTES = [
  '/customer/profile',
  '/customer/loyalty',
  '/customer/preferences',
  '/customer/settings',
  '/customer/reservations',
  '/customer/feedback',
  '/customer/order-history',
  '/customer/previous-invoices'
];

export const CUSTOMER_SESSION_ROUTES = [
  '/customer/home',
  '/customer/menu',
  '/customer/cart',
  '/customer/checkout',
  '/customer/live-bill',
  '/customer/orders' // This is now purely Current Orders
];

export function getCustomerRouteAccessLevel(pathname: string): RouteAccessLevel {
  const isAuthRoute = CUSTOMER_AUTH_ROUTES.some(p => pathname === p || pathname.startsWith(p + '/'));
  if (isAuthRoute) return 'AUTH';

  const isSessionRoute = CUSTOMER_SESSION_ROUTES.some(p => pathname === p || pathname.startsWith(p + '/'));
  if (isSessionRoute) return 'SESSION';

  return 'PUBLIC';
}

export function isValidDiningSession(session: DiningSession | null | undefined): boolean {
  if (!session) return false;
  
  return Boolean(
    session.sessionToken &&
    session.tableId &&
    session.restaurantId &&
    session.status === 'ACTIVE'
  );
}
