import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const uploadIdParamSchema = z.object({
  id: objectId,
});

// Security: Configurable allowed file types
export const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
export const ALLOWED_DOCUMENT_MIMES = ['application/pdf'];
export const ALLOWED_MIME_TYPES = [...ALLOWED_IMAGE_MIMES, ...ALLOWED_DOCUMENT_MIMES];
export const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];

const fileNameValidation = z.string().trim().min(1).max(255).refine((val) => {
  const ext = val.split('.').pop()?.toLowerCase();
  return ext && ALLOWED_EXTENSIONS.includes(ext);
}, 'Invalid file extension. Allowed: jpg, jpeg, png, webp, pdf');

const mimeTypeValidation = z.string().trim().min(1).max(120).refine(
  (val) => ALLOWED_MIME_TYPES.includes(val),
  'Invalid MIME type'
);

export const createUploadSchema = z.object({
  tenantId: objectId.optional(),
  fileName: fileNameValidation,
  mimeType: mimeTypeValidation,
  content: z.string().min(1),
});

export const replaceUploadSchema = z.object({
  fileName: fileNameValidation,
  mimeType: mimeTypeValidation,
  content: z.string().min(1),
});

export type CreateUploadInput = z.infer<typeof createUploadSchema>;
export type ReplaceUploadInput = z.infer<typeof replaceUploadSchema>;
