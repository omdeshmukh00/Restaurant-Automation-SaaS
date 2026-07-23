import { Types } from 'mongoose';
import { z } from 'zod';
import { ReservationStatus } from '../../constants/statuses';

const objectIdSchema = z.string().refine((value) => Types.ObjectId.isValid(value), {
  message: 'Invalid id format',
});

const nullableObjectIdSchema = z.union([objectIdSchema, z.null()]);

export const entityIdParamsSchema = z.object({
  id: objectIdSchema,
});

export const reservationAvailabilityQuerySchema = z.object({
  restaurantId: objectIdSchema.optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  guests: z.coerce.number().int().min(1).max(20).optional(),
});

export const listReservationsQuerySchema = z.object({
  restaurantId: objectIdSchema.optional(),
  date: z
    .preprocess((value) => (value === '' || value === null ? undefined : value), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional()),
  status: z.nativeEnum(ReservationStatus).optional(),
  q: z.string().trim().optional(), // For searching by name or mobile
  notificationPreference: z.enum(['NONE', 'SMS', 'WHATSAPP']).optional(),
});

const normalizeSlot = (value: unknown): string => {
  if (typeof value !== 'string') return value as string;
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(value.trim());
  if (!match) return value as string;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3]?.toUpperCase();
  if (period === 'PM' && hour < 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

const emptyToUndefined = (value: unknown): unknown =>
  value === '' || value === null ? undefined : value;

export const createReservationBodySchema = z.object({
  restaurantId: objectIdSchema.optional(),
  customerName: z.string().trim().min(2).max(100),
  customerEmail: z
    .preprocess(emptyToUndefined, z.string().trim().email().toLowerCase().optional()),
  mobile: z.preprocess(
    (value) => (typeof value === 'string' ? value.replace(/\D/g, '') : value),
    z.string().min(10).max(15),
  ),
  guests: z.coerce.number().int().min(1).max(50),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  slot: z.preprocess(normalizeSlot, z.string().regex(/^\d{1,2}:\d{2}$/, 'Slot must be in HH:mm format')),
  tableNumber: z.string().trim().min(1).optional(),
  notes: z.string().trim().max(500).optional(),
  occasion: z.string().trim().max(100).optional(),
  notificationPreference: z.enum(['NONE', 'SMS', 'WHATSAPP']).optional().default('NONE'),
});

export const updateReservationBodySchema = z.object({
  restaurantId: objectIdSchema.optional(),
  customerName: z.string().trim().min(2).max(100).optional(),
  customerEmail: z
    .preprocess(emptyToUndefined, z.string().trim().email().toLowerCase().optional()),
  mobile: z
    .preprocess((value) => (typeof value === 'string' ? value.replace(/\D/g, '') : value), z.string().min(10).max(15))
    .optional(),
  guests: z.coerce.number().int().min(1).max(50).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
  slot: z.preprocess(normalizeSlot, z.string().regex(/^\d{1,2}:\d{2}$/, 'Slot must be in HH:mm format').optional()),
  status: z.nativeEnum(ReservationStatus).optional(),
  tableId: nullableObjectIdSchema.optional(),
  tableNumber: z.string().trim().min(1).optional(),
  notes: z.string().trim().max(500).optional(),
  occasion: z.string().trim().max(100).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided to update',
});
export const checkInReservationBodySchema = z.object({
  restaurantId: objectIdSchema.optional(),
  tableId: objectIdSchema.optional(),
});

export const arriveReservationBodySchema = z.object({
  restaurantId: objectIdSchema.optional(),
  tableId: objectIdSchema.optional(),
});

export const markNoShowBodySchema = z.object({
  restaurantId: objectIdSchema.optional(),
});
