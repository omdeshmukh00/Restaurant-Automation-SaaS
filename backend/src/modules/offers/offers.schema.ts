import { Types } from 'mongoose';
import { z } from 'zod';

const objectIdSchema = z.string().refine((value) => Types.ObjectId.isValid(value), {
  message: 'Invalid id',
});

export const offerIdParamsSchema = z.object({
  id: objectIdSchema,
});

export const offersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  status: z.enum(['ACTIVE', 'INACTIVE', 'EXPIRED']).optional(),
  q: z.string().trim().min(1).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const createOfferBodySchema = z
  .object({
    title: z.string().trim().min(2).max(200),
    description: z.string().trim().max(1000).optional().default(''),
    promoCode: z.string().trim().min(2).max(50),
    discountType: z.enum(['PERCENTAGE', 'FIXED_AMOUNT']),
    discountValue: z.coerce.number().min(0),
    requiredPoints: z.coerce.number().int().min(0).optional().default(0),
    minOrderAmount: z.coerce.number().min(0).optional().nullable().default(null),
    maxDiscount: z.coerce.number().min(0).optional().nullable().default(null),
    startDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: 'Invalid start date',
    }),
    expiryDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: 'Invalid expiry date',
    }),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional().default('INACTIVE'),
    displayPriority: z.coerce.number().int().min(0).optional().default(0),
    image: z.string().trim().optional().default(''),
  })
  .refine(
    (data) => {
      if (data.discountType === 'PERCENTAGE' && data.discountValue > 100) {
        return false;
      }
      return true;
    },
    { message: 'Percentage discount cannot exceed 100', path: ['discountValue'] },
  )
  .refine(
    (data) => {
      if (data.discountType === 'FIXED_AMOUNT' && data.maxDiscount) {
        return false;
      }
      return true;
    },
    { message: 'Max discount is only applicable for percentage discounts', path: ['maxDiscount'] },
  )
  .refine(
    (data) => {
      const start = new Date(data.startDate);
      const expiry = new Date(data.expiryDate);
      return expiry > start;
    },
    { message: 'Expiry date must be after start date', path: ['expiryDate'] },
  );

export const updateOfferBodySchema = z
  .object({
    title: z.string().trim().min(2).max(200).optional(),
    description: z.string().trim().max(1000).optional(),
    promoCode: z.string().trim().min(2).max(50).optional(),
    discountType: z.enum(['PERCENTAGE', 'FIXED_AMOUNT']).optional(),
    discountValue: z.coerce.number().min(0).optional(),
    requiredPoints: z.coerce.number().int().min(0).optional(),
    minOrderAmount: z.coerce.number().min(0).optional().nullable(),
    maxDiscount: z.coerce.number().min(0).optional().nullable(),
    startDate: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid start date' })
      .optional(),
    expiryDate: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid expiry date' })
      .optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'EXPIRED']).optional(),
    displayPriority: z.coerce.number().int().min(0).optional(),
    image: z.string().trim().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

export const toggleOfferStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE']),
});
