// src/modules/superAdmin/superAdmin.schema.ts
// Zod validation schemas for all super admin endpoints.

import { z } from 'zod';

// ── Reusable ──────────────────────────────────────────────────────────
const objectIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'Invalid ID format');

// ── Restaurant management ─────────────────────────────────────────────

export const restaurantIdParamSchema = z.object({
  id: objectIdSchema,
});

export const restaurantListQuerySchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'PENDING']).optional(),
  plan:   z.string().trim().optional(),
  search: z.string().trim().optional(),
  page:   z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .pipe(z.number().int().min(1)),
  limit:  z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .pipe(z.number().int().min(1).max(100)),
});

// ── Plans ─────────────────────────────────────────────────────────────

export const createPlanSchema = z.object({
  name:          z.string().trim().min(1, 'Plan name is required'),
  priceMonthly:  z.number().min(0, 'Price cannot be negative'),
  priceYearly:   z.number().min(0, 'Yearly price cannot be negative').optional().nullable(),
  yearlyDiscountPercentage: z.number().min(0).max(100).optional().nullable(),
  originalPriceMonthly: z.number().min(0).optional().nullable(),
  description:   z.string().trim().max(1000).optional().nullable(),
  tenantLimit:   z.number().int().min(1, 'Tenant limit must be at least 1'),
  usageLimit:    z.number().int().min(0, 'Usage limit must be 0 or greater').optional(),
  tableLimit:    z.number().int().min(0, 'Table limit must be 0 or greater').optional(),
  dailyOrderLimit: z.number().int().min(0, 'Daily order limit must be 0 or greater').optional(),
  monthlyOrderLimit: z.number().int().min(0, 'Monthly order limit must be 0 or greater').optional(),
  reservationAccess: z.boolean().optional(),
  queueAccess: z.boolean().optional(),
  advancedAnalytics: z.boolean().optional(),
  smartAutomation: z.boolean().optional(),
  dynamicDiscountEngine: z.boolean().optional(),
  staffLimit:     z.number().int().min(0, 'Staff limit must be 0 or greater').optional(),
  inventoryLimit: z.number().int().min(0, 'Inventory limit must be 0 or greater').optional(),
  features:       z.array(z.string().trim().min(1)).optional(),
  isActive:       z.boolean().optional(),
});

export const updatePlanSchema = z.object({
  name:          z.string().trim().min(1).optional(),
  priceMonthly:  z.number().min(0).optional(),
  priceYearly:   z.number().min(0).optional().nullable(),
  yearlyDiscountPercentage: z.number().min(0).max(100).optional().nullable(),
  originalPriceMonthly: z.number().min(0).optional().nullable(),
  description:   z.string().trim().max(1000).optional().nullable(),
  tenantLimit:   z.number().int().min(1).optional(),
  usageLimit:    z.number().int().min(0).optional(),
  tableLimit:    z.number().int().min(0).optional(),
  dailyOrderLimit: z.number().int().min(0).optional(),
  monthlyOrderLimit: z.number().int().min(0).optional(),
  reservationAccess: z.boolean().optional(),
  queueAccess: z.boolean().optional(),
  advancedAnalytics: z.boolean().optional(),
  smartAutomation: z.boolean().optional(),
  dynamicDiscountEngine: z.boolean().optional(),
  staffLimit:     z.number().int().min(0).optional(),
  inventoryLimit: z.number().int().min(0).optional(),
  features:       z.array(z.string().trim().min(1)).optional(),
  isActive:       z.boolean().optional(),
});

export const planIdParamSchema = z.object({
  id: objectIdSchema,
});

export const bulkOffersSchema = z.object({
  yearlyDiscountPercentage: z.number().min(0).max(100).optional().nullable(),
  monthlyDiscountPercentage: z.number().min(0).max(100).optional().nullable(),
});

// ── Feature flags ─────────────────────────────────────────────────────

export const featureFlagIdParamSchema = z.object({
  id: objectIdSchema,
});

export const updateFeatureFlagSchema = z.object({
  enabled: z.boolean({ required_error: 'enabled is required' }),
});

// ── Analytics ─────────────────────────────────────────────────────────

export const analyticsQuerySchema = z.object({
  // groupBy controls the time bucketing
  groupBy: z.enum(['day', 'week', 'month', 'year']).optional().default('day'),
  from:    z
    .string()
    .datetime({ message: 'from must be a valid ISO 8601 datetime' })
    .optional(),
  to:      z
    .string()
    .datetime({ message: 'to must be a valid ISO 8601 datetime' })
    .optional(),
});

// ── Audit logs ────────────────────────────────────────────────────────

export const superAdminAuditLogQuerySchema = z.object({
  actorId:  objectIdSchema.optional(),
  action:   z.string().trim().optional(),
  from:     z
    .string()
    .datetime({ message: 'from must be a valid ISO 8601 datetime' })
    .optional(),
  to:       z
    .string()
    .datetime({ message: 'to must be a valid ISO 8601 datetime' })
    .optional(),
  page:     z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .pipe(z.number().int().min(1)),
  limit:    z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .pipe(z.number().int().min(1).max(100)),
});

// ── Exported types ────────────────────────────────────────────────────
export type RestaurantListQuery     = z.infer<typeof restaurantListQuerySchema>;
export type RestaurantIdParam       = z.infer<typeof restaurantIdParamSchema>;
export type CreatePlanInput         = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput         = z.infer<typeof updatePlanSchema>;
export type PlanIdParam             = z.infer<typeof planIdParamSchema>;
export type FeatureFlagIdParam      = z.infer<typeof featureFlagIdParamSchema>;
export type UpdateFeatureFlagInput  = z.infer<typeof updateFeatureFlagSchema>;
export type AnalyticsQuery          = z.infer<typeof analyticsQuerySchema>;
export type SuperAdminAuditLogQuery = z.infer<typeof superAdminAuditLogQuerySchema>;

export const registerRestaurantSchema = z.object({
  restaurantName: z.string().trim().min(2, 'Restaurant name must be at least 2 characters'),
  ownerName: z.string().trim().min(2, 'Owner name must be at least 2 characters'),
  email: z.string().trim().email('Invalid email address'),
  phone: z.string().trim().min(10, 'Phone number must be at least 10 digits'),
  address: z.string().trim().min(5, 'Address must be at least 5 characters'),
  city: z.string().trim().min(2, 'City must be at least 2 characters'),
  state: z.string().trim().min(2, 'State must be at least 2 characters'),
  country: z.string().trim().min(2, 'Country must be at least 2 characters'),
  pinCode: z.string().trim().min(6, 'Pin code must be at least 6 characters'),
  gstNumber: z.string().trim().optional().nullable(),
  cuisine: z.string().trim().min(2, 'Cuisine must be at least 2 characters'),
  branches: z.number().int().positive().default(1),
  expectedMonthlyOrders: z.number().int().nonnegative().default(0),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  googleMapsUrl: z.string().trim().min(1, 'Google Maps URL is required'),
  message: z.string().trim().optional().nullable(),
  plan: z.string().trim().min(1, 'Plan is required'),
  status: z.enum(['Active', 'Trial', 'Inactive']),
});

export type RegisterRestaurantInput = z.infer<typeof registerRestaurantSchema>;

export const createRestaurantSchema = z.object({
  name: z.string().min(1, 'Name is required').trim(),
  owner: z.string().min(1, 'Owner name is required').trim(),
  email: z.string().email('Invalid email').trim().toLowerCase(),
  phone: z.string().min(1, 'Phone is required').trim(),
  location: z.string().min(1, 'Location is required').trim(),
  plan: z.enum(['Premium', 'Standard', 'Basic', 'Free']).optional().default('Basic'),
  status: z.enum(['Active', 'Trial', 'Inactive']).optional().default('Trial'),
  branches: z.number().int().min(1).optional().default(1),
  revenue: z.string().optional().default('₹0'),
});

export type CreateRestaurantInput = z.infer<typeof createRestaurantSchema>;
