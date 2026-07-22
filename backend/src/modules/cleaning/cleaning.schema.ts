import { Types } from 'mongoose';
import { z } from 'zod';
import { CleaningStatus, Priority } from '../../constants/statuses';

const objectIdSchema = z.string().refine((value) => Types.ObjectId.isValid(value), {
  message: 'Invalid id',
});

const nullableObjectIdSchema = z.union([objectIdSchema, z.null()]);

export const cleaningTaskParamsSchema = z.object({
  id: objectIdSchema,
});

export const cleaningTaskQuerySchema = z.object({
  status: z.nativeEnum(CleaningStatus).optional(),
  priority: z.nativeEnum(Priority).optional(),
});

export const startCleaningBodySchema = z.object({
  staffId: nullableObjectIdSchema.optional(),
});

export const completeCleaningBodySchema = z.object({
  staffId: nullableObjectIdSchema.optional(),
});

export const verifyCleaningBodySchema = z.object({
  verifiedBy: nullableObjectIdSchema.optional(),
});

export const assignCleaningTaskBodySchema = z.object({
  staffId: nullableObjectIdSchema.optional(),
});

export const pauseCleaningBodySchema = z.object({
  isPaused: z.boolean().optional(),
});

export const deepCleanBodySchema = z.object({
  isDeepCleaning: z.boolean().optional(),
});

export const reportMaintenanceIssueBodySchema = z.object({
  tableId: objectIdSchema,
  issueType: z.enum(['BROKEN_FURNITURE', 'WATER_LEAK', 'ELECTRICAL', 'HYGIENE', 'OTHER']),
  description: z.string().min(1, 'Description is required'),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
});

export const updateMaintenanceIssueBodySchema = z.object({
  status: z.enum(['REPORTED', 'IN_REPAIR', 'RESOLVED']),
});

export const maintenanceIssueParamsSchema = z.object({
  id: objectIdSchema,
});
