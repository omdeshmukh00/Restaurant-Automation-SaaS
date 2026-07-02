// src/features/cleaning/utils/cleaningRoleAccess.ts

export const CLEANING_ROLE_ACCESS: Record<string, string[]> = {
  'Cleaning Staff': [
    '/cleaning',
    '/cleaning/tables',
    '/cleaning/tasks',
    '/cleaning/profile',
    '/cleaning/settings'
  ],
  'Housekeeping': [
    '/cleaning',
    '/cleaning/requests',
    '/cleaning/tasks',
    '/cleaning/profile',
    '/cleaning/settings'
  ],
  'Cleaning Supervisor': [
    '/cleaning',
    '/cleaning/tables',
    '/cleaning/requests',
    '/cleaning/tasks',
    '/cleaning/monitor',
    '/cleaning/profile',
    '/cleaning/settings'
  ]
};

export function getCleaningRolePermissions(role: string): string[] {
  const normalized = (role || '').toLowerCase();
  
  if (normalized.includes('supervisor') || normalized.includes('lead') || normalized.includes('manager')) {
    return CLEANING_ROLE_ACCESS['Cleaning Supervisor'];
  }
  
  if (normalized.includes('housekeeping') || normalized.includes('house keeper')) {
    return CLEANING_ROLE_ACCESS['Housekeeping'];
  }
  
  if (normalized.includes('staff') || normalized.includes('cleaner')) {
    return CLEANING_ROLE_ACCESS['Cleaning Staff'];
  }
  
  // Default fallback for safety
  return CLEANING_ROLE_ACCESS['Cleaning Staff'];
}

export function isCleaningPathAllowed(role: string, pathname: string): boolean {
  const allowed = getCleaningRolePermissions(role);
  const normPath = pathname.replace(/\/$/, '');
  return allowed.includes(normPath);
}
