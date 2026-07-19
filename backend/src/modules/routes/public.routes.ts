import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { sessionLimiter } from '../../middleware/rateLimiters';
import {
  initTableSessionController,
  createTableSessionController,
  validateTableSessionController,
  recoverSession,
} from '../tableSessions/tableSessions.controller';
import { getAvailabilityController } from '../reservations/reservations.controller';
import { joinQueueController } from '../queue/queue.controller';
import { reservationAvailabilityQuerySchema } from '../reservations/reservations.schema';
import { publicQueueJoinBodySchema } from '../queue/queue.schema';
import { MenuItem, Category } from '../menu/menu.model';
import { RestaurantModel } from '../restaurants/restaurants.model';
import { OfferModel } from '../offers/offers.model';
import { TableModel } from '../tables/tables.model';
import { ReservationModel } from '../reservations/reservations.model';
import { QueueEntryModel } from '../queue/queue.model';
import { RestaurantStatus, TableStatus, ReservationStatus } from '../../constants/statuses';
import { ok } from '../../utils/responses';
import { AppError } from '../../utils/AppError';
import { ErrorCode } from '../../constants/errors';
import { z } from 'zod';

import { attachUser } from '../../middleware/requireAuth';
import { restaurantSlugParamSchema } from '../restaurants/restaurants.schema';
import { QueueService } from '../queue/queue.service';

export const publicRouter = Router();

// ── POST /api/v1/public/table-session/init ───────────────────────────
// Body: { token: string }
// Called when a customer scans the QR code on the table
const initSessionBodySchema = z.object({
  token: z.string().trim().min(1, 'Token is required'),
});

publicRouter.post(
  '/table-session/init',
  sessionLimiter,
  attachUser,
  validate({ body: initSessionBodySchema }),
  initTableSessionController,
);

publicRouter.post(
  '/table-session/create',
  sessionLimiter,
  createTableSessionController,
);

publicRouter.post(
  '/table-session/validate',
  validateTableSessionController,
);

publicRouter.get(
  '/table-session/recover',
  recoverSession,
);

publicRouter.get(
  '/reservations/availability',
  validate({ query: reservationAvailabilityQuerySchema }),
  getAvailabilityController,
);

publicRouter.post(
  '/queue/join',
  validate({ body: publicQueueJoinBodySchema }),
  joinQueueController,
);

// ── GET /api/v1/public/menu?restaurantId=xxx ─────────────────────────
// Returns the full menu for a restaurant (public, no auth needed)
publicRouter.get('/menu', async (req, res, next) => {
  try {
    const { restaurantId } = req.query;
    if (!restaurantId || typeof restaurantId !== 'string') {
      throw new AppError('restaurantId query parameter is required', 400, ErrorCode.INVALID_REQUEST);
    }

    const restaurant = await RestaurantModel.findById(restaurantId);
    if (!restaurant) {
      throw new AppError('Restaurant not found', 404, ErrorCode.NOT_FOUND);
    }

    const categories = await Category.find({
      restaurantId,
      isActive: true,
      isHidden: false,
    }).sort({ displayOrder: 1 });

    const menuItems = await MenuItem.find({
      restaurantId,
      isHidden: false,
    }).sort({ displayOrder: 1 });

    ok(res, {
      restaurant: {
        _id: restaurant._id,
        name: restaurant.name,
        cuisine: restaurant.cuisine,
        settings: restaurant.settings,
      },
      categories,
      menuItems,
    });
  } catch (error) {
    next(error);
  }
});

// ── GET /api/v1/public/landing/data ──────────────────────────────────
// Returns active restaurants, dishes, offers, and live stats for the landing page
publicRouter.get('/landing/data', async (req, res, next) => {
  try {
    const restaurants = await RestaurantModel.find({ status: RestaurantStatus.ACTIVE }).lean();
    const offers = await OfferModel.find({ active: true }).lean();
    const dishes = await MenuItem.find().limit(12).lean();

    const cuisinesSet = new Set<string>();
    restaurants.forEach((r) => {
      if (r.cuisine) {
        r.cuisine.split(',').forEach((c) => {
          const trimmed = c.trim();
          if (trimmed) {
            cuisinesSet.add(trimmed);
          }
        });
      }
    });
    const cuisines = Array.from(cuisinesSet);

    const [totalTablesAvailable, totalActiveRestaurants, reservationsTodayCount, offersCount] = await Promise.all([
      TableModel.countDocuments({ status: TableStatus.AVAILABLE, isActive: true }),
      RestaurantModel.countDocuments({ status: RestaurantStatus.ACTIVE }),
      ReservationModel.countDocuments({
        status: ReservationStatus.CONFIRMED,
        date: new Date().toISOString().split('T')[0]
      }),
      OfferModel.countDocuments({ active: true })
    ]);

    ok(res, {
      restaurants,
      offers,
      dishes,
      cuisines,
      stats: {
        tablesAvailable: totalTablesAvailable || 120,
        restaurantsOpen: totalActiveRestaurants || 85,
        reservationsToday: reservationsTodayCount || 340,
        offersRunning: offersCount || 50,
        averageWaitTime: 15,
        averageRating: 4.8
      }
    });
  } catch (error) {
    next(error);
  }
});

// ── POST /api/v1/public/landing/reserve ────────────────────────────────
// Public endpoint to book a reservation from the landing page
publicRouter.post('/landing/reserve', async (req, res, next) => {
  try {
    const { ReservationsService } = await import('../reservations/reservations.service');
    const { ReservationStatus } = await import('../../constants/statuses');

    const { restaurantId, guests, date, slot, mobile, customerName } = req.body;
    if (!restaurantId || !date || !slot || !mobile || !guests) {
      throw new AppError('Missing required fields', 400, ErrorCode.INVALID_REQUEST);
    }

    const reservation = await ReservationsService.createReservation({
      restaurantId,
      customerName: customerName || 'Guest',
      mobile,
      guests: Number(guests),
      date,
      slot,
      status: ReservationStatus.CONFIRMED,
    });

    ok(res, { reservation }, 201);
  } catch (error) {
    next(error);
  }
});

// ── Onboarding / Partner Application Routes ──────────────────────────
import {
  createRazorpayOrderForPlan,
  submitPartnerRequest,
  verifyPartnerRequestPayment,
  recoverPartnerRequest,
} from '../superAdmin/restaurantRequest.controller';

publicRouter.post('/partner-request/create-order', createRazorpayOrderForPlan);
publicRouter.post('/partner-request', submitPartnerRequest);
publicRouter.post('/partner-request/verify-payment', verifyPartnerRequestPayment);
publicRouter.post('/partner-request/recover', recoverPartnerRequest);

import { getPlatformSettings } from '../superAdmin/platformSettings.model';
publicRouter.get('/platform-settings', async (_req, res, next) => {
  try {
    const settings = await getPlatformSettings();
    ok(res, settings);
  } catch (error) {
    next(error);
  }
});

import { listPlans } from '../superAdmin/superAdmin.service';
publicRouter.get('/plans', async (_req, res, next) => {
  try {
    const plans = await listPlans(true);
    ok(res, { plans });
  } catch (error) {
    next(error);
  }
});

