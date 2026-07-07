// ── Panel-aware token store ──────────────────────────────────────────
// Each panel gets its own localStorage keys so sessions never collide.

export type Panel = 'customer' | 'kitchen' | 'staff' | 'cleaning' | 'admin' | 'superadmin';

const ALL_PANELS: Panel[] = ['customer', 'kitchen', 'staff', 'cleaning', 'admin', 'superadmin'];

export function getPanelFromPath(pathname: string): Panel {
  if (pathname.startsWith('/customer')) return 'customer';
  if (pathname.startsWith('/kitchen')) return 'kitchen';
  if (pathname.startsWith('/staff')) return 'staff';
  if (pathname.startsWith('/cleaning')) return 'cleaning';
  if (pathname.startsWith('/admin')) return 'admin';
  if (pathname.startsWith('/superadmin')) return 'superadmin';
  
  if (pathname.startsWith('/auth/customer')) return 'customer';
  if (pathname.startsWith('/auth/kitchen')) return 'kitchen';
  if (pathname.startsWith('/auth/staff')) return 'staff';
  if (pathname.startsWith('/auth/cleaning')) return 'cleaning';
  if (pathname.startsWith('/auth/admin')) return 'admin';
  if (pathname.startsWith('/auth/superadmin')) return 'superadmin';
  if (pathname.startsWith('/auth/super-admin')) return 'superadmin';
  
  return 'customer'; // Default fallback
}

function accessTokenKey(panel: Panel) {
  return `ra/${panel}/access-token`;
}

function userKey(panel: Panel) {
  return `ra/${panel}/user`;
}

function roleKey(panel: Panel) {
  return `ra/${panel}/role`;
}

// ── Legacy keys (kept for migration / backwards compat) ──────────────
const LEGACY_ACCESS_TOKEN_KEY = 'restaurant-automation/access-token';
const LEGACY_ROLE_KEY = 'restaurant-automation/demo-role';
const LEGACY_USER_KEY = 'restaurant-automation/user';

type TokenListener = (panel: Panel, token: string | null) => void;
const tokenListeners = new Set<TokenListener>();

export function addTokenListener(listener: TokenListener): () => void {
  tokenListeners.add(listener);
  return () => {
    tokenListeners.delete(listener);
  };
}

function notifyTokenListeners(panel: Panel, token: string | null): void {
  tokenListeners.forEach((listener) => {
    try {
      listener(panel, token);
    } catch (e) {
      console.error('Error in token listener', e);
    }
  });
}

// Synchronize token state changes across browser tabs in real-time
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (!event.key) return;
    
    // We only care about keys like: ra/customer/access-token
    const parts = event.key.split('/');
    if (parts.length === 3 && parts[0] === 'ra' && parts[2] === 'access-token') {
      const panel = parts[1] as Panel;
      notifyTokenListeners(panel, event.newValue);
    }
  });
}

// ── Panel-scoped access token ─────────────────────────────────────────

export function getAccessToken(panel: Panel): string | null {
  return localStorage.getItem(accessTokenKey(panel));
}

export function setAccessToken(panel: Panel, token: string | null): void {
  if (!token) {
    localStorage.removeItem(accessTokenKey(panel));
  } else {
    localStorage.setItem(accessTokenKey(panel), token);
  }
  notifyTokenListeners(panel, token);
}

// ── Panel-scoped role ─────────────────────────────────────────────────

export function getStoredRole(panel: Panel): string | null {
  return localStorage.getItem(roleKey(panel));
}

export function setStoredRole(panel: Panel, role: string | null): void {
  if (!role) {
    localStorage.removeItem(roleKey(panel));
    return;
  }
  localStorage.setItem(roleKey(panel), role);
}

// ── Panel-scoped user ─────────────────────────────────────────────────

export type StoredAuthUser = {
  id: string;
  name: string;
  role: string;
  panel?: Panel;
  internal_role?: string;
  restaurantId?: string;
  restaurantName?: string;
  email?: string;
  mobile?: string;
};

export function getStoredUser(panel: Panel): StoredAuthUser | null {
  const raw = localStorage.getItem(userKey(panel));
  if (!raw) return null;

  try {
    const user = JSON.parse(raw) as StoredAuthUser;
    if (user && user.name === 'Neha Admin') {
      user.name = 'Admin';
      localStorage.setItem(userKey(panel), JSON.stringify(user));
    }
    return user;
  } catch {
    localStorage.removeItem(userKey(panel));
    return null;
  }
}

export function setStoredUser(panel: Panel, user: StoredAuthUser | null): void {
  if (!user) {
    localStorage.removeItem(userKey(panel));
    return;
  }
  localStorage.setItem(userKey(panel), JSON.stringify(user));
}

// ── Clear a single panel's session ────────────────────────────────────

export function clearPanelSession(panel: Panel): void {
  localStorage.removeItem(accessTokenKey(panel));
  localStorage.removeItem(roleKey(panel));
  localStorage.removeItem(userKey(panel));
  localStorage.removeItem('otpExpiresAt');
  localStorage.removeItem('customerOtpExpiresAt');
  notifyTokenListeners(panel, null);
}

// ── Clear ALL panel sessions ──────────────────────────────────────────

export function clearAllSessions(): void {
  for (const p of ALL_PANELS) {
    clearPanelSession(p);
  }

  // Also clean up legacy keys
  localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
  localStorage.removeItem(LEGACY_ROLE_KEY);
  localStorage.removeItem(LEGACY_USER_KEY);
  localStorage.removeItem('otpExpiresAt');
  localStorage.removeItem('customerOtpExpiresAt');
}

// ── Migrate legacy session to a panel ─────────────────────────────────

export function migrateLegacySession(panel: Panel): void {
  const legacyToken = localStorage.getItem(LEGACY_ACCESS_TOKEN_KEY);
  const legacyUser = localStorage.getItem(LEGACY_USER_KEY);
  const legacyRole = localStorage.getItem(LEGACY_ROLE_KEY);

  if (legacyToken && !localStorage.getItem(accessTokenKey(panel))) {
    localStorage.setItem(accessTokenKey(panel), legacyToken);
  }
  if (legacyUser && !localStorage.getItem(userKey(panel))) {
    localStorage.setItem(userKey(panel), legacyUser);
  }
  if (legacyRole && !localStorage.getItem(roleKey(panel))) {
    localStorage.setItem(roleKey(panel), legacyRole);
  }

  // Remove legacy keys after migration
  localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
  localStorage.removeItem(LEGACY_USER_KEY);
  localStorage.removeItem(LEGACY_ROLE_KEY);
}