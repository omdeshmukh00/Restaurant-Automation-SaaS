// src/modules/notifications/notifications.controller.ts
// Express controllers for notifications REST API

import { Request, Response, NextFunction } from 'express';
import { NotificationsService } from './notifications.service';
import { UserRole } from '../../constants/roles';
import { AppError } from '../../utils/AppError';
import { ErrorCode } from '../../constants/errors';
import type {
  MarkAllNotificationsQuery,
  NotificationsListQuery,
  UnreadCountQuery,
} from './notifications.validation';
import { NotificationModule } from './notifications.schema';

function serializeNotification(notification: any) {
  const value = typeof notification?.toObject === 'function' ? notification.toObject() : notification;
  return {
    ...value,
    _id: value?._id?.toString() ?? value?.id,
    read: value?.isRead ?? value?.read ?? false,
  };
}

function getRequestedRecipientRole(query: {
  recipientRole?: UserRole;
  role?: UserRole;
}): UserRole | undefined {
  return query.recipientRole ?? query.role;
}

export class NotificationsController {
  /**
   * Get paginated notifications for the current restaurant.
   */
  public static async getNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || !req.user.restaurantId || !req.user.role) {
        throw new AppError('Authentication required', 401, ErrorCode.UNAUTHORIZED);
      }

      const query = req.query as unknown as NotificationsListQuery;
      const requestedRecipientRole = getRequestedRecipientRole(query);
      const effectiveRecipientRole = NotificationsService.getScopedRecipientRole(
        req.user.role as UserRole,
        requestedRecipientRole
      );

      const result = await NotificationsService.getNotificationsPaginated(
        req.user.restaurantId,
        req.user.role as UserRole,
        {
          requestedRecipientRole: effectiveRecipientRole,
          isRead: query.isRead ?? query.read,
          module: query.module as NotificationModule | undefined,
          type: query.type,
        },
        { page: query.page ?? 1, limit: query.limit ?? 20 }
      );

      res.status(200).json({
        success: true,
        data: {
          notifications: result.notifications.map((notification) => serializeNotification(notification)),
          unreadCount: result.unreadCount,
          pagination: result.pagination,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get unread notification count for the current restaurant.
   */
  public static async getUnreadCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || !req.user.restaurantId || !req.user.role) {
        throw new AppError('Authentication required', 401, ErrorCode.UNAUTHORIZED);
      }

      const query = req.query as unknown as UnreadCountQuery;
      const recipientRole = getRequestedRecipientRole(query);

      const unreadCount = await NotificationsService.getUnreadCount(
        req.user.restaurantId,
        req.user.role as UserRole,
        recipientRole
      );

      res.status(200).json({
        success: true,
        data: { unreadCount },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark a single notification as read.
   */
  public static async markAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || !req.user.restaurantId || !req.user._id || !req.user.role) {
        throw new AppError('Authentication required', 401, ErrorCode.UNAUTHORIZED);
      }

      const { id } = req.params;

      const notification = await NotificationsService.markAsRead(
        id,
        req.user.restaurantId,
        req.user.role as UserRole,
        req.user._id
      );

      if (!notification) {
        throw new AppError('Notification not found', 404, ErrorCode.NOT_FOUND);
      }

      res.status(200).json({
        success: true,
        data: {
          notification: serializeNotification(notification),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark all notifications of a specific role (or all roles) as read.
   */
  public static async markAllAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || !req.user.restaurantId || !req.user._id || !req.user.role) {
        throw new AppError('Authentication required', 401, ErrorCode.UNAUTHORIZED);
      }

      const query = req.query as unknown as MarkAllNotificationsQuery;
      const recipientRole = getRequestedRecipientRole(query);
      const effectiveRecipientRole = NotificationsService.getScopedRecipientRole(
        req.user.role as UserRole,
        recipientRole
      );

      const updatedCount = await NotificationsService.markAllAsRead(
        req.user.restaurantId,
        req.user.role as UserRole,
        effectiveRecipientRole,
        req.user._id
      );

      res.status(200).json({
        success: true,
        data: {
          updatedCount,
          recipientRole: effectiveRecipientRole ?? null,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete (soft-delete) a single notification.
   */
  public static async deleteNotification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || !req.user.restaurantId || !req.user.role) {
        throw new AppError('Authentication required', 401, ErrorCode.UNAUTHORIZED);
      }

      const { id } = req.params;

      const notification = await NotificationsService.deleteNotification(
        id,
        req.user.restaurantId,
        req.user.role as UserRole
      );

      if (!notification) {
        throw new AppError('Notification not found', 404, ErrorCode.NOT_FOUND);
      }

      res.status(200).json({
        success: true,
        data: {
          notification: serializeNotification(notification),
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
