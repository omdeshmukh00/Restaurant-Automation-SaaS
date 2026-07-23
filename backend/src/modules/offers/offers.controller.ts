import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/responses';
import { OffersService } from './offers.service';
import { OfferModel } from './offers.model';
import { parsePagination } from '../../utils/pagination';
import { logAudit } from '../auditLogs/auditLogs.helper';
import { AuditAction, AuditEntity } from '../auditLogs/auditLogs.types';

export class OffersController {
  /**
   * POST /api/v1/admin/offers
   * Create a new offer.
   */
  static create = asyncHandler(async (req: Request, res: Response) => {
    const restaurantId = req.user!.restaurantId!;
    const offer = await OffersService.create(restaurantId, req.body);

    res.status(201).json({ success: true, data: { offer } });

    void logAudit(req, {
      entityType: AuditEntity.OFFER,
      entityId: offer._id.toString(),
      action: AuditAction.ADMIN_OFFER_CREATED,
      metadata: {
        title: offer.title,
        promoCode: offer.promoCode,
        discountType: offer.discountType,
        discountValue: offer.discountValue,
      },
    });
  });

  /**
   * GET /api/v1/admin/offers
   * List offers with pagination and filtering.
   */
  static list = asyncHandler(async (req: Request, res: Response) => {
    const restaurantId = req.user!.restaurantId!;
    const pagination = parsePagination(req.query as any);
    const result = await OffersService.list(restaurantId, {
      ...pagination,
      status: req.query.status as 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | undefined,
      q: req.query.q as string | undefined,
      sortBy: req.query.sortBy as string | undefined,
      sortOrder: req.query.sortOrder as 'asc' | 'desc' | undefined,
    });

    ok(res, result);
  });

  /**
   * GET /api/v1/admin/offers/:id
   * Get a single offer by ID.
   */
  static getById = asyncHandler(async (req: Request, res: Response) => {
    const restaurantId = req.user!.restaurantId!;
    const offer = await OffersService.getById(restaurantId, req.params.id);
    ok(res, { offer });
  });

  /**
   * PATCH /api/v1/admin/offers/:id
   * Update an offer.
   */
  static update = asyncHandler(async (req: Request, res: Response) => {
    const restaurantId = req.user!.restaurantId!;
    const offer = await OffersService.update(restaurantId, req.params.id, req.body);

    ok(res, { offer });

    void logAudit(req, {
      entityType: AuditEntity.OFFER,
      entityId: req.params.id,
      action: AuditAction.ADMIN_OFFER_UPDATED,
      metadata: {
        title: offer.title,
        updatedFields: Object.keys(req.body),
      },
    });
  });

  /**
   * DELETE /api/v1/admin/offers/:id
   * Delete an offer.
   */
  static delete = asyncHandler(async (req: Request, res: Response) => {
    const restaurantId = req.user!.restaurantId!;
    await OffersService.delete(restaurantId, req.params.id);

    ok(res, { message: 'Offer deleted successfully' });

    void logAudit(req, {
      entityType: AuditEntity.OFFER,
      entityId: req.params.id,
      action: AuditAction.ADMIN_OFFER_DELETED,
    });
  });

  /**
   * PATCH /api/v1/admin/offers/:id/toggle
   * Toggle offer status between ACTIVE and INACTIVE.
   */
  static toggleStatus = asyncHandler(async (req: Request, res: Response) => {
    const restaurantId = req.user!.restaurantId!;
    const { status } = req.body as { status: 'ACTIVE' | 'INACTIVE' };
    const offer = await OffersService.toggleStatus(restaurantId, req.params.id, status);

    ok(res, { offer });

    void logAudit(req, {
      entityType: AuditEntity.OFFER,
      entityId: req.params.id,
      action: AuditAction.ADMIN_OFFER_UPDATED,
      metadata: {
        status,
        change: 'toggle_status',
      },
    });
  });

  // ────────────────────────────────────────────────────────────────
  // CUSTOMER-FACING ENDPOINTS
  // ────────────────────────────────────────────────────────────────

  /**
   * GET /api/v1/customer/offers
   * Get active offers for the current restaurant (customer session).
   */
  static getActiveOffers = asyncHandler(async (req: Request, res: Response) => {
    const restaurantId =
      req.tableSession?.restaurantId?.toString() ||
      req.user?.restaurantId?.toString() ||
      (typeof req.query.restaurantId === 'string' ? req.query.restaurantId : null);

    if (!restaurantId) {
      ok(res, { offers: [], meta: { total: 0 } });
      return;
    }

    const offers = await OffersService.getActiveOffers(restaurantId);
    ok(res, { offers, meta: { total: offers.length } });
  });

  /**
   * GET /api/v1/public/offers
   * Get active offers for a restaurant (public, by query param).
   */
  static getPublicOffers = asyncHandler(async (req: Request, res: Response) => {
    const restaurantId = req.query.restaurantId as string;
    if (!restaurantId) {
      ok(res, { offers: [], meta: { total: 0 } });
      return;
    }

    const offers = await OffersService.getActiveOffers(restaurantId);
    ok(res, { offers, meta: { total: offers.length } });
  });
}
