// src/modules/restaurants/restaurants.schema.ts
// Zod validation schemas for the restaurants module.

import { z } from 'zod';

// ── PATCH /admin/restaurant/settings ─────────────────────────────────
// All fields are optional — admin can update one or all settings at once.
// Top-level restaurant fields (name, cuisine, city, type, phone, address)
// and nested settings fields are all accepted here.
export const updateRestaurantSettingsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Restaurant name cannot be empty')
    .max(100)
    .optional(),

  cuisine: z
    .string()
    .trim()
    .optional(),

  city: z
    .string()
    .trim()
    .optional(),

  type: z
    .string()
    .trim()
    .optional(),

  phone: z
    .string()
    .trim()
    .optional(),

  address: z
    .string()
    .trim()
    .optional(),

  coverImage: z
    .string()
    .trim()
    .optional(),

  plan: z
    .enum(['Free', 'Standard', 'Premium', 'Enterprise'])
    .optional(),

  restaurantId: z
    .string()
    .trim()
    .optional(),

  currency: z
    .string()
    .trim()
    .length(3, 'Currency must be a 3-letter ISO code')
    .toUpperCase()
    .optional(),

  taxRate: z
    .number()
    .min(0, 'Tax rate cannot be negative')
    .max(1, 'Tax rate must be a decimal between 0 and 1 (e.g. 0.05 for 5%)')
    .optional(),

  serviceChargeEnabled: z
    .boolean()
    .optional(),

  sessionDurationMinutes: z
    .number()
    .int()
    .min(15, 'Session duration must be at least 15 minutes')
    .max(480, 'Session duration cannot exceed 480 minutes')
    .optional(),

  emailPreferences: z
    .object({
      dailySalesReports: z.boolean().optional(),
      inventoryAlerts: z.boolean().optional(),
      staffNotifications: z.boolean().optional(),
    })
    .optional(),

  branding: z
    .object({
      logo: z.string().trim().optional(),
      primaryColor: z.string().trim().optional(),
      secondaryColor: z.string().trim().optional(),
      footerText: z.string().trim().optional(),
      website: z.string().trim().optional(),
      supportEmail: z.string().trim().optional(),
      supportPhone: z.string().trim().optional(),
    })
    .optional(),

  timezone: z.string().trim().optional(),
  dateFormat: z.string().trim().optional(),
  timeFormat: z.string().trim().optional(),

  integrations: z
    .record(
      z.object({
        connected: z.boolean(),
      }),
    )
    .optional(),

  gstEnabled: z
    .boolean()
    .optional(),

  gstNumber: z
    .string()
    .trim()
    .optional(),

  legalBusinessName: z
    .string()
    .trim()
    .optional(),

  defaultGSTPercentage: z
    .number()
    .min(0, 'GST percentage cannot be negative')
    .max(100, 'GST percentage cannot exceed 100')
    .optional(),

  invoicePrefix: z
    .string()
    .trim()
    .optional(),

  floors: z
    .array(
      z.object({
        name: z.string().trim().min(1, 'Floor name is required'),
        number: z.number().int().min(0, 'Floor number must be positive'),
      })
    )
    .optional(),

  sections: z
    .array(z.string().trim().min(1, 'Section name is required'))
    .optional(),

  bankDetails: z
    .object({
      accountHolderName: z.string().trim().min(2, 'Account holder name is required').max(100),
      accountNumber: z.string().trim().min(8, 'Account number must be at least 8 digits').max(20),
      ifscCode: z.string().trim().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code format'),
      bankName: z.string().trim().min(2, 'Bank name is required').max(100),
      branch: z.string().trim().max(100).optional(),
    })
    .optional()
    .nullable(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field is required',
  path: ['unknown'],
});

// ── GET /public/restaurants/:slug ─────────────────────────────────────
export const restaurantSlugParamSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1, 'Slug is required')
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only'),
});

// ── Exported types ────────────────────────────────────────────────────
export type UpdateRestaurantSettingsInput = z.infer<typeof updateRestaurantSettingsSchema>;
export type RestaurantSlugParam = z.infer<typeof restaurantSlugParamSchema>;

export const updateRestaurantProfileSchema = z.object({
  ownerName: z.string().trim().min(2, 'Owner name must be at least 2 characters').optional(),
  phone: z.string().trim().min(10, 'Phone number must be at least 10 digits').optional(),
  address: z.string().trim().min(5, 'Address must be at least 5 characters').optional(),
  city: z.string().trim().min(2, 'City must be at least 2 characters').optional(),
  state: z.string().trim().min(2, 'State must be at least 2 characters').optional(),
  country: z.string().trim().min(2, 'Country must be at least 2 characters').optional(),
  pinCode: z.string().trim().min(6, 'Pin code must be at least 6 characters').optional(),
  gstNumber: z.string().trim().optional(),
  cuisine: z.string().trim().min(2, 'Cuisine must be at least 2 characters').optional(),
  branches: z.number().int().positive().optional(),
  expectedMonthlyOrders: z.number().int().nonnegative().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  googleMapsUrl: z.string().trim().optional(),
});

export type UpdateRestaurantProfileInput = z.infer<typeof updateRestaurantProfileSchema>;
