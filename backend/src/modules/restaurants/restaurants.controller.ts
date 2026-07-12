import type { Request, Response } from 'express';
import { AppError } from '../../middleware/errorHandler';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/responses';
import { RestaurantModel } from './restaurants.model';
import { TableModel } from '../tables/tables.model';
import { TableSessionModel } from '../tableSessions/tableSessions.model';
import { SessionStatus, TableStatus } from '../../constants/statuses';
import { logAudit } from '../auditLogs/auditLogs.helper';
import { AuditAction, AuditEntity } from '../auditLogs/auditLogs.types';

export const getPublicRestaurantController = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const restaurant = await RestaurantModel.findOne({ slug: req.params.slug }).lean();

  if (!restaurant) {
    throw new AppError(404, 'NOT_FOUND', 'Restaurant not found');
  }

  ok(res, { restaurant });
});

export const getRestaurantOverviewController = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const restaurantId = req.user?.restaurantId;
  const restaurant = restaurantId ? await RestaurantModel.findById(restaurantId).lean() : null;

  if (!restaurant) {
    throw new AppError(404, 'NOT_FOUND', 'Restaurant not found');
  }

  const [totalTables, activeSessions, occupiedTables] = await Promise.all([
    TableModel.countDocuments({ restaurantId }),
    TableSessionModel.countDocuments({ restaurantId, status: SessionStatus.ACTIVE }),
    TableModel.countDocuments({ restaurantId, status: { $in: [TableStatus.OCCUPIED, TableStatus.ORDERING, TableStatus.BILL_PENDING, TableStatus.PAYMENT_PENDING, TableStatus.PAID] } }),
  ]);

  ok(res, {
    restaurant,
    metrics: {
      totalTables,
      activeSessions,
      occupiedTables,
    },
  });
});

export const getRestaurantSettingsController = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const restaurantId = req.user?.restaurantId;
  const restaurant = restaurantId ? await RestaurantModel.findById(restaurantId).lean() : null;

  if (!restaurant) {
    throw new AppError(404, 'NOT_FOUND', 'Restaurant not found');
  }

  ok(res, {
    restaurantId: restaurant._id?.toString(),
    settings: restaurant.settings ?? {},
  });
});

export const updateRestaurantSettingsController = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const restaurantId = req.user?.restaurantId;
  const restaurant = restaurantId ? await RestaurantModel.findById(restaurantId) : null;

  if (!restaurant) {
    throw new AppError(404, 'NOT_FOUND', 'Restaurant not found');
  }

  restaurant.settings = {
    ...restaurant.settings,
    ...req.body,
    ...(req.body.emailPreferences && {
      emailPreferences: {
        ...restaurant.settings.emailPreferences,
        ...req.body.emailPreferences,
      },
    }),
    ...(req.body.branding && {
      branding: {
        ...restaurant.settings.branding,
        ...req.body.branding,
      },
    }),
    ...(req.body.timezone && { timezone: req.body.timezone }),
    ...(req.body.dateFormat && { dateFormat: req.body.dateFormat }),
    ...(req.body.timeFormat && { timeFormat: req.body.timeFormat }),
  } as typeof restaurant.settings;

  await restaurant.save();

  ok(res, {
    restaurantId: restaurant.id,
    settings: restaurant.settings,
  });
  void logAudit(req, {
    entityType: AuditEntity.RESTAURANT,
    entityId:   restaurant.id.toString(),
    action:     AuditAction.ADMIN_SETTINGS_UPDATED,
    metadata: {
      updatedFields: Object.keys(req.body),
    },
  });
});

export const updateRestaurantProfileController = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const restaurantId = req.user?.restaurantId;
  const restaurant = restaurantId ? await RestaurantModel.findById(restaurantId) : null;

  if (!restaurant) {
    throw new AppError(404, 'NOT_FOUND', 'Restaurant not found');
  }

  const fields = [
    'ownerName', 'phone', 'address', 'city', 'state', 'country', 
    'pinCode', 'gstNumber', 'cuisine', 'branches', 
    'expectedMonthlyOrders', 'latitude', 'longitude', 'googleMapsUrl'
  ];

  for (const field of fields) {
    if (req.body[field] !== undefined) {
      (restaurant as any)[field] = req.body[field];
    }
  }

  if (
    restaurant.status === 'APPLICATION_APPROVED' as any || 
    restaurant.status === 'PENDING_APPROVAL' as any ||
    restaurant.status === 'ADMIN_SETUP_PENDING' as any ||
    restaurant.status === 'ONBOARDING' as any
  ) {
    restaurant.status = 'PLAN_SELECTION_PENDING' as any;
  }

  await restaurant.save();

  ok(res, {
    message: 'Profile updated successfully',
    restaurant,
  });

  void logAudit(req, {
    entityType: AuditEntity.RESTAURANT,
    entityId:   restaurant.id.toString(),
    action:     AuditAction.RESTAURANT_PROFILE_UPDATED,
    metadata: {
      updatedFields: Object.keys(req.body),
    },
  });
});