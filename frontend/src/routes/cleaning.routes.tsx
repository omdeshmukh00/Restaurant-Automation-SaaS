import React from 'react';
import type { RouteObject } from 'react-router-dom';
import CleaningLayout from '../layouts/CleaningLayout';
import CleaningDashboard from '../features/cleaning/pages/CleaningDashboard';
import CleaningTablesPage from '../features/cleaning/pages/CleaningTablesPage';
import CleaningRequestsPage from '../features/cleaning/pages/CleaningRequestsPage';
import CleaningTasksPage from '../features/cleaning/pages/CleaningTasksPage';
import CleaningStaffMonitorPage from '../features/cleaning/pages/CleaningStaffMonitorPage';
import CleaningProfilePage from '../features/cleaning/pages/CleaningProfilePage';
import CleaningSettingsPage from '../features/cleaning/pages/CleaningSettingsPage';

export const cleaningRoutes: RouteObject[] = [
  {
    path: '/cleaning',
    element: <CleaningLayout />,
    children: [
      {
        index: true,
        element: <CleaningDashboard />,
      },
      {
        path: 'tables',
        element: <CleaningTablesPage />,
      },
      {
        path: 'requests',
        element: <CleaningRequestsPage />,
      },
      {
        path: 'tasks',
        element: <CleaningTasksPage />,
      },
      {
        path: 'monitor',
        element: <CleaningStaffMonitorPage />,
      },
      {
        path: 'profile',
        element: <CleaningProfilePage />,
      },
      {
        path: 'settings',
        element: <CleaningSettingsPage />,
      },
    ],
  },
];