import type { NextFunction, Request, Response } from 'express';
import { ErrorCode } from '../../constants/errors';
import { AppError } from '../../utils/AppError';
import { ok } from '../../utils/responses';
import { CustomersService } from './customers.service';

function resolveRestaurantId(req: Request, candidate?: unknown): string {
  if (req.user?.restaurantId) {
    return req.user.restaurantId;
  }
  if (typeof candidate === 'string' && candidate.trim()) {
    return candidate.trim();
  }
  throw new AppError('Restaurant context required', 403, ErrorCode.FORBIDDEN);
}

export async function listCustomersController(req: Request, res: Response, next: NextFunction) {
  try {
    const restaurantId = resolveRestaurantId(req, (req.query as any).restaurantId);
    const result = await CustomersService.getAdminCustomers(restaurantId, {
      status: (req.query as any).status,
      tier: (req.query as any).tier,
      q: (req.query as any).q,
      page: req.query.page ? Number(req.query.page) : undefined,
      perPage: req.query.perPage ? Number(req.query.perPage) : undefined,
    });
    ok(res, result);
  } catch (err) {
    next(err);
  }
}

export async function createCustomerController(req: Request, res: Response, next: NextFunction) {
  try {
    const restaurantId = resolveRestaurantId(req, req.body.restaurantId);
    const customer = await CustomersService.createCustomer(restaurantId, {
      name: req.body.name,
      mobile: req.body.mobile,
      email: req.body.email,
      tags: req.body.tags,
    });
    ok(res, { customer });
  } catch (err) {
    next(err);
  }
}

export async function getCustomerController(req: Request, res: Response, next: NextFunction) {
  try {
    const restaurantId = resolveRestaurantId(req, (req.query as any).restaurantId);
    const customer = await CustomersService.getCustomerById(restaurantId, req.params.id);
    ok(res, { customer });
  } catch (err) {
    next(err);
  }
}

export async function updateCustomerController(req: Request, res: Response, next: NextFunction) {
  try {
    const restaurantId = resolveRestaurantId(req, req.body.restaurantId);
    const customer = await CustomersService.updateCustomer(restaurantId, req.params.id, {
      name: req.body.name,
      email: req.body.email,
      tags: req.body.tags,
    });
    ok(res, { customer });
  } catch (err) {
    next(err);
  }
}

export async function deleteCustomerController(req: Request, res: Response, next: NextFunction) {
  try {
    const restaurantId = resolveRestaurantId(req, (req.query as any).restaurantId);
    await CustomersService.deleteCustomer(restaurantId, req.params.id);
    ok(res, { success: true });
  } catch (err) {
    next(err);
  }
}
