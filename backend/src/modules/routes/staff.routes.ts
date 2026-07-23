import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { TableModel } from '../tables/tables.model';
import queueRouter from '../queue/queue.routes';
import { ReservationModel } from '../reservations/reservations.model';
import reservationsRouter from '../reservations/reservations.routes';
import { StaffRequestModel } from '../staff/staffRequest.model';
import { AuditLogModel } from '../auditLogs/auditLogs.schema';
import { AuditAction, AuditEntity } from '../auditLogs/auditLogs.types';
import { ok } from '../../utils/responses';
import { RequestStatus, TableStatus } from '../../constants/statuses';
import { validate } from '../../middleware/validate';
import * as tablesService from '../tables/tables.service';
import {
  assignTableBodySchema,
  entityIdParamsSchema,
  issueEscalationBodySchema,
  occupyTableBodySchema,
  requestAcceptBodySchema,
  requestCompleteBodySchema,
  reserveTableBodySchema,
  staffTablesQuerySchema,
} from '../staff/staff.schema';
import { AppError } from '../../utils/AppError';
import { ErrorCode } from '../../constants/errors';

export const staffRouter = Router();

function ensureFound<T>(value: T | null | undefined, message: string): T {
  if (!value) {
    throw new AppError(message, 404, ErrorCode.NOT_FOUND);
  }

  return value;
}

staffRouter.get('/tables', validate({ query: staffTablesQuerySchema }), async (req, res, next) => {
  try {
    const restaurantId = req.user?.restaurantId;
    const { status, floor, section } = req.query;
    const query: Record<string, unknown> = {};
    if (restaurantId) {
      query.restaurantId = new mongoose.Types.ObjectId(restaurantId);
    }

    if (status) {
      if (status === 'OCCUPIED') {
        query.status = { $in: ['OCCUPIED', 'ORDERING', 'BILL_PENDING', 'PAYMENT_PENDING', 'PAID'] };
      } else {
        query.status = status;
      }
    }
    if (floor) query.floor = Number(floor);
    if (section) query.section = String(section);

    const tables = await TableModel.find(query).sort({ floor: 1, tableNumber: 1 });
    ok(res, {
      tables,
      meta: {
        count: tables.length,
        filters: {
          status: status ?? null,
          floor: floor ?? null,
          section: section ?? null,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

staffRouter.get('/tables/:id', validate({ params: entityIdParamsSchema }), async (req, res, next) => {
  try {
    const table = ensureFound(
      await TableModel.findOne({
        _id: req.params.id,
        restaurantId: req.user?.restaurantId,
      }),
      'Table not found',
    );
    ok(res, { table });
  } catch (error) {
    next(error);
  }
});

import { OrdersController } from '../orders/orders.controller';
import { emitSessionEvent } from '../../services/sessionEvents';

staffRouter.patch(
  '/tables/:id/assign-waiter',
  async (req, res, next) => {
    try {
      const staffId = req.body?.waiterId ?? req.body?.staffId ?? req.user?.id ?? null;
      const table = ensureFound(
        await TableModel.findOneAndUpdate(
          {
            _id: req.params.id,
            restaurantId: req.user?.restaurantId,
          },
          {
            assignedStaffId: staffId,
            assignedWaiterId: staffId,
          },
          { new: true },
        ),
        'Table not found',
      ) as any;

      if (req.user?.restaurantId) {
        emitSessionEvent(req.user.restaurantId, 'staff.table.waiter_assigned', {
          tableId: table._id,
          tableNumber: table.tableNumber,
          assignedWaiterId: staffId,
        });
      }

      ok(res, { table });
    } catch (error) {
      next(error);
    }
  }
);

staffRouter.patch(
  '/tables/:id/assign',
  validate({ params: entityIdParamsSchema, body: assignTableBodySchema }),
  async (req, res, next) => {
  try {
    const table = ensureFound(
      await TableModel.findOneAndUpdate(
        {
          _id: req.params.id,
          restaurantId: req.user?.restaurantId,
        },
        {
          assignedStaffId: req.body?.staffId ?? req.user?.id ?? null,
          assignedWaiterId: req.body?.staffId ?? req.user?.id ?? null,
        },
        { new: true },
      ),
      'Table not found',
    ) as any;

    ok(res, { table });
  } catch (error) {
    next(error);
  }
});

staffRouter.patch(
  '/tables/:id/reserve',
  validate({ params: entityIdParamsSchema, body: reserveTableBodySchema }),
  async (req, res, next) => {
  try {
    if (req.body?.reservationId) {
      ensureFound(
        await ReservationModel.findOne({
          _id: req.body.reservationId,
          restaurantId: req.user?.restaurantId,
        }),
        'Reservation not found',
      );
    }

    const table = await tablesService.updateTableStatus(
      req.params.id,
      TableStatus.RESERVED,
      req.user!.restaurantId!
    );

    if (req.body?.reservationId) {
      await ReservationModel.findOneAndUpdate(
        {
          _id: req.body.reservationId,
          restaurantId: req.user?.restaurantId,
        },
        {
          tableId: table._id,
        },
      );
    }

    ok(res, { table, reservationId: req.body?.reservationId ?? null });
  } catch (error) {
    next(error);
  }
});

staffRouter.patch(
  '/tables/:id/occupy',
  validate({ params: entityIdParamsSchema, body: occupyTableBodySchema }),
  async (req, res, next) => {
  try {
    const table = await tablesService.updateTableStatus(
      req.params.id,
      TableStatus.OCCUPIED,
      req.user!.restaurantId!
    );

    ok(res, { table, occupiedBy: req.body?.staffId ?? req.user?.id ?? null });
  } catch (error) {
    next(error);
  }
});

staffRouter.patch(
  '/tables/:id/status',
  validate({
    params: entityIdParamsSchema,
    body: z.object({
      status: z.nativeEnum(TableStatus),
    }),
  }),
  async (req, res, next) => {
    try {
      const table = await tablesService.updateTableStatus(
        req.params.id,
        req.body.status,
        req.user!.restaurantId!
      );
      ok(res, { table });
    } catch (error) {
      next(error);
    }
  }
);

staffRouter.use('/queue', queueRouter);

staffRouter.use('/reservations', reservationsRouter);

staffRouter.get('/requests', async (req, res, next) => {
  try {
    const requests = await StaffRequestModel.find({
      restaurantId: req.user?.restaurantId,
    }).populate('tableId').sort({ createdAt: -1 });

    ok(res, {
      requests,
      meta: {
        count: requests.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

staffRouter.patch(
  '/requests/:id/accept',
  validate({ params: entityIdParamsSchema, body: requestAcceptBodySchema }),
  async (req, res, next) => {
  try {
    const request = ensureFound(
      await StaffRequestModel.findOneAndUpdate(
        {
          _id: req.params.id,
          restaurantId: req.user?.restaurantId,
        },
        {
          status: RequestStatus.ACCEPTED,
          acceptedBy: req.body?.staffId ?? req.user?.id ?? null,
        },
        { new: true },
      ),
      'Staff request not found',
    ) as any;

    if (req.user?.restaurantId) {
      emitSessionEvent(req.user.restaurantId.toString(), 'staff.request.accepted', {
        requestId: request._id,
        tableId: request.tableId,
        sessionId: request.sessionId,
        type: request.type,
        acceptedBy: request.acceptedBy,
      });
      emitSessionEvent(req.user.restaurantId.toString(), 'staff:request-updated', {
        requestId: request._id,
        status: RequestStatus.ACCEPTED,
      });
    }

    ok(res, { request, acceptedBy: req.body?.staffId ?? req.user?.id ?? null });
  } catch (error) {
    next(error);
  }
});

staffRouter.patch(
  '/requests/:id/complete',
  validate({ params: entityIdParamsSchema, body: requestCompleteBodySchema }),
  async (req, res, next) => {
  try {
    const request = ensureFound(
      await StaffRequestModel.findOneAndUpdate(
        {
          _id: req.params.id,
          restaurantId: req.user?.restaurantId,
        },
        {
          status: RequestStatus.COMPLETED,
          completedBy: req.body?.staffId ?? req.user?.id ?? null,
        },
        { new: true },
      ),
      'Staff request not found',
    ) as any;

    if (req.user?.restaurantId) {
      emitSessionEvent(req.user.restaurantId.toString(), 'staff.request.completed', {
        requestId: request._id,
        tableId: request.tableId,
        sessionId: request.sessionId,
        type: request.type,
        completedBy: request.completedBy,
      });
      emitSessionEvent(req.user.restaurantId.toString(), 'staff:request-updated', {
        requestId: request._id,
        status: RequestStatus.COMPLETED,
      });
    }
    
    ok(res, { request });
  } catch (error) {
    next(error);
  }
});

staffRouter.post('/issues/escalate', validate({ body: issueEscalationBodySchema }), async (req, res, next) => {
  try {
    const escalation = await AuditLogModel.create({
      actorId: req.body?.staffId ?? req.user?.id ?? null,
      actorRole: req.user?.role || 'staff',
      restaurantId: req.user?.restaurantId || null,
      entityType: AuditEntity.TABLE,
      entityId: req.body.entityId,
      action: AuditAction.ESCALATE_ISSUE,
      metadata: {
        restaurantId: req.user?.restaurantId,
        entityType: req.body.entityType ?? null,
        notes: req.body.notes ?? null,
      },
    });

    if (req.user?.restaurantId) {
      emitSessionEvent(req.user.restaurantId, 'staff.ticket.created', {
        ticketId: escalation._id,
        reporterId: req.user?.id,
        notes: req.body.notes,
      });
    }

    ok(res, { escalation, ticket: escalation }, 201);
  } catch (error) {
    next(error);
  }
});

staffRouter.post('/tickets', async (req, res, next) => {
  try {
    const { category, priority, subject, description, tableId, entityId } = req.body;
    const escalation = await AuditLogModel.create({
      actorId: req.user?.id || null,
      actorRole: req.user?.role || 'staff',
      restaurantId: req.user?.restaurantId || null,
      entityType: AuditEntity.TABLE,
      entityId: entityId || tableId || 'STAFF_TICKET',
      action: AuditAction.ESCALATE_ISSUE,
      metadata: {
        restaurantId: req.user?.restaurantId,
        category: category || 'GENERAL',
        priority: priority || 'HIGH',
        subject: subject || 'Escalation Ticket',
        description: description || '',
        notes: `[${category || 'GENERAL'} - ${priority || 'HIGH'}] ${subject}: ${description}`,
      },
    });

    if (req.user?.restaurantId) {
      emitSessionEvent(req.user.restaurantId, 'staff.ticket.created', {
        ticketId: escalation._id,
        reporterId: req.user?.id,
        category,
        priority,
        subject,
        description,
      });
    }

    ok(res, { ticket: escalation, escalation }, 201);
  } catch (error) {
    next(error);
  }
});

staffRouter.post('/orders/:id/apply-offer', OrdersController.applyWaiterOffer);
staffRouter.post('/send-phone-otp', async (req, res, next) => {
  try {
    const { phone } = req.body || {};
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    console.log(`
================================================================================
 📲 [STAFF PHONE VERIFICATION OTP]
 Staff User: ${req.user?.email || req.user?.id || 'Staff Member'}
 Target Mobile: ${phone || 'Unknown Phone'}
 Terminal OTP Code:  >>> ${otp} <<<
 Timestamp: ${new Date().toLocaleTimeString()}
================================================================================
    `);
    ok(res, { success: true, otp, message: 'OTP sent to backend terminal console' });
  } catch (error) {
    next(error);
  }
});
staffRouter.post('/tables', async (req, res, next) => {
  try {
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId) {
      throw new AppError('Restaurant context required', 400, ErrorCode.VALIDATION_ERROR);
    }
    const { tableNumber, capacity, section, floor } = req.body || {};
    const table = await tablesService.createTable({
      restaurantId: restaurantId.toString(),
      tableNumber: String(tableNumber),
      capacity: Number(capacity || 4),
      section: section || 'Zone A',
      floor: Number(floor || 1),
    });
    ok(res, { table }, 201);
  } catch (error) {
    next(error);
  }
});
staffRouter.get('/offers', OrdersController.getActiveOffers);
staffRouter.get('/tables/:id/guest-loyalty', OrdersController.getTableGuestLoyaltyAndOffers);
