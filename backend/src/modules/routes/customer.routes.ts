import { Router } from 'express';
import { requireSession } from '../../middleware/requireSession';
import { validate } from '../../middleware/validate';
import { ok } from '../../utils/responses';
import { endSession } from '../tableSessions/tableSessions.service';
import { TableSessionModel } from '../tableSessions/tableSessions.model';
import { FeedbackModel } from '../feedback/feedback.model';

import { StaffRequestModel } from '../staff/staffRequest.model';
import { ReservationModel } from '../reservations/reservations.model';
import { ReservationsService } from '../reservations/reservations.service';
import { Priority, RequestStatus, RequestType, TableStatus } from '../../constants/statuses';
import { AppError } from '../../utils/AppError';
import { ErrorCode } from '../../constants/errors';
import { feedbackBodySchema } from './customer.schema';
import { OffersController } from '../offers/offers.controller';
import { z } from 'zod';
// import { getActiveLoyaltyRule } from '../loyalty/loyalty.service';

export const customerRouter = Router();

customerRouter.use(requireSession);

function ensureFound<T>(value: T | null | undefined, message: string): T {
  if (!value) {
    throw new AppError(message, 404, ErrorCode.NOT_FOUND);
  }

  return value;
}

customerRouter.get('/session', async (req, res, next) => {
  try {
    const session = ensureFound(
      await TableSessionModel.findOne({
        _id: req.tableSession!._id,
        restaurantId: req.tableSession!.restaurantId,
      }),
      'Session not found',
    );
    ok(res, { session });
  } catch (error) {
    next(error);
  }
});

customerRouter.patch('/session/extend', async (req, res, next) => {
  try {
    const existingSession = await TableSessionModel.findOne({
      _id: req.tableSession!._id,
      restaurantId: req.tableSession!.restaurantId,
    });
    const session = ensureFound(
      existingSession,
      'Session not found',
    );

    const baseline = session.expiresAt.getTime() > Date.now() ? session.expiresAt.getTime() : Date.now();
    session.expiresAt = new Date(baseline + 30 * 60 * 1000);
    session.lastActivityAt = new Date();
    await session.save();

    ok(res, { session });
  } catch (error) {
    next(error);
  }
});

customerRouter.post('/session/end', async (req, res, next) => {
  try {
    const session = await endSession(
      req.tableSession!._id,
      req.tableSession!.restaurantId.toString(),
      'customer_closed'
    );
    ok(res, { session });
  } catch (error) {
    next(error);
  }
});

const requestTypeMap: Record<string, RequestType> = {
  waiter: RequestType.WAITER,
  water: RequestType.WATER,
  cutlery: RequestType.CUTLERY,
  help: RequestType.HELP,
  bill: RequestType.BILL,
};

for (const [path, type] of Object.entries(requestTypeMap)) {
  customerRouter.post(`/requests/${path}`, async (req, res, next) => {
    try {
      const request = await StaffRequestModel.create({
        restaurantId: req.tableSession!.restaurantId,
        sessionId: req.tableSession!._id,
        tableId: req.tableSession!.tableId,
        type,
        status: RequestStatus.PENDING,
        priority: type === RequestType.WAITER || type === RequestType.HELP ? Priority.HIGH : Priority.NORMAL,
      });

      const { socketService } = await import('../../sockets/socket.service');
      const { SocketEvent } = await import('../../constants/events');

      socketService.emitToRestaurant(req.tableSession!.restaurantId.toString(), SocketEvent.STAFF_REQUEST_NEW, { request });

      ok(res, { request }, 201);
    } catch (error) {
      next(error);
    }
  });
}

// Route cleaning directly to CleaningTaskModel
customerRouter.post('/requests/cleaning', async (req, res, next) => {
  try {
    const { CleaningTaskModel } = await import('../cleaning/cleaning.model');
    const { CleaningStatus } = await import('../../constants/statuses');
    const { updateTableStatus } = await import('../tables/tables.service');
    const { socketService } = await import('../../sockets/socket.service');
    const { SocketEvent } = await import('../../constants/events');

    const task = await CleaningTaskModel.create({
      restaurantId: req.tableSession!.restaurantId,
      tableId: req.tableSession!.tableId,
      sessionId: req.tableSession!._id,
      priority: Priority.NORMAL,
      status: CleaningStatus.PENDING,
      reason: 'customer_request',
    });

    await updateTableStatus(
      req.tableSession!.tableId.toString(),
      TableStatus.NEEDS_CLEANING,
      req.tableSession!.restaurantId.toString(),
    );

    socketService.emitToRestaurant(req.tableSession!.restaurantId.toString(), SocketEvent.CLEANING_STARTED, { task });

    ok(res, { task }, 201);
  } catch (error) {
    next(error);
  }
});



customerRouter.post('/feedback', validate({ body: feedbackBodySchema }), async (req, res, next) => {
  try {
    const feedback = await FeedbackModel.create({
      restaurantId: req.tableSession!.restaurantId,
      sessionId: req.tableSession!._id,
      rating: Number(req.body.rating),
      comment: req.body.comment ?? '',
    });

    ok(res, { feedback }, 201);
  } catch (error) {
    next(error);
  }
});

customerRouter.get('/feedback', async (req, res, next) => {
  try {
    const feedback = await FeedbackModel.find({
      restaurantId: req.tableSession!.restaurantId,
      sessionId: req.tableSession!._id,
    }).sort({ createdAt: -1 });

    ok(res, {
      feedback,
      meta: {
        count: feedback.length,
      },
    });
  } catch (error) {
    next(error);
  }
});
/*
customerRouter.get('/loyalty', async (req, res, next) => {
  try {
    const visits = await TableSessionModel.countDocuments({
      restaurantId: req.tableSession!.restaurantId,
      mobile: req.tableSession!.mobile,
    });
    const rule = await getActiveLoyaltyRule(req.tableSession!.restaurantId.toString());

    const points = visits * rule.pointsPerVisit;
    const tier = points >= rule.goldThreshold ? 'Gold' : points >= rule.silverThreshold ? 'Silver' : 'Bronze';
    const nextRewardAt = tier === 'Gold' ? rule.goldThreshold : tier === 'Silver' ? rule.goldThreshold : rule.silverThreshold;

    ok(res, {
      wallet: {
        points,
        tier,
        nextRewardAt,
        rule,
      },
    });
  } catch (error) {
    next(error);
  }
});
*/
customerRouter.get('/offers', OffersController.getActiveOffers);

const customerReservationBodySchema = z.object({
  customerName: z.string().trim().optional(),
  mobile: z.string().trim().optional(),
  guests: z.coerce.number().int().min(1).optional(),
  date: z.string().min(1),
  slot: z.string().min(1),
  tableNumber: z.string().optional(),
  notes: z.string().optional(),
  occasion: z.string().optional(),
  preferredArea: z.string().optional(),
  status: z.enum(['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CANCELLED', 'NO_SHOW', 'COMPLETED']).optional(),
});

// Customer creates a reservation for their own table session.
customerRouter.post(
  '/reservations',
  validate({ body: customerReservationBodySchema }),
  async (req, res, next) => {
    try {
      const session = req.tableSession!;

      const reservation = await ReservationsService.createReservation({
        restaurantId: session.restaurantId.toString(),
        customerName: (req.body.customerName && req.body.customerName.trim()) || session.customerName,
        mobile: (req.body.mobile && req.body.mobile.trim()) || (session.mobile && session.mobile.trim()) || '',
        guests: Number(req.body.guests) || 1,
        date: req.body.date,
        slot: req.body.slot,
        tableNumber: req.body.tableNumber,
        notes: req.body.notes,
        occasion: req.body.occasion,
        preferredArea: req.body.preferredArea,
        status: req.body.status as any || undefined,
        sessionId: session._id.toString(),
      });

      ok(res, { reservation }, 201);
    } catch (error) {
      next(error);
    }
  },
);

// Customer lists their own reservations.
customerRouter.get('/reservations', async (req, res, next) => {
  try {
    const reservations = await ReservationModel.find({
      restaurantId: req.tableSession!.restaurantId,
      sessionId: req.tableSession!._id,
    })
      .sort({ date: 1, slot: 1 })
      .lean();

    ok(res, {
      reservations,
      meta: {
        count: reservations.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Customer updates their own reservation (same-session ownership enforced).
customerRouter.patch('/reservations/:id', async (req, res, next) => {
  try {
    const updated = await ReservationsService.updateReservation(
      req.tableSession!.restaurantId.toString(),
      req.params.id,
      {
        guests: req.body.guests,
        date: req.body.date,
        slot: req.body.slot,
        notes: req.body.notes,
        occasion: req.body.occasion,
        preferredArea: req.body.preferredArea,
        status: req.body.status,
      },
    );

    // Verify the reservation belongs to this session.
    if (updated.sessionId?.toString() !== req.tableSession!._id.toString()) {
      throw new AppError('Reservation not found', 404, ErrorCode.NOT_FOUND);
    }

    ok(res, { reservation: updated });
  } catch (error) {
    next(error);
  }
});

// Customer cancels their own reservation.
customerRouter.post('/reservations/:id/cancel', async (req, res, next) => {
  try {
    const reservation = await ReservationModel.findOne({
      _id: req.params.id,
      restaurantId: req.tableSession!.restaurantId,
    }).lean();

    if (!reservation || reservation.sessionId?.toString() !== req.tableSession!._id.toString()) {
      throw new AppError('Reservation not found', 404, ErrorCode.NOT_FOUND);
    }

    const updated = await ReservationsService.updateReservation(
      req.tableSession!.restaurantId.toString(),
      req.params.id,
      { status: 'CANCELLED' as any },
    );

    ok(res, { reservation: updated });
  } catch (error) {
    next(error);
  }
});
