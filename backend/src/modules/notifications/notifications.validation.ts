import { z } from 'zod';
import { UserRole } from '../../constants/roles';
import { NotificationModule } from './notifications.schema';

const booleanQuerySchema = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((value) => value === true || value === 'true');

export const notificationsListQuerySchema = z.object({
  recipientRole: z.nativeEnum(UserRole).optional(),
  role: z.nativeEnum(UserRole).optional(),
  isRead: booleanQuerySchema.optional(),
  read: booleanQuerySchema.optional(),
  module: z.nativeEnum(NotificationModule).optional(),
  type: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const markAllNotificationsQuerySchema = z.object({
  recipientRole: z.nativeEnum(UserRole).optional(),
  role: z.nativeEnum(UserRole).optional(),
});

export const notificationIdParamSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid notification id format'),
});

export const unreadCountQuerySchema = z.object({
  recipientRole: z.nativeEnum(UserRole).optional(),
  role: z.nativeEnum(UserRole).optional(),
});

export type NotificationsListQuery = z.infer<typeof notificationsListQuerySchema>;
export type MarkAllNotificationsQuery = z.infer<typeof markAllNotificationsQuerySchema>;
export type UnreadCountQuery = z.infer<typeof unreadCountQuerySchema>;
