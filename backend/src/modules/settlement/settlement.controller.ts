// src/modules/settlement/settlement.controller.ts
// Settlement controller — exposes REST endpoints for settlement management.

import type { NextFunction, Request, Response } from 'express';
import { ok } from '../../utils/responses';
import { AppError } from '../../utils/AppError';
import { ErrorCode } from '../../constants/errors';
import { SettlementService } from './settlement.service';
import { SettlementStatus } from './settlement.model';

function getRestaurantId(req: Request): string {
  const restaurantId = req.user?.restaurantId || req.query.restaurantId;
  if (!restaurantId || typeof restaurantId !== 'string') {
    throw new AppError('Restaurant context required', 403, ErrorCode.FORBIDDEN);
  }
  return restaurantId;
}

export async function listSettlementsController(req: Request, res: Response, next: NextFunction) {
  try {
    const restaurantId = getRestaurantId(req);
    const { status, page, limit } = req.query as Record<string, string>;

    const data = await SettlementService.getSettlements(restaurantId, {
      status: status as SettlementStatus,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });

    ok(res, data);
  } catch (error) {
    next(error);
  }
}

export async function getSettlementByIdController(req: Request, res: Response, next: NextFunction) {
  try {
    const restaurantId = getRestaurantId(req);
    const { id } = req.params;

    const data = await SettlementService.getSettlementById(restaurantId, id);
    ok(res, { settlement: data });
  } catch (error) {
    next(error);
  }
}

export async function generateSettlementController(req: Request, res: Response, next: NextFunction) {
  try {
    const restaurantId = getRestaurantId(req);
    const { from, to } = req.body;

    if (!from || !to) {
      throw new AppError('from and to dates are required', 400, ErrorCode.VALIDATION_ERROR);
    }

    const settlement = await SettlementService.generateSettlement(
      restaurantId,
      new Date(from),
      new Date(to),
    );

    ok(res, { settlement }, 201);
  } catch (error) {
    next(error);
  }
}

export async function markSettlementPaidController(req: Request, res: Response, next: NextFunction) {
  try {
    const restaurantId = getRestaurantId(req);
    const { id } = req.params;

    const settlement = await SettlementService.markSettlementPaid(restaurantId, id);
    ok(res, { settlement });
  } catch (error) {
    next(error);
  }
}

export async function getSettlementSummaryController(req: Request, res: Response, next: NextFunction) {
  try {
    const restaurantId = getRestaurantId(req);

    const summary = await SettlementService.getSettlementSummary(restaurantId);
    ok(res, summary);
  } catch (error) {
    next(error);
  }
}
