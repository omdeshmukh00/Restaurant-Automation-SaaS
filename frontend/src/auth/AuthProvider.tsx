import { createContext, useContext, useState, useCallback, useEffect, type PropsWithChildren } from 'react';
import { apiClient } from '../shared/services/apiClient';
import {
  getAccessToken,
  getStoredRole,
  getStoredUser,
  setAccessToken,
  setStoredRole,
  setStoredUser,
  clearPanelSession,
  clearAllSessions,
  addTokenListener,
  getPanelFromPath,
  type StoredAuthUser,
  type Panel,
} from './tokenStore';

export type AppRole = 'customer' | 'staff' | 'kitchen' | 'cleaning' | 'admin' | 'super-admin';

export type AuthUser = {
  id: string;
  name: string;
  role: AppRole;
  panel: Panel;
  internal_role?: string;
  restaurantName: string;
  restaurantId?: string;
  email?: string;
  mobile?: string;
  mustResetPassword?: boolean;
  firstLogin?: boolean;
  themeMode?: 'light' | 'dark' | 'system';
  avatar?: string;
  location?: string;
  bio?: string;
};

type AuthContextValue = {
  /** Currently active panel user (whichever panel was most recently signed in). */
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  initializing: boolean;
  activePanel: Panel;

  /** Get the stored user for a specific panel (may be null if that panel is not signed in). */
  getPanelUser: (panel: Panel) => AuthUser | null;
  /** Get the access token for a specific panel. */
  getPanelToken: (panel: Panel) => string | null;
  /** Check whether a specific panel is currently authenticated. */
  isPanelAuthenticated: (panel: Panel) => boolean;

  /** Sign in to a specific panel via the backend. */
  signIn: (input: { email?: string; mobile?: string; password: string; deviceLabel?: string }) => Promise<AuthUser>;
  /** Sign in to customer panel via OTP. */
  signInWithOtp: (mobile: string, otp: string, name?: string) => Promise<AuthUser>;
  /** Quick demo sign-in (no backend call). */
  signInAs: (role: AppRole) => void;
  /** Sign out from a specific panel only. Other panels remain authenticated. */
  signOut: (panel?: Panel) => void;
  /** Sign out from ALL panels. */
  signOutAll: () => void;
  /** Switch the "active" panel context (changes which user/token are returned by user/accessToken). */
  switchPanel: (panel: Panel) => void;

  setUser: (user: AuthUser | null) => void;
  setAccessTokenState: (token: string | null) => void;
};

type LoginResponse = {
  success: true;
  data: {
    user: {
      id: string;
      name: string;
      email?: string;
      mobile?: string;
      role: string;
      restaurantId?: string;
      restaurantName?: string;
      internal_role?: string;
      mustResetPassword?: boolean;
      firstLogin?: boolean;
    };
    accessToken: string;
    refreshToken: string;
    panel: Panel;
  };
};

type VerifyOtpResponse = {
  success: true;
  data: {
    customerId: string;
    user: {
      id: string;
      name: string;
      email?: string;
      mobile?: string;
      role: string;
      restaurantId?: string;
      restaurantName?: string;
    };
    accessToken: string;
    refreshToken: string;
    panel: Panel;
  };
};

// ── Mapping helpers ───────────────────────────────────────────────────

const APP_ROLE_TO_PANEL: Record<AppRole, Panel> = {
  customer: 'customer',
  kitchen: 'kitchen',
  staff: 'staff',
  cleaning: 'cleaning',
  admin: 'admin',
  'super-admin': 'superadmin',
};

function mapBackendRoleToAppRole(role: string): AppRole {
  switch (role) {
    case 'staff':
    case 'service-staff':
      return 'staff';
    case 'kitchen':
    case 'kitchen-staff':
      return 'kitchen';
    case 'cleaning':
    case 'cleaning-staff':
      return 'cleaning';
    case 'admin':
    case 'restaurant-admin':
      return 'admin';
    case 'super-admin':
    case 'superadmin':
      return 'super-admin';
    case 'customer':
      return 'customer';
    default:
      throw new Error(`Access Denied: Unrecognized role '${role}'`);
  }
}

function appRoleToPanel(role: AppRole): Panel {
  return APP_ROLE_TO_PANEL[role];
}

function toAuthUser(user: StoredAuthUser, panelOverride?: Panel): AuthUser {
  const appRole = mapBackendRoleToAppRole(user.role);
  return {
    id: user.id,
    name: user.name,
    role: appRole,
    panel: panelOverride ?? user.panel ?? appRoleToPanel(appRole),
    internal_role: user.internal_role,
    restaurantId: user.restaurantId,
    restaurantName: user.restaurantName ?? 'Restaurant',
    email: user.email,
    mobile: user.mobile,
    mustResetPassword: (user as any).mustResetPassword,
    firstLogin: (user as any).firstLogin,
    themeMode: user.themeMode,
    avatar: user.avatar,
    location: user.location,
    bio: user.bio,
  };
}

// ── Demo profiles ─────────────────────────────────────────────────────

const roleProfiles: Record<AppRole, AuthUser> = {
  customer: { id: 'demo-customer', name: 'Guest Diner', role: 'customer', panel: 'customer', restaurantName: 'Amber Table' },
  staff: { id: 'demo-staff', name: 'Service Captain', role: 'staff', panel: 'staff', internal_role: 'FLOOR_SUPERVISOR', restaurantName: 'Amber Table' },
  kitchen: { id: 'demo-kitchen', name: 'Kitchen Lead', role: 'kitchen', panel: 'kitchen', internal_role: 'HEAD_CHEF', restaurantName: 'Amber Table' },
  cleaning: { id: 'demo-cleaning', name: 'Cleaning Lead', role: 'cleaning', panel: 'cleaning', internal_role: 'CLEANING_SUPERVISOR', restaurantName: 'Amber Table' },
  admin: { id: 'demo-admin', name: 'Restaurant Admin', role: 'admin', panel: 'admin', restaurantName: 'Amber Table' },
  'super-admin': { id: 'demo-super-admin', name: 'Platform Operator', role: 'super-admin', panel: 'superadmin', restaurantName: 'Graphura Cloud' },
};

// ── Active panel key ──────────────────────────────────────────────────

const ACTIVE_PANEL_KEY = 'ra/active-panel';

function getActivePanel(): Panel {
  return (localStorage.getItem(ACTIVE_PANEL_KEY) as Panel) ?? 'customer';
}

function setActivePanel(panel: Panel): void {
  localStorage.setItem(ACTIVE_PANEL_KEY, panel);
}

const PATH_PANEL_MAP = [
  { prefix: '/customer', panel: 'customer', loginPath: '/auth/customer' },
  { prefix: '/kitchen', panel: 'kitchen', loginPath: '/auth/kitchen' },
  { prefix: '/staff', panel: 'staff', loginPath: '/auth/staff' },
  { prefix: '/cleaning', panel: 'cleaning', loginPath: '/auth/cleaning' },
  { prefix: '/admin', panel: 'admin', loginPath: '/auth/admin' },
  { prefix: '/superadmin', panel: 'superadmin', loginPath: '/auth/superadmin' },
] as const;

function parseJwt(token: string): any {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      window.atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

function isTokenValid(token: string | null): boolean {
  if (!token) return false;
  if (token.startsWith('demo-token-')) return true;
  const decoded = parseJwt(token);
  if (!decoded || !decoded.exp) return false;
  const currentTime = Math.floor(Date.now() / 1000);
  return decoded.exp > currentTime + 10;
}

function getInitialPanel(): Panel {
  return getPanelFromPath(window.location.pathname);
}

// ── Provider ──────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren): JSX.Element {
  const [activePanel, setActivePanelState] = useState<Panel>(() => getInitialPanel());
  const [accessTokenState, setAccessTokenStateRaw] = useState<string | null>(() => getAccessToken(getInitialPanel()));
  const [userState, setUserState] = useState<AuthUser | null>(() => {
    const panel = getInitialPanel();
    const storedUser = getStoredUser(panel);
    if (storedUser) return toAuthUser(storedUser);

    const storedRole = getStoredRole(panel) as AppRole | null;
    return storedRole ? roleProfiles[storedRole] ?? null : null;
  });
  const [initializing, setInitializing] = useState(true);

  // ── Panel switching ───────────────────────────────────────────────
  const switchPanel = useCallback((panel: Panel) => {
    setActivePanel(panel);
    setActivePanelState(panel);

    const token = getAccessToken(panel);
    const stored = getStoredUser(panel);

    setAccessTokenStateRaw(token);
    setUserState(stored ? toAuthUser(stored, panel) : null);
  }, []);

  // ── Session Restoration on startup ─────────────────────────────────
  useEffect(() => {
    const initSession = async () => {
      const pathname = window.location.pathname;
      let panel = getInitialPanel();
      let loginPath = '/auth/customer';
      let isProtected = false;

      const matched = PATH_PANEL_MAP.find(({ prefix }) => pathname.startsWith(prefix));
      if (matched) {
        panel = matched.panel;
        loginPath = matched.loginPath;
        isProtected = true;
      } else {
        const authMatched = PATH_PANEL_MAP.find(({ loginPath }) => pathname.startsWith(loginPath));
        if (authMatched) {
          panel = authMatched.panel;
          loginPath = authMatched.loginPath;
        } else {
          const activeMatched = PATH_PANEL_MAP.find(({ panel: p }) => p === panel);
          if (activeMatched) {
            loginPath = activeMatched.loginPath;
          }
        }
      }

      // Ensure the active panel is set in localStorage
      setActivePanel(panel);
      // Sync active panel state immediately if it differs, so that initial hooks/renders use the correct panel
      if (panel !== activePanel) {
        switchPanel(panel);
      }

      const stored = getStoredUser(panel);
      if (stored) {
        const token = getAccessToken(panel);
        if (isTokenValid(token)) {
          // Token is valid! Restore session instantly.
          setInitializing(false);
          return;
        }

        // Token is invalid/expired. Call refresh with a timeout.
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, 3000); // 3 seconds timeout

        try {
          const response = await apiClient.post(
            '/auth/refresh',
            { panel },
            { signal: controller.signal }
          );
          clearTimeout(timeoutId);
          const newAccessToken = response.data.data.accessToken;
          setAccessToken(panel, newAccessToken);
          // Sync state with the updated access token
          switchPanel(panel);
        } catch (err: any) {
          clearTimeout(timeoutId);
          console.error(`Session restoration failed for panel ${panel}:`, err);

          const isNetworkError = !err.response || err.code === 'ECONNABORTED' || err.name === 'AbortError';
          const isServerError = err.response && err.response.status >= 500;

          if (!isNetworkError && !isServerError) {
            // Client error (e.g. 400, 401, 403), credentials definitely invalid/expired
            clearPanelSession(panel);
            if (isProtected) {
              window.location.href = loginPath;
              return;
            }
          } else {
            // Network/server error or timeout: do not clear the session, but redirect if protected
            if (isProtected) {
              window.location.href = loginPath;
              return;
            }
          }
        }
      } else {
        // No stored session, redirect if on protected route
        if (isProtected) {
          window.location.href = loginPath;
          return;
        }
      }
      setInitializing(false);
    };

    initSession();
  }, [switchPanel]);
  // ── Sync reactive tokenStore modifications ─────────────────────────
  useEffect(() => {
    return addTokenListener((panel, token) => {
      if (panel === activePanel) {
        setAccessTokenStateRaw(token);
        if (!token) {
          setUserState(null);
        } else {
          const stored = getStoredUser(panel);
          if (stored) {
            setUserState(toAuthUser(stored, panel));
          }
        }
      }
    });
  }, [activePanel]);

  // ── Panel introspection ───────────────────────────────────────────

  const getPanelUser = useCallback((panel: Panel): AuthUser | null => {
    const stored = getStoredUser(panel);
    return stored ? toAuthUser(stored, panel) : null;
  }, []);

  const getPanelToken = useCallback((panel: Panel): string | null => {
    return getAccessToken(panel);
  }, []);

  const isPanelAuthenticated = useCallback((panel: Panel): boolean => {
    return Boolean(getAccessToken(panel) && getStoredUser(panel));
  }, []);



  // ── Sign-in ───────────────────────────────────────────────────────

  const signIn = useCallback(async (input: { email?: string; mobile?: string; password: string; deviceLabel?: string }): Promise<AuthUser> => {
    const response = await apiClient.post<LoginResponse>('/auth/login', input);
    const payload = response.data.data;
    const panel = payload.panel;
    const nextUser = toAuthUser({ ...payload.user, panel }, panel);

    // Store panel-scoped credentials
    setStoredRole(panel, nextUser.role);
    setStoredUser(panel, { ...payload.user, panel });
    setAccessToken(panel, payload.accessToken);

    // Switch active context to this panel
    setActivePanel(panel);
    setActivePanelState(panel);
    setUserState(nextUser);
    setAccessTokenStateRaw(payload.accessToken);

    return nextUser;
  }, []);

  const signInWithOtp = useCallback(async (mobile: string, otp: string, name?: string): Promise<AuthUser> => {
    const response = await apiClient.post<VerifyOtpResponse>('/auth/verify-otp', { mobile, otp, name });
    const payload = response.data.data;
    const panel = 'customer';
    const nextUser = toAuthUser({ ...payload.user, panel }, panel);

    // Store panel-scoped credentials
    setStoredRole(panel, 'customer');
    setStoredUser(panel, { ...payload.user, panel });
    setAccessToken(panel, payload.accessToken);

    // Switch active context to this panel
    setActivePanel(panel);
    setActivePanelState(panel);
    setUserState(nextUser);
    setAccessTokenStateRaw(payload.accessToken);

    return nextUser;
  }, []);

  // ── Demo sign-in ──────────────────────────────────────────────────

  const signInAs = useCallback((role: AppRole) => {
    const panel = appRoleToPanel(role);
    const nextToken = `demo-token-${role}`;
    const profile = roleProfiles[role];

    setStoredRole(panel, role);
    setStoredUser(panel, {
      id: profile.id,
      name: profile.name,
      role,
      panel,
      internal_role: profile.internal_role,
      restaurantId: profile.restaurantId,
      restaurantName: profile.restaurantName,
    });
    setAccessToken(panel, nextToken);

    setActivePanel(panel);
    setActivePanelState(panel);
    setUserState(profile);
    setAccessTokenStateRaw(nextToken);
  }, []);

  // ── Sign-out ──────────────────────────────────────────────────────

  const signOut = useCallback((panel?: Panel) => {
    const targetPanel = panel ?? activePanel;
    
    // Call API to invalidate session
    const token = getAccessToken(targetPanel);
    if (token) {
      apiClient.post('/auth/logout', {}, {
        headers: { Authorization: `Bearer ${token}` }
      }).catch((e) => console.warn('Logout API call failed', e));
    }

    clearPanelSession(targetPanel);

    // If signing out from the active panel, clear state
    if (targetPanel === activePanel) {
      setUserState(null);
      setAccessTokenStateRaw(null);
    }
  }, [activePanel]);

  const signOutAll = useCallback(() => {
    const token = getAccessToken(activePanel);
    if (token) {
      apiClient.post('/auth/logout', {}, {
        headers: { Authorization: `Bearer ${token}` }
      }).catch((e) => console.warn('Logout API call failed', e));
    }

    clearAllSessions();
    setUserState(null);
    setAccessTokenStateRaw(null);
  }, [activePanel]);

  // ── Context value ─────────────────────────────────────────────────

  const value: AuthContextValue = {
    user: userState,
    accessToken: accessTokenState,
    isAuthenticated: Boolean(userState && accessTokenState),
    initializing,
    activePanel,

    getPanelUser,
    getPanelToken,
    isPanelAuthenticated,

    signIn,
    signInWithOtp,
    signInAs,
    signOut,
    signOutAll,
    switchPanel,

    setUser: setUserState,
    setAccessTokenState: setAccessTokenStateRaw,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
