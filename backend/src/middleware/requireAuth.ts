import type { NextFunction, Request, Response } from 'express';
import { ErrorCode } from '../constants/errors';
import { verifyAccessToken } from '../services/jwt.service';
import { AppError } from '../utils/AppError';
import type { Panel } from '../constants/roles';
import { KitchenRole, StaffInternalRole, CleaningRole } from '../constants/roles';
import { env } from '../config/env';
import { tenantContext } from '../utils/tenantContext';

// ── Helpers for panel cookie matching ──────────────────────────────────

function panelAccessCookieName(panel: Panel): string {
  switch (panel) {
    case 'customer':
      return env.CUSTOMER_ACCESS_COOKIE;
    case 'kitchen':
      return env.KITCHEN_ACCESS_COOKIE;
    case 'staff':
      return env.STAFF_ACCESS_COOKIE;
    case 'cleaning':
      return env.CLEANING_ACCESS_COOKIE;
    case 'admin':
      return env.ADMIN_ACCESS_COOKIE;
    case 'superadmin':
      return env.SUPERADMIN_ACCESS_COOKIE;
    default:
      return env.ACCESS_COOKIE_NAME;
  }
}

function getPanelFromUrl(url: string): Panel | null {
  if (url.includes('/superadmin') || url.includes('/super-admin')) return 'superadmin';
  if (url.includes('/admin')) return 'admin';
  if (url.includes('/kitchen')) return 'kitchen';
  if (url.includes('/staff')) return 'staff';
  if (url.includes('/cleaning')) return 'cleaning';
  if (url.includes('/customer')) return 'customer';
  return null;
}

// ── Generic auth (with cookie fallback) ────────────────────────────────

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  let token: string | undefined;

  const authHeader = req.header('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  }

  if (!token) {
    // Try to get token from panel-specific access token cookie
    const panel = getPanelFromUrl(req.originalUrl);
    if (panel) {
      const cookieName = panelAccessCookieName(panel);
      token = req.cookies?.[cookieName];
    }
  }

  if (!token) {
    // Fallback: try ALL panel access cookies
    const ALL_PANELS: Panel[] = ['customer', 'kitchen', 'staff', 'cleaning', 'admin', 'superadmin'];
    for (const p of ALL_PANELS) {
      const cookieName = panelAccessCookieName(p);
      const cookieVal = req.cookies?.[cookieName];
      if (cookieVal) {
        token = cookieVal;
        break;
      }
    }
  }

  if (!token) {

    next(new AppError('Authentication required', 401, ErrorCode.UNAUTHORIZED));
    return;
  }

  try {
    const payload = verifyAccessToken(token);

    req.user = {
      _id: payload._id,
      id: payload._id,
      email: payload.email,
      role: payload.role,
      restaurantId: payload.restaurantId,
      tenantId: payload.tenantId,
      panel: payload.panel,
      internal_role: payload.internal_role,
      mustChangePassword: payload.mustChangePassword,
      mustResetPassword: payload.mustResetPassword,
      firstLogin: payload.firstLogin,
    };

    if (payload.tenantId) {
      tenantContext.run({ tenantId: payload.tenantId }, () => {
        next();
      });
    } else {
      next();
    }
  } catch (error) {
    next(error as Error);
  }
}

export function attachUser(req: Request, _res: Response, next: NextFunction): void {
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token) {
    const panel = getPanelFromUrl(req.originalUrl);
    if (panel) {
      token = req.cookies?.[panelAccessCookieName(panel)];
    }
  }

  if (token) {
    try {
      const decoded = verifyAccessToken(token);

      req.user = {
        _id: decoded._id,
        id: decoded._id,
        email: decoded.email,
        role: decoded.role,
        restaurantId: decoded.restaurantId,
        tenantId: decoded.tenantId,
        panel: decoded.panel,
        internal_role: decoded.internal_role,
        mustResetPassword: decoded.mustResetPassword,
        firstLogin: decoded.firstLogin,
      };

      if (decoded.tenantId) {
        return tenantContext.run({ tenantId: decoded.tenantId }, () => {
          next();
        });
      }
    } catch {
      // Silent fail; req.user remains undefined.
    }
  }

  next();
}

// ── Panel-specific authentication middlewares ──────────────────────────
// Each one calls requireAuth first, then verifies the token's `panel` claim.
// STRICT ISOLATION: No role fallbacks.

const PANEL_HIERARCHY: Record<Panel, Panel[]> = {
  customer: ['customer'],
  kitchen: ['kitchen', 'admin', 'superadmin'],
  staff: ['staff', 'admin', 'superadmin'],
  cleaning: ['cleaning', 'admin', 'superadmin'],
  admin: ['admin', 'superadmin'],
  superadmin: ['superadmin'],
};


function authenticatePanel(expectedPanel: Panel) {
  return (req: Request, res: Response, next: NextFunction): void => {
    requireAuth(req, res, (err?: unknown) => {
      if (err) {
        next(err);
        return;
      }

      if (!req.user) {
        next(new AppError('Authentication required', 401, ErrorCode.UNAUTHORIZED));
        return;
      }

      const allowedPanels = PANEL_HIERARCHY[expectedPanel] || [expectedPanel];
      if (!allowedPanels.includes(req.user.panel as Panel)) {
        next(
          new AppError(
            `This endpoint requires ${expectedPanel} panel authentication`,
            403,
            ErrorCode.FORBIDDEN,
          ),
        );
        return;
      }

      next();
    });
  };
}

export const authenticateCustomer   = authenticatePanel('customer');
export const authenticateKitchen    = authenticatePanel('kitchen');
export const authenticateStaff      = authenticatePanel('staff');
export const authenticateCleaning   = authenticatePanel('cleaning');
export const authenticateAdmin      = authenticatePanel('admin');
export const authenticateSuperAdmin = authenticatePanel('superadmin');

// ── Internal role authorization guards ────────────────────────────────
// Usage: router.use(authenticateKitchen, requireKitchenRole(['HEAD_CHEF', 'KITCHEN_SUPERVISOR']))

export function requireKitchenRole(allowedRoles: KitchenRole[]) {
  return (_req: Request, _res: Response, next: NextFunction): void => {
    if (!_req.user) {
      next(new AppError('Authentication required', 401, ErrorCode.UNAUTHORIZED));
      return;
    }

    const internalRole = _req.user.internal_role as KitchenRole | undefined;

    if (_req.user.role === 'restaurant-admin' || _req.user.role === 'super-admin') {
      return next();
    }

    if (!internalRole || !allowedRoles.includes(internalRole)) {
      next(
        new AppError(
          `Requires one of: ${allowedRoles.join(', ')}`,
          403,
          ErrorCode.FORBIDDEN,
        ),
      );
      return;
    }

    next();
  };
}

export function requireStaffRole(allowedRoles: StaffInternalRole[]) {
  return (_req: Request, _res: Response, next: NextFunction): void => {
    if (!_req.user) {
      next(new AppError('Authentication required', 401, ErrorCode.UNAUTHORIZED));
      return;
    }

    const internalRole = _req.user.internal_role as StaffInternalRole | undefined;

    if (!internalRole || !allowedRoles.includes(internalRole)) {
      next(
        new AppError(
          `Requires one of: ${allowedRoles.join(', ')}`,
          403,
          ErrorCode.FORBIDDEN,
        ),
      );
      return;
    }

    next();
  };
}

export function requireCleaningRole(allowedRoles: CleaningRole[]) {
  return (_req: Request, _res: Response, next: NextFunction): void => {
    if (!_req.user) {
      next(new AppError('Authentication required', 401, ErrorCode.UNAUTHORIZED));
      return;
    }

    const internalRole = _req.user.internal_role as CleaningRole | undefined;

    if (!internalRole || !allowedRoles.includes(internalRole)) {
      next(
        new AppError(
          `Requires one of: ${allowedRoles.join(', ')}`,
          403,
          ErrorCode.FORBIDDEN,
        ),
      );
      return;
    }

    next();
  };
}