export const ROLE_ACCESS: Record<string, string[]> = {
  'Waiter': [
    '/staff/tables',
    '/staff/orders',
    '/staff/food-ready',
    '/staff/menu',
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
    '/staff/alerts',
    '/staff/profile',
    '/staff/settings',
    '/staff/monitor'
  ]
};

export function getRolePermissions(role: string): string[] {
  const normalized = (role || '').toLowerCase().replace(/_/g, ' ');
  
  if (normalized.includes('supervisor') || normalized.includes('manager') || normalized.includes('admin')) {
    return ROLE_ACCESS['Floor Supervisor'];
  }
  
  if (normalized.includes('waiter') || normalized.includes('service')) {
    return ROLE_ACCESS['Waiter'];
  }
  
  if (normalized.includes('floor') || normalized.includes('cleaning') || normalized.includes('staff')) {
    return ROLE_ACCESS['Floor Staff'];
  }
  
  // Default fallback for safety
  return ROLE_ACCESS['Waiter'];
}

export function isPathAllowed(role: string, pathname: string): boolean {
  const allowed = getRolePermissions(role);
  const normPath = pathname.replace(/\/$/, '');
  return allowed.some(p => normPath === p || normPath.startsWith(p + '/'));
}
