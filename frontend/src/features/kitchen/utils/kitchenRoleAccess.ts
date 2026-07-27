// src/features/kitchen/utils/kitchenRoleAccess.ts

export const KITCHEN_ROLE_ACCESS: Record<string, string[]> = {
  'Chef': [
    '/kitchen',
    '/kitchen/overview',
    '/kitchen/orders',
    '/kitchen/batch-cooking',
    '/kitchen/stations',
    '/kitchen/settings'
  ],
  'Kitchen Supervisor': [
    '/kitchen',
    '/kitchen/overview',
    '/kitchen/orders',
    '/kitchen/batch-cooking',
    '/kitchen/inventory',
    '/kitchen/stations',
    '/kitchen/staff',
    '/kitchen/settings'
  ],
  'Head-Chef': [
    '/kitchen',
    '/kitchen/overview',
    '/kitchen/orders',
    '/kitchen/batch-cooking',
    '/kitchen/inventory',
    '/kitchen/stations',
    '/kitchen/staff',
    '/kitchen/settings'
  ]
};

export function getKitchenRolePermissions(role: string): string[] {
  const normalized = (role || '').toLowerCase();
  
  if (normalized.includes('supervisor')) {
    return KITCHEN_ROLE_ACCESS['Kitchen Supervisor'];
  }
  
  if (normalized.includes('head') || normalized.includes('executive')) {
    return KITCHEN_ROLE_ACCESS['Head-Chef'];
  }
  
  if (normalized.includes('chef')) {
    return KITCHEN_ROLE_ACCESS['Chef'];
  }
  
  // Default fallback for safety
  return KITCHEN_ROLE_ACCESS['Chef'];
}

export function isKitchenPathAllowed(role: string, pathname: string): boolean {
  const allowed = getKitchenRolePermissions(role);
  const normPath = pathname.replace(/\/$/, '');
  return allowed.includes(normPath);
}
