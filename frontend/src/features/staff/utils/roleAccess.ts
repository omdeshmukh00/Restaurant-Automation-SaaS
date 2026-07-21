// src/features/staff/utils/roleAccess.ts

export const ROLE_ACCESS: Record<string, string[]> = {
  'Waiter': [
    '/staff',
    '/staff/orders',
    '/staff/menu',
    '/staff/food-ready',
    '/staff/requests',
    '/staff/tables',
    '/staff/profile',
    '/staff/settings'
  ],
  'Floor Staff': [
    '/staff/tables',
    '/staff/food-ready',
    '/staff/requests',
    '/staff/table-turnover',
    '/staff/menu',
    '/staff/alerts',
    '/staff/profile',
    '/staff/settings'
  ],
  'Floor Supervisor': [
    '/staff',
    '/staff/tables',
    '/staff/orders',
    '/staff/food-ready',
    '/staff/requests',
    '/staff/reservations',
    '/staff/table-turnover',
    '/staff/menu',
    '/staff/reports',
    '/staff/alerts',
    '/staff/profile',
    '/staff/settings',
    '/staff/monitor'
  ]
};

export function getRolePermissions(role: string): string[] {
  const normalized = (role || '').toLowerCase();
  
  if (normalized.includes('supervisor')) {
    return ROLE_ACCESS['Floor Supervisor'];
  }
  
  if (normalized.includes('waiter')) {
    return ROLE_ACCESS['Waiter'];
  }
  
  if (normalized.includes('floor') || normalized.includes('staff')) {
    return ROLE_ACCESS['Floor Staff'];
  }
  
  // Default fallback for safety (e.g. if role is undefined or doesn't match standard roles)
  return ROLE_ACCESS['Waiter'];
}

export function isPathAllowed(role: string, pathname: string): boolean {
  const allowed = getRolePermissions(role);
  const normPath = pathname.replace(/\/$/, '');
  return allowed.includes(normPath);
}
