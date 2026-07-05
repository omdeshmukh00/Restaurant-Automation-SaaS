import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/AppError';
import { ErrorCode } from '../constants/errors';
import { UserRole } from '../constants/roles';

export function tenantGuard(req: Request, _res: Response, next: NextFunction): void {
  // 1. Super Admin bypasses tenant isolation
  if (req.user?.role === UserRole.SUPER_ADMIN) {
    return next();
  }

  // 2. Identify the active tenant ID from the authenticated user or customer session
  const userRestaurantId = req.user?.restaurantId?.toString() || req.tableSession?.restaurantId?.toString();
  const userTenantId = req.user?.tenantId || req.tableSession?.tenantId || userRestaurantId;

  if (!userTenantId) {
    return next(new AppError('Restaurant context required', 403, ErrorCode.TENANT_VIOLATION));
  }

  // 3. Extract any candidate tenant ID or restaurant ID from request inputs
  let candidateTenantId =
    req.params.tenantId ||
    req.query.tenantId ||
    req.body.tenantId ||
    req.headers['x-tenant-id'];

  let candidateRestaurantId =
    req.params.restaurantId ||
    req.query.restaurantId ||
    req.body.restaurantId ||
    req.headers['x-restaurant-id'];

  if (req.body?.tables && Array.isArray(req.body.tables)) {
    for (const table of req.body.tables) {
      if (table.restaurantId && table.restaurantId.toString() !== userRestaurantId) {
        candidateRestaurantId = table.restaurantId;
        break;
      }
      if (table.tenantId && table.tenantId.toString() !== userTenantId) {
        candidateTenantId = table.tenantId;
        break;
      }
    }
  }

  // Mismatch verification
  if (
    (candidateTenantId && candidateTenantId.toString() !== userTenantId) ||
    (candidateRestaurantId && candidateRestaurantId.toString() !== userRestaurantId)
  ) {
    return next(
      new AppError(
        'Cross-tenant access denied',
        403,
        ErrorCode.TENANT_VIOLATION
      )
    );
  }

  // 4. Force inject/overwrite route context to match verified tenant ID (Prevent ID spoofing)
  if (req.body) {
    req.body.tenantId = userTenantId;
    req.body.restaurantId = userRestaurantId;
    if (req.body.tables && Array.isArray(req.body.tables)) {
      for (const table of req.body.tables) {
        table.tenantId = userTenantId;
        table.restaurantId = userRestaurantId;
      }
    }
  }
  if (req.query) {
    req.query.tenantId = userTenantId;
    req.query.restaurantId = userRestaurantId;
  }

  next();
}
