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
      
      // Account & Order tracking routes (accessible without QR scan modal block)
      { path: 'orders', element: <CustomerOrderTrackingPage /> },
      { path: 'reservations', element: <CustomerReservationPage /> },
      { path: 'feedback', element: <CustomerFeedbackPage /> },
      { path: 'profile', element: <CustomerProfilePage /> },
      { path: 'live-bill', element: <Navigate to="orders" replace /> },

      // Session routes (require active dining session / QR scan)
      {
        element: <CustomerSessionGuard />,
        children: [
          { path: 'home', element: <CustomerHomePage /> },
          { path: 'menu', element: <CustomerMenuPage /> },
          { path: 'checkout', element: <CustomerCheckoutPage /> },
        ]
      }
    ],
  },
];
