import { Navigate } from 'react-router-dom';
import type { RouteObject } from 'react-router-dom';
import CustomerLayout from '../layouts/CustomerLayout';
import { CustomerSessionGuard } from '../app/guards/CustomerSessionGuard';
import CustomerHomePage from '../features/customer/pages/CustomerHomePage';
import CustomerMenuPage from '../features/customer/pages/CustomerMenuPage';
import CustomerCheckoutPage from '../features/customer/pages/CustomerCheckoutPage';
import CustomerOrderTrackingPage from '../features/customer/pages/CustomerOrderTrackingPage';
import CustomerReservationPage from '../features/customer/pages/CustomerReservationPage';
import CustomerFeedbackPage from '../features/customer/pages/CustomerFeedbackPage';
import CustomerProfilePage from '../features/customer/pages/CustomerProfilePage';

export const customerRoutes: RouteObject[] = [
  {
    path: '/customer',
    element: <CustomerLayout />,
    children: [
      { index: true, element: <Navigate to="home" replace /> },
      
      // Account routes (no session required, protected by AuthGuard internally or ProtectedRoute)
      { path: 'reservations', element: <CustomerReservationPage /> },
      { path: 'feedback', element: <CustomerFeedbackPage /> },
      { path: 'profile', element: <CustomerProfilePage /> },
      // Placeholders for Phase 3 pages:
      // { path: 'order-history', element: <CustomerOrderHistoryPage /> },
      // { path: 'previous-invoices', element: <CustomerPreviousInvoicesPage /> },

      // Session routes (require active dining session)
      {
        element: <CustomerSessionGuard />,
        children: [
          { path: 'home', element: <CustomerHomePage /> },
          { path: 'menu', element: <CustomerMenuPage /> },
          { path: 'checkout', element: <CustomerCheckoutPage /> },
          { path: 'orders', element: <CustomerOrderTrackingPage /> },
          { path: 'live-bill', element: <Navigate to="orders" replace /> }, // Placeholder mapping
        ]
      }
    ],
  },
];
