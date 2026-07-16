import { Types } from 'mongoose';
import { z } from 'zod';

const objectIdSchema = z
  .string()
  .refine((v) => Types.ObjectId.isValid(v), { message: 'Invalid ObjectId' });

export const listCustomersQuerySchema = z.object({
  restaurantId: objectIdSchema.optional(),
  status: z.enum(['All', 'Active', 'Inactive']).optional(),
  tier: z.enum(['All', 'Gold', 'Silver', 'Bronze']).optional(),
  q: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).optional(),
  perPage: z.coerce.number().int().min(1).max(1000).optional(),
});

export const customerIdParamsSchema = z.object({
  id: objectIdSchema,
});

// Mobile is required on CREATE. It is normalized to digits-only to stay consistent
// with the existing CustomerProfile creators (reservations). Adding a customer
// creates a real User (role=CUSTOMER) — the same identity OTP signup produces — so
// the mobile-based login flow is preserved, not bypassed.
export const createCustomerBodySchema = z.object({
  name: z.string().trim().min(2).max(100),
  mobile: z.preprocess(
    (value) => (typeof value === 'string' ? value.replace(/\D/g, '') : value),
    z.string().min(10).max(15),
  ),
  email: z.string().trim().email().toLowerCase().optional(),
  tags: z.array(z.string().trim().max(30)).optional(),
});

// Mobile is intentionally NOT updatable to keep the mobile-based login intact.
export const updateCustomerBodySchema = z
  .object({
    restaurantId: objectIdSchema.optional(),
    name: z.string().trim().min(2).max(100).optional(),
    email: z.string().trim().email().toLowerCase().optional(),
    tags: z.array(z.string().trim().max(30)).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided to update',
  });
