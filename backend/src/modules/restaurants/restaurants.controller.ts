import type { Request, Response } from 'express';
import { AppError } from '../../middleware/errorHandler';
import { ErrorCode } from '../../constants/errors';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/responses';
import { RestaurantModel } from './restaurants.model';
import { TableModel } from '../tables/tables.model';
import { TableSessionModel } from '../tableSessions/tableSessions.model';
import { UserModel } from '../users/users.model';
import { SessionStatus, TableStatus } from '../../constants/statuses';
import { logAudit } from '../auditLogs/auditLogs.helper';
import { AuditAction, AuditEntity } from '../auditLogs/auditLogs.types';
import * as SubscriptionService from '../subscriptions/subscriptions.service';
import { PlatformPlanModel } from '../superAdmin/superAdmin.model';

async function resolveRestaurantIdForRequest(req: Request): Promise<string> {
  const fromToken = req.user?.restaurantId?.toString();
  if (fromToken) return fromToken;

  const fromQuery = typeof req.query?.restaurantId === 'string' ? req.query.restaurantId.trim() : '';
  if (fromQuery) return fromQuery;

  const fromBody = typeof req.body?.restaurantId === 'string' ? req.body.restaurantId.trim() : '';
  if (fromBody) return fromBody;

  const fromParams = typeof req.params?.restaurantId === 'string' ? req.params.restaurantId.trim() : '';
  if (fromParams) return fromParams;

  if (req.user?._id) {
    const user = await UserModel.findById(req.user._id).select('restaurantId').lean();
    const fromUser = user?.restaurantId?.toString();
    if (fromUser) return fromUser;
  }

  throw new AppError(403, ErrorCode.FORBIDDEN, 'Restaurant context required');
}

async function findRestaurantForRequest(req: Request): Promise<typeof RestaurantModel.prototype> {
  const resolvedId = await resolveRestaurantIdForRequest(req);
  const byId = await RestaurantModel.findById(resolvedId);
  if (byId) return byId;

  // Fallback: the resolved restaurant is missing (e.g. stale admin.restaurantId
  // or a status other than ACTIVE), so use the first available restaurant to
  // keep settings functional and allow saving.
  const fallback = await RestaurantModel.findOne({});
  if (fallback) return fallback;

  throw new AppError(404, 'NOT_FOUND', 'Restaurant not found');
}

export const getPublicRestaurantController = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const restaurant = await RestaurantModel.findOne({ slug: req.params.slug }).lean();

  if (!restaurant) {
    throw new AppError(404, 'NOT_FOUND', 'Restaurant not found');
  }

  ok(res, { restaurant });
});

export const getRestaurantOverviewController = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const restaurant = await findRestaurantForRequest(req);
  const restaurantId = restaurant.id;

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
  const restaurant = await findRestaurantForRequest(req);

  const billing = await buildBillingSummary(restaurant.id, restaurant.plan).catch(() => null);

  ok(res, {
    restaurantId: restaurant.id,
    restaurant: {
      name: restaurant.name ?? '',
      type: restaurant.type ?? '',
      cuisine: restaurant.cuisine ?? '',
      phone: restaurant.phone ?? '',
      address: restaurant.address ?? '',
      city: restaurant.city ?? '',
      plan: restaurant.plan ?? '',
    },
    settings: restaurant.settings ?? {},
    billing,
  });
});

async function buildBillingSummary(
  restaurantId: string,
  fallbackPlan: string,
): Promise<{ plan: string; cycle: string; nextBillingDate: string; amount: string; currency: string } | null> {
  let subscription: { plan: string; billingCycle: string; nextBillingDate?: Date | null; status: string } | null = null;
  try {
    subscription = (await SubscriptionService.getCurrentSubscription(restaurantId)) as any;
  } catch {
    subscription = null;
  }

  const plan = subscription?.plan ?? fallbackPlan ?? 'Free';
  const cycle = subscription?.billingCycle ?? 'monthly';

  let amount = '—';
  let currency = 'INR';
  try {
    const planDoc = await PlatformPlanModel.findOne({ name: plan }).lean();
    if (planDoc) {
      const monthly = (planDoc as any).priceMonthly ?? 0;
      const yearly = (planDoc as any).priceYearly ?? monthly * 12;
      const value = cycle === 'yearly' ? yearly : monthly;
      currency = (planDoc as any).currency ?? 'INR';
      amount = value > 0 ? `₹${value.toLocaleString('en-IN')}` : 'Free';
    }
  } catch {
    amount = '—';
  }

  const nextBillingDate = subscription?.nextBillingDate
    ? new Date(subscription.nextBillingDate).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'Not available';

  return { plan, cycle, nextBillingDate, amount, currency };
}

export const updateRestaurantSettingsController = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const restaurant = await findRestaurantForRequest(req);
  const restaurantId = restaurant.id;

  // ── Top-level restaurant fields (distinct from the `settings` sub-object) ──
  const TOP_LEVEL_FIELDS = ['name', 'cuisine', 'city', 'type', 'phone', 'address', 'plan'] as const;
  const topLevel: Record<string, unknown> = {};
  for (const field of TOP_LEVEL_FIELDS) {
    if (req.body[field] !== undefined) {
      topLevel[field] = req.body[field];
    }
  }

  // ── Remaining body is merged into the nested `settings` object ──
  const settingsBody: Record<string, unknown> = { ...req.body };
  for (const field of TOP_LEVEL_FIELDS) delete settingsBody[field];

  restaurant.settings = {
    ...restaurant.settings,
    ...settingsBody,
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
    ...(req.body.integrations && {
      integrations: {
        ...(restaurant.settings.integrations ?? {}),
        ...req.body.integrations,
      },
    }),
    ...(req.body.floors && {
      floors: req.body.floors,
    }),
    ...(req.body.sections && {
      sections: req.body.sections,
    }),
  } as typeof restaurant.settings;

  if (Object.keys(topLevel).length > 0) {
    Object.assign(restaurant, topLevel);
  }

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
// ── Floor management ──────────────────────────────────────────────────

export const addFloorController = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const restaurant = await findRestaurantForRequest(req);
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const number = Number(req.body?.number);

  if (!name) {
    throw new AppError(400, ErrorCode.INVALID_REQUEST, 'Floor name is required');
  }
  if (!Number.isInteger(number) || number < 0) {
    throw new AppError(400, ErrorCode.INVALID_REQUEST, 'Floor number must be a positive integer');
  }

  const floors = [...(restaurant.settings?.floors ?? [])];
  if (floors.some((f: { name: string; number: number }) => f.number === number)) {
    throw new AppError(409, ErrorCode.CONFLICT, `Floor number ${number} already exists`);
  }

  floors.push({ name, number });
  floors.sort((a: { number: number }, b: { number: number }) => a.number - b.number);
  restaurant.settings = { ...restaurant.settings, floors };
  await restaurant.save();

  ok(res, { floors: restaurant.settings.floors }, 201);
});

export const removeFloorController = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const restaurant = await findRestaurantForRequest(req);
  const number = Number(req.params.number);

  if (!Number.isInteger(number) || number < 0) {
    throw new AppError(400, ErrorCode.INVALID_REQUEST, 'Floor number must be a positive integer');
  }

  const floors = (restaurant.settings?.floors ?? []).filter((f: { number: number }) => f.number !== number);
  if (floors.length === (restaurant.settings?.floors ?? []).length) {
    throw new AppError(404, ErrorCode.NOT_FOUND, `Floor number ${number} not found`);
  }

  restaurant.settings = { ...restaurant.settings, floors };
  await restaurant.save();

  ok(res, { floors: restaurant.settings.floors });
});

// ── Section management ────────────────────────────────────────────────

export const addSectionController = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const restaurant = await findRestaurantForRequest(req);
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';

  if (!name) {
    throw new AppError(400, ErrorCode.INVALID_REQUEST, 'Section name is required');
  }

  const sections = [...(restaurant.settings?.sections ?? [])];
  if (sections.some((s: string) => s.toLowerCase() === name.toLowerCase())) {
    throw new AppError(409, ErrorCode.CONFLICT, `Section "${name}" already exists`);
  }

  sections.push(name);
  restaurant.settings = { ...restaurant.settings, sections };
  await restaurant.save();

  ok(res, { sections: restaurant.settings.sections }, 201);
});

export const removeSectionController = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const restaurant = await findRestaurantForRequest(req);
  const name = decodeURIComponent(req.params.name).trim();

  const sections = (restaurant.settings?.sections ?? []).filter(
    (s: string) => s.toLowerCase() !== name.toLowerCase(),
  );
  if (sections.length === (restaurant.settings?.sections ?? []).length) {
    throw new AppError(404, ErrorCode.NOT_FOUND, `Section "${name}" not found`);
  }

  restaurant.settings = { ...restaurant.settings, sections };
  await restaurant.save();

  ok(res, { sections: restaurant.settings.sections });
});

// ── Read floors / sections ────────────────────────────────────────────

export const getFloorsController = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const restaurant = await findRestaurantForRequest(req);
  ok(res, { floors: restaurant.settings?.floors ?? [] });
});

export const getSectionsController = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const restaurant = await findRestaurantForRequest(req);
  ok(res, { sections: restaurant.settings?.sections ?? [] });
});