import mongoose from 'mongoose';
import { ErrorCode } from '../../constants/errors';
import { AppError } from '../../utils/AppError';
import { ReservationModel, NotificationPreference } from './reservations.model';
import { TableModel } from '../tables/tables.model';
import { TableSessionModel } from '../tableSessions/tableSessions.model';
import { CustomerProfileModel } from '../analytics/customerProfile.model';
import { ReservationStatus, SessionStatus, TableStatus } from '../../constants/statuses';
import { generateSecureToken } from '../../utils/crypto';
import { RestaurantModel } from '../restaurants/restaurants.model';
import logger from '../../config/logger';
import { MessagingService } from '../../services/messaging.service';
import { assertFeatureAccess, assertPlanLimit, recordSubscriptionUsage } from '../subscriptions/subscriptionEnforcement.service';
import { socketService } from '../../sockets/socket.service';
import { SocketEvent } from '../../constants/events';
import { NotificationsService } from '../notifications/notifications.service';
import { UserRole } from '../../constants/roles';
import { NotificationCategory, NotificationPriority } from '../notifications/notifications.schema';

/**
 * Computes a unique table-slot lock key.
 * Format: `${restaurantId}_${tableId}_${date}_${slot}`
 * This is used in a sparse unique index to prevent double-booking at the DB level.
 */
function buildTableSlotLock(restaurantId: string, tableId: string, date: string, slot: string): string {
  return `${restaurantId}_${tableId}_${date}_${slot}`;
}

/**
 * Parses a time slot like "18:00" or "07:00 PM" into a Date object for the given date.
 */
function slotToDateTime(date: string, slot: string): Date {
  let hour = 0;
  let minute = 0;

  const match24 = /^(\d{1,2}):(\d{2})$/.exec(slot.trim());
  if (match24) {
    hour = Number(match24[1]);
    minute = Number(match24[2]);
  } else {
    const match12 = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(slot.trim());
    if (match12) {
      hour = Number(match12[1]);
      minute = Number(match12[2]);
      const period = match12[3].toUpperCase();
      if (period === 'PM' && hour < 12) hour += 12;
      if (period === 'AM' && hour === 12) hour = 0;
    }
  }

  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, hour, minute, 0, 0);
}

/**
 * Finds a suitable available table for a reservation.
 */
async function findSuitableTable(
  restaurantId: string,
  date: string,
  slot: string,
  guests: number,
  preferredTableNumber?: string,
): Promise<{ tableId: string; tableNumber: string }> {
  const activeStatuses = [
    ReservationStatus.PENDING,
    ReservationStatus.CONFIRMED,
    ReservationStatus.ARRIVED,
    ReservationStatus.CHECKED_IN,
  ];

  if (preferredTableNumber) {
    const table = await TableModel.findOne({
      restaurantId,
      tableNumber: preferredTableNumber,
      capacity: { $gte: guests },
    });

    if (!table) {
      throw new AppError(
        `Table ${preferredTableNumber} not found or cannot accommodate ${guests} guests`,
        404,
        ErrorCode.NOT_FOUND,
      );
    }

    const conflicting = await ReservationModel.findOne({
      restaurantId,
      tableId: table._id,
      date,
      slot,
      status: { $in: activeStatuses },
    });

    if (conflicting) {
      throw new AppError(
        `Table ${preferredTableNumber} is already reserved for ${date} at ${slot}. Please choose a different table or time.`,
        409,
        ErrorCode.CONFLICT,
      );
    }

    return { tableId: table._id.toString(), tableNumber: preferredTableNumber };
  }

  const reservedTableIds = await ReservationModel.distinct('tableId', {
    restaurantId,
    date,
    slot,
    status: { $in: activeStatuses },
    tableId: { $ne: null },
  });

  const availableTable = await TableModel.findOne({
    restaurantId,
    _id: { $nin: reservedTableIds },
    capacity: { $gte: guests },
    status: { $in: [TableStatus.AVAILABLE, TableStatus.RESERVED] },
    isActive: true,
  }).sort({ capacity: 1 });

  if (!availableTable) {
    throw new AppError(
      'Tables are unavailable for the selected time. Please choose a different reservation time.',
      409,
      ErrorCode.TABLE_ALREADY_OCCUPIED,
    );
  }

  return { tableId: availableTable._id.toString(), tableNumber: availableTable.tableNumber };
}

export class ReservationsService {
  static async createReservation(data: {
    restaurantId: string;
    customerName: string;
    customerEmail?: string;
    mobile: string;
    guests: number;
    date: string;
    slot: string;
    notes?: string;
    occasion?: string;
    preferredArea?: string;
    status?: ReservationStatus;
    tableNumber?: string;
    sessionId?: string;
    notificationPreference?: NotificationPreference;
  }) {
    await assertFeatureAccess(data.restaurantId, 'reservationAccess', 'Reservations');

    const currentActivity = await ReservationModel.countDocuments({ restaurantId: data.restaurantId });
    await assertPlanLimit(data.restaurantId, 'reservationLimit', currentActivity + 1, 'Reservations');

    let customer = await CustomerProfileModel.findOne({ mobile: data.mobile });
    if (!customer) {
      try {
        customer = await CustomerProfileModel.create({
          mobile: data.mobile,
          name: data.customerName,
          restaurantsVisited: [data.restaurantId],
          totalVisits: 0,
          totalSpent: 0,
        });
      } catch (err: any) {
        if (err?.code === 11000) {
          customer = await CustomerProfileModel.findOne({ mobile: data.mobile });
        }
        if (!customer) throw err;
      }
    } else {
      await CustomerProfileModel.updateOne(
        { _id: customer._id },
        { $set: { name: data.customerName }, $addToSet: { restaurantsVisited: data.restaurantId } }
      );
    }

    const { tableId, tableNumber } = await findSuitableTable(
      data.restaurantId,
      data.date,
      data.slot,
      data.guests,
      data.tableNumber,
    );

    const tableSlotLock = buildTableSlotLock(data.restaurantId, tableId, data.date, data.slot);

    let reservation;
    try {
      reservation = await ReservationModel.create({
        restaurantId: data.restaurantId,
        customerProfileId: customer._id,
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        mobile: data.mobile,
        guests: data.guests,
        date: data.date,
        slot: data.slot,
        tableId,
        tableSlotLock,
        reservationExpiresAt: null,
        reservedAt: null,
        notes: data.notes,
        occasion: data.occasion,
        preferredArea: data.preferredArea || null,
        status: data.status || ReservationStatus.CONFIRMED,
        sessionId: data.sessionId ? new mongoose.Types.ObjectId(data.sessionId) : null,
        notificationPreference: data.notificationPreference || NotificationPreference.NONE,
      });
    } catch (err: any) {
      if (err?.code === 11000) {
        if (data.tableNumber) {
          throw new AppError(
            `Table ${data.tableNumber} is already reserved for ${data.date} at ${data.slot}.`,
            409,
            ErrorCode.CONFLICT,
          );
        }
        throw new AppError(
          'Tables are unavailable for the selected time. Please choose a different reservation time.',
          409,
          ErrorCode.TABLE_ALREADY_OCCUPIED,
        );
      }
      throw err;
    }

    const reservationActivity = await ReservationModel.countDocuments({ restaurantId: data.restaurantId });
    await recordSubscriptionUsage(data.restaurantId, 'reservationActivity', reservationActivity);

    if (reservation.status === ReservationStatus.CONFIRMED) {
      this.triggerNotifications(reservation).catch(e => logger.error('Async notification error', e));
    }

    // Notify admin about new reservation
    NotificationsService.createNotification({
      restaurantId: data.restaurantId,
      recipientRole: UserRole.RESTAURANT_ADMIN,
      title: 'New Reservation',
      message: `${data.customerName} reserved a table for ${data.guests} guests on ${data.date} at ${data.slot}.`,
      type: 'RESERVATION_NEW',
      entityId: reservation._id.toString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    }).catch(() => {});

    socketService.emitToRestaurant(
      data.restaurantId,
      SocketEvent.RESERVATION_CREATED,
      { reservationId: reservation._id, status: reservation.status },
    );

    return reservation;
  }

  private static async triggerNotifications(reservation: any) {
    try {
      const restaurant = await RestaurantModel.findById(reservation.restaurantId).lean();
      if (!restaurant) return;

      let templateName = '';
      if (reservation.status === ReservationStatus.CONFIRMED) {
        templateName = 'reservation-confirmed';
      } else if (reservation.status === ReservationStatus.CANCELLED) {
        templateName = 'reservation-cancelled';
      } else {
        return;
      }

      const data = {
        customerName: reservation.customerName,
        restaurantName: restaurant.name,
        date: reservation.date,
        time: reservation.slot,
        guestCount: String(reservation.guests)
      };

      let success = false;

      if (reservation.notificationPreference === NotificationPreference.SMS) {
        success = await MessagingService.sendSMS(reservation.mobile, templateName, data);
      } else if (reservation.notificationPreference === NotificationPreference.WHATSAPP) {
        success = await MessagingService.sendWhatsApp(reservation.mobile, templateName, data);
      }

      if (success) {
        await ReservationModel.updateOne({ _id: reservation._id }, {
          notificationSentAt: new Date(),
          lastNotificationType: reservation.status,
          notificationFailureReason: null
        });
      } else if (reservation.notificationPreference !== NotificationPreference.NONE) {
        await ReservationModel.updateOne({ _id: reservation._id }, {
          notificationFailureReason: 'Provider failed to send'
        });
      }
    } catch (error: any) {
      logger.error('Failed to trigger notifications', { error });
      await ReservationModel.updateOne({ _id: reservation._id }, {
        notificationFailureReason: error.message
      });
    }
  }

  static async listReservations(
    restaurantId: string,
    filters: { date?: string; status?: ReservationStatus; q?: string }
  ) {
    const query: any = { restaurantId };

    if (filters.date) query.date = filters.date;
    if (filters.status) query.status = filters.status;
    if (filters.q) {
      const escaped = String(filters.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { customerName: { $regex: escaped, $options: 'i' } },
        { mobile: { $regex: escaped, $options: 'i' } },
      ];
    }

    return ReservationModel.find(query)
      .sort({ date: 1, slot: 1 })
      .populate('tableId', 'tableNumber status capacity')
      .lean();
  }

  static async getReservationById(restaurantId: string, id: string) {
    const reservation = await ReservationModel.findOne({ _id: id, restaurantId })
      .populate('tableId', 'tableNumber status capacity')
      .lean();

    if (!reservation) {
      throw new AppError('Reservation not found', 404, ErrorCode.NOT_FOUND);
    }
    return reservation;
  }

  static async updateReservation(
    restaurantId: string,
    id: string,
    updates: Partial<{
      customerName: string;
      customerEmail: string;
      mobile: string;
      guests: number;
      date: string;
      slot: string;
      status: ReservationStatus;
      tableId: string | null;
      tableNumber?: string;
      notes: string;
      occasion?: string;
      preferredArea?: string;
      notificationPreference: NotificationPreference;
    }>
  ) {
    const existing = await ReservationModel.findOne({ _id: id, restaurantId });
    if (!existing) {
      throw new AppError('Reservation not found', 404, ErrorCode.NOT_FOUND);
    }
    const previousStatus = existing.status;

    const updatePayload: any = { ...updates };

    if (updates.tableNumber !== undefined) {
      const table = await TableModel.findOne({ restaurantId, tableNumber: updates.tableNumber });
      if (!table) {
        throw new AppError('Table not found', 404, ErrorCode.NOT_FOUND);
      }
      updatePayload.tableId = table._id;
      delete updatePayload.tableNumber;
    }

    const newDate = updates.date ?? existing.date;
    const newSlot = updates.slot ?? existing.slot;
    const newTableId = updatePayload.tableId ?? (existing.tableId?.toString() || null);

    if (
      (updates.date && updates.date !== existing.date) ||
      (updates.slot && updates.slot !== existing.slot) ||
      (updatePayload.tableId && updatePayload.tableId.toString() !== existing.tableId?.toString())
    ) {
      if (newTableId) {
        const conflicting = await ReservationModel.findOne({
          _id: { $ne: id },
          restaurantId,
          tableId: newTableId,
          date: newDate,
          slot: newSlot,
          status: {
            $in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED, ReservationStatus.ARRIVED, ReservationStatus.CHECKED_IN],
          },
        });

        if (conflicting) {
          throw new AppError(
            `The selected table is already reserved for ${newDate} at ${newSlot}.`,
            409,
            ErrorCode.CONFLICT,
          );
        }
      }

      if (newTableId) {
        updatePayload.tableSlotLock = buildTableSlotLock(restaurantId, newTableId, newDate, newSlot);
        if (existing.reservedAt) {
          const slotStart = slotToDateTime(newDate, newSlot);
          updatePayload.reservationExpiresAt = new Date(slotStart.getTime() + 30 * 60 * 1000);
        }
      }
    }

    if (updates.status === ReservationStatus.CANCELLED && existing.tableId) {
      await TableModel.updateOne(
        { _id: existing.tableId, status: TableStatus.RESERVED },
        { $set: { status: TableStatus.AVAILABLE } },
      );
      updatePayload.tableSlotLock = null;

      socketService.emitToRestaurant(restaurantId, SocketEvent.TABLE_STATUS_UPDATED, {
        tableId: existing.tableId,
        status: TableStatus.AVAILABLE,
      });
    }

    const reservation = await ReservationModel.findOneAndUpdate(
      { _id: id, restaurantId },
      { $set: updatePayload },
      { new: true, runValidators: true }
    ).populate('tableId', 'tableNumber status capacity').lean();

    if (!reservation) {
      throw new AppError('Reservation not found after update', 404, ErrorCode.NOT_FOUND);
    }

    if (
      (previousStatus !== ReservationStatus.CONFIRMED && reservation.status === ReservationStatus.CONFIRMED) ||
      (previousStatus !== ReservationStatus.CANCELLED && reservation.status === ReservationStatus.CANCELLED)
    ) {
      this.triggerNotifications(reservation).catch(e => logger.error('Async notification error', e));
    }

    socketService.emitToRestaurant(restaurantId, SocketEvent.RESERVATION_CREATED, {
      reservationId: reservation._id,
      status: reservation.status,
    });

    return reservation;
  }

  static async arriveReservation(restaurantId: string, id: string, tableId?: string) {
    try {
      return await this.arriveReservationWithTransaction(restaurantId, id, tableId);
    } catch (error: any) {
      if (error?.message?.includes('Transaction numbers are only allowed') || error?.message?.includes('replica set')) {
        return await this.arriveReservationNoTransaction(restaurantId, id, tableId);
      }
      throw error;
    }
  }

  private static async arriveReservationWithTransaction(restaurantId: string, id: string, tableId?: string) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const reservation = await ReservationModel.findOne({ _id: id, restaurantId }).session(session);
      if (!reservation) {
        throw new AppError('Reservation not found', 404, ErrorCode.NOT_FOUND);
      }

      if (
        reservation.status === ReservationStatus.ARRIVED ||
        reservation.status === ReservationStatus.CHECKED_IN ||
        reservation.status === ReservationStatus.CANCELLED ||
        reservation.status === ReservationStatus.COMPLETED ||
        reservation.status === ReservationStatus.NO_SHOW
      ) {
        throw new AppError('Reservation cannot be marked as arrived', 400, ErrorCode.VALIDATION_ERROR);
      }

      if (reservation.status !== ReservationStatus.CONFIRMED) {
        throw new AppError('Only confirmed reservations can be marked as arrived', 400, ErrorCode.VALIDATION_ERROR);
      }

      const resolvedTableId = tableId || reservation.tableId?.toString();
      if (!resolvedTableId) {
        throw new AppError('Table ID is required for arrival', 400, ErrorCode.VALIDATION_ERROR);
      }

      const table = await TableModel.findOne({ _id: resolvedTableId, restaurantId }).session(session);
      if (!table) {
        throw new AppError('Table not found', 404, ErrorCode.NOT_FOUND);
      }

      if (table.status !== TableStatus.RESERVED && table.status !== TableStatus.AVAILABLE && table.status !== TableStatus.OCCUPIED) {
        throw new AppError('Table is not available for seating', 400, ErrorCode.VALIDATION_ERROR);
      }

      table.status = TableStatus.OCCUPIED;
      await table.save({ session });

      const sessionToken = await generateSecureToken();
      const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000);

      const tableSession = await TableSessionModel.create(
        [{
          restaurantId,
          tableId: table._id,
          customerName: reservation.customerName,
          mobile: reservation.mobile || '0000000000',
          sessionToken,
          sessionStart: new Date(),
          expiresAt,
          reservationId: reservation._id,
          customerProfileId: reservation.customerProfileId,
          status: SessionStatus.ACTIVE,
        }],
        { session }
      );

      table.currentSessionId = tableSession[0]._id;
      await table.save({ session });

      reservation.status = ReservationStatus.ARRIVED;
      reservation.tableId = table._id;
      reservation.arrivedAt = new Date();
      if (!reservation.mobile) {
        reservation.mobile = '0000000000';
      }
      await reservation.save({ session });

      if (reservation.customerProfileId) {
        await CustomerProfileModel.updateOne(
          { _id: reservation.customerProfileId },
          {
            $inc: { totalVisits: 1 },
            $set: { lastVisitAt: new Date() },
          },
          { session }
        );
      }

      await session.commitTransaction();
      session.endSession();

      socketService.emitToRestaurant(restaurantId, SocketEvent.RESERVATION_ARRIVED, {
        reservationId: reservation._id,
        status: ReservationStatus.ARRIVED,
      });
      socketService.emitToRestaurant(restaurantId, SocketEvent.TABLE_STATUS_UPDATED, {
        tableId: table._id,
        status: TableStatus.OCCUPIED,
      });
      socketService.emitToRestaurant(restaurantId, SocketEvent.SESSION_STARTED, {
        sessionId: tableSession[0]._id,
        tableId: table._id,
      });

      return await this.getReservationById(restaurantId, id);
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }

  private static async arriveReservationNoTransaction(restaurantId: string, id: string, tableId?: string) {
    const reservation = await ReservationModel.findOne({ _id: id, restaurantId });
    if (!reservation) {
      throw new AppError('Reservation not found', 404, ErrorCode.NOT_FOUND);
    }

    if (
      reservation.status === ReservationStatus.ARRIVED ||
      reservation.status === ReservationStatus.CHECKED_IN ||
      reservation.status === ReservationStatus.CANCELLED ||
      reservation.status === ReservationStatus.COMPLETED ||
      reservation.status === ReservationStatus.NO_SHOW
    ) {
      throw new AppError('Reservation cannot be marked as arrived', 400, ErrorCode.VALIDATION_ERROR);
    }

    if (reservation.status !== ReservationStatus.CONFIRMED) {
      throw new AppError('Only confirmed reservations can be marked as arrived', 400, ErrorCode.VALIDATION_ERROR);
    }

    const resolvedTableId = tableId || reservation.tableId?.toString();
    if (!resolvedTableId) {
      throw new AppError('Table ID is required for arrival', 400, ErrorCode.VALIDATION_ERROR);
    }

    const table = await TableModel.findOne({ _id: resolvedTableId, restaurantId });
    if (!table) {
      throw new AppError('Table not found', 404, ErrorCode.NOT_FOUND);
    }

    if (table.status !== TableStatus.RESERVED && table.status !== TableStatus.AVAILABLE && table.status !== TableStatus.OCCUPIED) {
      throw new AppError('Table is not available for seating', 400, ErrorCode.VALIDATION_ERROR);
    }

    table.status = TableStatus.OCCUPIED;
    await table.save();

    const sessionToken = await generateSecureToken();
    const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000);

    const tableSession = await TableSessionModel.create([{
      restaurantId,
      tableId: table._id,
      customerName: reservation.customerName,
      mobile: reservation.mobile || '0000000000',
      sessionToken,
      sessionStart: new Date(),
      expiresAt,
      reservationId: reservation._id,
      customerProfileId: reservation.customerProfileId,
      status: SessionStatus.ACTIVE,
    }]);

    table.currentSessionId = tableSession[0]._id;
    await table.save();

    reservation.status = ReservationStatus.ARRIVED;
    reservation.tableId = table._id;
    reservation.arrivedAt = new Date();
    if (!reservation.mobile) {
      reservation.mobile = '0000000000';
    }
    await reservation.save();

    if (reservation.customerProfileId) {
      await CustomerProfileModel.updateOne(
        { _id: reservation.customerProfileId },
        {
          $inc: { totalVisits: 1 },
          $set: { lastVisitAt: new Date() },
        }
      );
    }

    socketService.emitToRestaurant(restaurantId, SocketEvent.RESERVATION_ARRIVED, {
      reservationId: reservation._id,
      status: ReservationStatus.ARRIVED,
    });
    socketService.emitToRestaurant(restaurantId, SocketEvent.TABLE_STATUS_UPDATED, {
      tableId: table._id,
      status: TableStatus.OCCUPIED,
    });
    socketService.emitToRestaurant(restaurantId, SocketEvent.SESSION_STARTED, {
      sessionId: tableSession[0]._id,
      tableId: table._id,
    });

    return await this.getReservationById(restaurantId, id);
  }

  static async checkInReservation(restaurantId: string, id: string, tableId?: string) {
    try {
      return await this.checkInReservationWithTransaction(restaurantId, id, tableId);
    } catch (error: any) {
      if (error?.message?.includes('Transaction numbers are only allowed') || error?.message?.includes('replica set')) {
        return await this.checkInReservationNoTransaction(restaurantId, id, tableId);
      }
      throw error;
    }
  }

  static async checkInReservationWithTransaction(restaurantId: string, id: string, tableId?: string) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const reservation = await ReservationModel.findOne({ _id: id, restaurantId }).session(session);
      if (!reservation) {
        throw new AppError('Reservation not found', 404, ErrorCode.NOT_FOUND);
      }

      if (
        reservation.status === ReservationStatus.CHECKED_IN ||
        reservation.status === ReservationStatus.CANCELLED ||
        reservation.status === ReservationStatus.COMPLETED ||
        reservation.status === ReservationStatus.NO_SHOW
      ) {
        throw new AppError('Reservation cannot be checked in', 400, ErrorCode.VALIDATION_ERROR);
      }

      const resolvedTableId = tableId || reservation.tableId?.toString();
      if (!resolvedTableId) {
        throw new AppError('Table ID is required for check-in', 400, ErrorCode.VALIDATION_ERROR);
      }

      const table = await TableModel.findOne({ _id: resolvedTableId, restaurantId }).session(session);
      if (!table) {
        throw new AppError('Table not found', 404, ErrorCode.NOT_FOUND);
      }

      if (table.status !== TableStatus.RESERVED && table.status !== TableStatus.AVAILABLE && table.status !== TableStatus.OCCUPIED) {
        throw new AppError('Table is not available for check-in', 400, ErrorCode.VALIDATION_ERROR);
      }

      table.status = TableStatus.OCCUPIED;
      await table.save({ session });

      const sessionToken = await generateSecureToken();
      const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000);

      const tableSession = await TableSessionModel.create(
        [{
          restaurantId,
          tableId: table._id,
          customerName: reservation.customerName,
          mobile: reservation.mobile || '0000000000',
          sessionToken,
          sessionStart: new Date(),
          expiresAt,
          reservationId: reservation._id,
          customerProfileId: reservation.customerProfileId,
          status: SessionStatus.ACTIVE,
        }],
        { session }
      );

      table.currentSessionId = tableSession[0]._id;
      await table.save({ session });

      reservation.status = ReservationStatus.CHECKED_IN;
      reservation.tableId = table._id;
      reservation.arrivedAt = new Date();
      if (!reservation.mobile) {
        reservation.mobile = '0000000000';
      }
      await reservation.save({ session });

      if (reservation.customerProfileId) {
        await CustomerProfileModel.updateOne(
          { _id: reservation.customerProfileId },
          {
            $inc: { totalVisits: 1 },
            $set: { lastVisitAt: new Date() },
          },
          { session }
        );
      }

      await session.commitTransaction();
      session.endSession();

      socketService.emitToRestaurant(restaurantId, SocketEvent.TABLE_STATUS_UPDATED, {
        tableId: table._id,
        status: TableStatus.OCCUPIED,
      });
      socketService.emitToRestaurant(restaurantId, SocketEvent.SESSION_STARTED, {
        sessionId: tableSession[0]._id,
        tableId: table._id,
      });

      return await this.getReservationById(restaurantId, id);
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }

  static async checkInReservationNoTransaction(restaurantId: string, id: string, tableId?: string) {
    const reservation = await ReservationModel.findOne({ _id: id, restaurantId });
    if (!reservation) {
      throw new AppError('Reservation not found', 404, ErrorCode.NOT_FOUND);
    }

    if (
      reservation.status === ReservationStatus.CHECKED_IN ||
      reservation.status === ReservationStatus.CANCELLED ||
      reservation.status === ReservationStatus.COMPLETED ||
      reservation.status === ReservationStatus.NO_SHOW
    ) {
      throw new AppError('Reservation cannot be checked in', 400, ErrorCode.VALIDATION_ERROR);
    }

    const resolvedTableId = tableId || reservation.tableId?.toString();
    if (!resolvedTableId) {
      throw new AppError('Table ID is required for check-in', 400, ErrorCode.VALIDATION_ERROR);
    }

    const table = await TableModel.findOne({ _id: resolvedTableId, restaurantId });
    if (!table) {
      throw new AppError('Table not found', 404, ErrorCode.NOT_FOUND);
    }

    if (table.status !== TableStatus.RESERVED && table.status !== TableStatus.AVAILABLE && table.status !== TableStatus.OCCUPIED) {
      throw new AppError('Table is not available for check-in', 400, ErrorCode.VALIDATION_ERROR);
    }

    table.status = TableStatus.OCCUPIED;
    await table.save();

    const sessionToken = await generateSecureToken();
    const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000);

    const tableSession = await TableSessionModel.create([{
      restaurantId,
      tableId: table._id,
      customerName: reservation.customerName,
      mobile: reservation.mobile || '0000000000',
      sessionToken,
      sessionStart: new Date(),
      expiresAt,
      reservationId: reservation._id,
      customerProfileId: reservation.customerProfileId,
      status: SessionStatus.ACTIVE,
    }]);

    table.currentSessionId = tableSession[0]._id;
    await table.save();

    reservation.status = ReservationStatus.CHECKED_IN;
    reservation.tableId = table._id;
    reservation.arrivedAt = new Date();
    if (!reservation.mobile) {
      reservation.mobile = '0000000000';
    }
    await reservation.save();

    if (reservation.customerProfileId) {
      await CustomerProfileModel.updateOne(
        { _id: reservation.customerProfileId },
        {
          $inc: { totalVisits: 1 },
          $set: { lastVisitAt: new Date() },
        }
      );
    }

    socketService.emitToRestaurant(restaurantId, SocketEvent.TABLE_STATUS_UPDATED, {
      tableId: table._id,
      status: TableStatus.OCCUPIED,
    });
    socketService.emitToRestaurant(restaurantId, SocketEvent.SESSION_STARTED, {
      sessionId: tableSession[0]._id,
      tableId: table._id,
    });

    return await this.getReservationById(restaurantId, id);
  }

  static async markNoShow(restaurantId: string, id: string): Promise<any> {
    const reservation = await ReservationModel.findOne({ _id: id, restaurantId });
    if (!reservation) {
      throw new AppError('Reservation not found', 404, ErrorCode.NOT_FOUND);
    }

    if (
      reservation.status === ReservationStatus.NO_SHOW ||
      reservation.status === ReservationStatus.CANCELLED ||
      reservation.status === ReservationStatus.COMPLETED ||
      reservation.status === ReservationStatus.ARRIVED ||
      reservation.status === ReservationStatus.CHECKED_IN
    ) {
      throw new AppError('Reservation cannot be marked as no-show in its current state', 400, ErrorCode.VALIDATION_ERROR);
    }

    reservation.status = ReservationStatus.NO_SHOW;
    reservation.noShowProcessedAt = new Date();
    await reservation.save();

    if (reservation.customerProfileId) {
      await CustomerProfileModel.updateOne(
        { _id: reservation.customerProfileId },
        { $inc: { noShowCount: 1 } },
      );
    }

    if (reservation.tableId) {
      await TableModel.updateOne(
        { _id: reservation.tableId, status: TableStatus.RESERVED },
        { $set: { status: TableStatus.AVAILABLE } },
      );

      socketService.emitToRestaurant(restaurantId, SocketEvent.TABLE_STATUS_UPDATED, {
        tableId: reservation.tableId,
        status: TableStatus.AVAILABLE,
      });
    }

    socketService.emitToRestaurant(restaurantId, SocketEvent.RESERVATION_NO_SHOW, {
      reservationId: reservation._id,
      status: ReservationStatus.NO_SHOW,
    });

    // Notify admin about no-show
    NotificationsService.createNotification({
      restaurantId,
      recipientRole: UserRole.RESTAURANT_ADMIN,
      title: 'Reservation No-Show',
      message: `${reservation.customerName} was marked as no-show. Slot: ${reservation.date} at ${reservation.slot}.`,
      type: 'RESERVATION_NO_SHOW',
      entityId: reservation._id.toString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    }).catch(() => {});

    return await this.getReservationById(restaurantId, id);
  }

  static async activatePendingReservations(): Promise<{ activated: number; failed: number }> {
    const now = new Date();
    let activated = 0;
    let failed = 0;

    try {
      const reservations = await ReservationModel.find({
        status: ReservationStatus.CONFIRMED,
        reservedAt: null,
      }).limit(100);

      for (const reservation of reservations) {
        try {
          const slotStart = slotToDateTime(reservation.date, reservation.slot);
          if (now < slotStart) continue;

          if (reservation.tableId) {
            await TableModel.updateOne(
              { _id: reservation.tableId },
              { $set: { status: TableStatus.RESERVED } },
            );

            socketService.emitToRestaurant(
              reservation.restaurantId.toString(),
              SocketEvent.TABLE_STATUS_UPDATED,
              { tableId: reservation.tableId, status: TableStatus.RESERVED },
            );
          }

          reservation.reservedAt = now;
          reservation.reservationExpiresAt = new Date(now.getTime() + 30 * 60 * 1000);
          await reservation.save();

          socketService.emitToRestaurant(
            reservation.restaurantId.toString(),
            SocketEvent.RESERVATION_ACTIVATED,
            { reservationId: reservation._id, status: ReservationStatus.CONFIRMED, reservedAt: now },
          );

          activated++;
        } catch (err) {
          failed++;
          logger.error('Failed to activate reservation', { reservationId: reservation._id, error: err });
        }
      }
    } catch (err) {
      logger.error('CRITICAL: Failed to query pending reservations for activation', { error: err });
    }

    return { activated, failed };
  }

  static async processExpiredReservations(): Promise<{ processed: number; failed: number }> {
    const now = new Date();
    let processed = 0;
    let failed = 0;

    try {
      const expiredReservations = await ReservationModel.find({
        reservationExpiresAt: { $lte: now },
        status: { $in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] },
        noShowProcessedAt: null,
      }).limit(100);

      for (const reservation of expiredReservations) {
        try {
          reservation.status = ReservationStatus.NO_SHOW;
          reservation.noShowProcessedAt = new Date();
          await reservation.save();

          if (reservation.customerProfileId) {
            await CustomerProfileModel.updateOne(
              { _id: reservation.customerProfileId },
              { $inc: { noShowCount: 1 } },
            );
          }

          if (reservation.tableId) {
            await TableModel.updateOne(
              { _id: reservation.tableId, status: TableStatus.RESERVED },
              { $set: { status: TableStatus.AVAILABLE } },
            );

            socketService.emitToRestaurant(
              reservation.restaurantId.toString(),
              SocketEvent.TABLE_STATUS_UPDATED,
              { tableId: reservation.tableId, status: TableStatus.AVAILABLE },
            );
          }

          socketService.emitToRestaurant(
            reservation.restaurantId.toString(),
            SocketEvent.RESERVATION_NO_SHOW,
            { reservationId: reservation._id, status: ReservationStatus.NO_SHOW },
          );

          processed++;
        } catch (err) {
          failed++;
          logger.error('Failed to process expired reservation', { reservationId: reservation._id, error: err });
        }
      }
    } catch (err) {
      logger.error('CRITICAL: Failed to query expired reservations', { error: err });
    }

    return { processed, failed };
  }

  static async getAvailability(restaurantId: string, date: string, guests: number = 2) {
    const tables = await TableModel.find({
      restaurantId,
      capacity: { $gte: guests },
      isActive: true,
    }).lean();

    if (tables.length === 0) {
      return { slots: [], bookedSlots: [] };
    }

    const baseSlots = [
      '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
      '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
      '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00', '22:30',
    ];

    const reservations = await ReservationModel.find({
      restaurantId,
      date,
      status: {
        $in: [
          ReservationStatus.PENDING,
          ReservationStatus.CONFIRMED,
          ReservationStatus.ARRIVED,
          ReservationStatus.CHECKED_IN,
        ],
      },
    }).lean();

    const slotBookings = reservations.reduce<Record<string, number>>((acc, res) => {
      if (res.slot) {
        acc[res.slot] = (acc[res.slot] || 0) + 1;
      }
      return acc;
    }, {});

    const availableSlots = baseSlots.filter(
      (slot) => (slotBookings[slot] || 0) < tables.length
    );

    const bookedSlots = Object.entries(slotBookings).map(([slot, count]) => ({ slot, count }));

    return { slots: availableSlots, bookedSlots };
  }
}
