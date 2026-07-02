import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const uploadIdParamSchema = z.object({
  id: objectId,
});

export const createUploadSchema = z.object({
  tenantId: objectId.optional(),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(120),
  content: z.string().min(1),
});

export const replaceUploadSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(120),
  content: z.string().min(1),
});

export type CreateUploadInput = z.infer<typeof createUploadSchema>;
export type ReplaceUploadInput = z.infer<typeof replaceUploadSchema>;
