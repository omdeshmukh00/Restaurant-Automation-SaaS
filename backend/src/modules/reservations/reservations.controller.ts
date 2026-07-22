import type { NextFunction, Request, Response } from 'express';
import { ErrorCode } from '../../constants/errors';
import { AppError } from '../../utils/AppError';
import { ok } from '../../utils/responses';
import { ReservationsService } from './reservations.service';
import { ReservationStatus } from '../../constants/statuses';

function resolveRestaurantId(req: Request, candidate?: unknown): string {
  if (req.user?.restaurantId) {
    return req.user.restaurantId;
  }
  if (typeof candidate === 'string' && candidate.trim()) {
    return candidate.trim();
  }
  throw new AppError('Restaurant context required', 403, ErrorCode.FORBIDDEN);
}

function formatReservationStatus(status: string) {
  if (!status) return 'Pending';
  return status
    .toString()
    .replace(/_/g, ' ')
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatDate(iso: Date | string | null | undefined): string | null {
  if (!iso) return null;
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

function formatRelativeTime(iso: Date | string | null | undefined): string | null {
  if (!iso) return null;
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / 60000);
  const absMins = Math.abs(diffMins);

  if (absMins < 1) return 'Just now';
  if (absMins < 60) return `${absMins} min ${diffMins >= 0 ? 'from now' : 'ago'}`;
  const diffHours = Math.round(absMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ${diffMins >= 0 ? 'from now' : 'ago'}`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function mapReservationDto(reservation: any) {
  // Build timeline info object
  const timeline: Record<string, { iso: string | null; relative: string | null }> = {};

  // Reservation created time from _id
  if (reservation._id) {
    const created = new Date(reservation._id.getTimestamp ? reservation._id.getTimestamp() : reservation.createdAt || reservation._id.getTimestamp());
    timeline.created = { iso: created.toISOString(), relative: formatRelativeTime(created) };
  }

  if (reservation.reservedAt) {
    timeline.reserved = { iso: formatDate(reservation.reservedAt), relative: formatRelativeTime(reservation.reservedAt) };
  }
  if (reservation.arrivedAt) {
    timeline.arrived = { iso: formatDate(reservation.arrivedAt), relative: formatRelativeTime(reservation.arrivedAt) };
  }
  if (reservation.noShowProcessedAt) {
    timeline.noShow = { iso: formatDate(reservation.noShowProcessedAt), relative: formatRelativeTime(reservation.noShowProcessedAt) };
  }
  if (reservation.reservationExpiresAt) {
    timeline.expiresAt = { iso: formatDate(reservation.reservationExpiresAt), relative: formatRelativeTime(reservation.reservationExpiresAt) };
  }

  return {
    id: reservation._id?.toString() || reservation.id,
    guestName: reservation.customerName,
    phone: reservation.mobile,
    email: reservation.customerEmail || '',
    guests: reservation.guests,
    date: reservation.date,
    time: reservation.slot,
    status: formatReservationStatus(reservation.status),
    tableNumber: reservation.tableId?.tableNumber || reservation.tableNumber || '',
    specialRequest: reservation.notes || '',
    occasion: reservation.occasion || '',
    preferredArea: reservation.preferredArea || '',
    // Timeline fields
    timeline,
    reservedAt: formatDate(reservation.reservedAt),
    arrivedAt: formatDate(reservation.arrivedAt),
    noShowProcessedAt: formatDate(reservation.noShowProcessedAt),
    reservationExpiresAt: formatDate(reservation.reservationExpiresAt),
  };
}

export async function createReservationController(req: Request, res: Response, next: NextFunction) {
  try {
    const restaurantId = resolveRestaurantId(req, req.body.restaurantId);

    const reservation = await ReservationsService.createReservation({
      restaurantId,
      customerName: req.body.customerName,
      customerEmail: req.body.customerEmail,
      mobile: req.body.mobile,
      guests: req.body.guests,
      date: req.body.date,
      slot: req.body.slot,
      tableNumber: req.body.tableNumber,
      notes: req.body.notes,
      occasion: req.body.occasion,
      preferredArea: req.body.preferredArea,
    });

    ok(res, { reservation: mapReservationDto(reservation) }, 201);
  } catch (error) {
    next(error);
  }
}

export async function listReservationsController(req: Request, res: Response, next: NextFunction) {
  try {
    const restaurantId = resolveRestaurantId(req, req.query.restaurantId);

    const filters = {
      date: typeof req.query.date === 'string' ? req.query.date : undefined,
      status: req.query.status as ReservationStatus | undefined,
      q: typeof req.query.q === 'string' ? req.query.q : undefined,
    };

    const reservations = await ReservationsService.listReservations(restaurantId, filters);

    ok(res, {
      reservations: reservations.map(mapReservationDto),
      meta: { count: reservations.length },
    });
  } catch (error) {
    next(error);
  }
}

export async function getReservationByIdController(req: Request, res: Response, next: NextFunction) {
  try {
    const restaurantId = resolveRestaurantId(req, req.query.restaurantId);
    const reservation = await ReservationsService.getReservationById(restaurantId, req.params.id);

    ok(res, { reservation: mapReservationDto(reservation) });
  } catch (error) {
    next(error);
  }
}

export async function updateReservationController(req: Request, res: Response, next: NextFunction) {
  try {
    const restaurantId = resolveRestaurantId(req, req.body.restaurantId ?? req.query.restaurantId);

    const reservation = await ReservationsService.updateReservation(
      restaurantId,
      req.params.id,
      req.body
    );

    ok(res, { reservation: mapReservationDto(reservation) });
  } catch (error) {
    next(error);
  }
}

export async function arriveReservationController(req: Request, res: Response, next: NextFunction) {
  try {
    const restaurantId = resolveRestaurantId(req, req.body.restaurantId ?? req.query.restaurantId);
    const tableId = req.body.tableId;

    const reservation = await ReservationsService.arriveReservation(
      restaurantId,
      req.params.id,
      tableId
    );

    ok(res, { reservation: mapReservationDto(reservation) });
  } catch (error) {
    next(error);
  }
}

export async function markNoShowController(req: Request, res: Response, next: NextFunction) {
  try {
    const restaurantId = resolveRestaurantId(req, req.body.restaurantId ?? req.query.restaurantId);

    const reservation = await ReservationsService.markNoShow(
      restaurantId,
      req.params.id
    );

    ok(res, { reservation: mapReservationDto(reservation) });
  } catch (error) {
    next(error);
  }
}

export async function checkInReservationController(req: Request, res: Response, next: NextFunction) {
  try {
    const restaurantId = resolveRestaurantId(req, req.body.restaurantId ?? req.query.restaurantId);
    const tableId = req.body.tableId;

    const reservation = await ReservationsService.checkInReservation(
      restaurantId,
      req.params.id,
      tableId
    );

    ok(res, { reservation: mapReservationDto(reservation) });
  } catch (error) {
    next(error);
  }
}

export async function getAvailabilityController(req: Request, res: Response, next: NextFunction) {
  try {
    const restaurantId = resolveRestaurantId(req, req.query.restaurantId);
    const date = typeof req.query.date === 'string' ? req.query.date : new Date().toISOString().split('T')[0];
    const guests = typeof req.query.guests === 'number' ? req.query.guests : typeof req.query.guests === 'string' ? parseInt(req.query.guests, 10) : 2;

    const result = await ReservationsService.getAvailability(restaurantId, date, guests);

    ok(res, {
      slots: result.slots,
      bookedSlots: result.bookedSlots,
      meta: { count: result.slots.length },
    });
  } catch (error) {
    next(error);
  }
}
