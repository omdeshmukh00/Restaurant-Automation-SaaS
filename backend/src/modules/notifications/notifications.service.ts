// src/modules/notifications/notifications.service.ts
// Service layer for notifications — handles creation, deduplication, real-time broadcasts, and reads

import { Notification, INotification } from './notifications.model';
import { socketService } from '../../sockets/socket.service';
import { SocketEvent } from '../../constants/events';
import { UserRole } from '../../constants/roles';
import { NotificationCategory, NotificationModule, NotificationPriority, NOTIFICATION_TYPE_MAP, MODULE_ACTION_URLS } from './notifications.schema';
import mongoose from 'mongoose';
import { AppError } from '../../utils/AppError';
import { ErrorCode } from '../../constants/errors';

type NotificationFilters = {
  requestedRecipientRole?: UserRole;
  isRead?: boolean;
  module?: NotificationModule;
  type?: string;
};

type NotificationQuery = Record<string, unknown>;

export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface PaginatedNotifications {
  notifications: INotification[];
  unreadCount: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

function isPrivilegedRole(role: UserRole): boolean {
  return role === UserRole.RESTAURANT_ADMIN || role === UserRole.SUPER_ADMIN;
}

function getReadByObjectId(userId: mongoose.Types.ObjectId | string): mongoose.Types.ObjectId | null {
  const normalizedId = userId.toString();
  return mongoose.Types.ObjectId.isValid(normalizedId) ? new mongoose.Types.ObjectId(normalizedId) : null;
}

export class NotificationsService {
  /**
   * Create a notification.
   * Resolves module, category, priority, and actionUrl from the notification type when not provided.
   * Enforces a 60-second sliding window deduplication based on restaurantId, type, and entityId.
   * If a duplicate is found, the existing active notification is returned and socket broadcast is suppressed.
   */
  public static async createNotification(data: {
    restaurantId: mongoose.Types.ObjectId | string;
    tableSessionId?: mongoose.Types.ObjectId | string;
    recipientRole: UserRole;
    title: string;
    message: string;
    type: string;
    module?: NotificationModule;
    category?: NotificationCategory;
    priority?: NotificationPriority;
    entityId?: string | null;
    actionUrl?: string | null;
    expiresAt?: Date;
    metadata?: Record<string, any>;
  }): Promise<INotification> {
    // Resolve type map defaults
    const typeDefaults = NOTIFICATION_TYPE_MAP[data.type];
    const module = data.module ?? typeDefaults?.module ?? NotificationModule.SYSTEM;
    const category = data.category ?? typeDefaults?.category ?? NotificationCategory.SYSTEM;
    const priority = data.priority ?? typeDefaults?.priority ?? NotificationPriority.NORMAL;
    const actionUrl = data.actionUrl ?? MODULE_ACTION_URLS[module] ?? null;
    const expiresAt = data.expiresAt ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days default

    const sixtySecondsAgo = new Date(Date.now() - 60 * 1000);

    // Sliding window dedup: match restaurant, type, entityId (if provided), created in last 60s
    const dedupQuery: Record<string, unknown> = {
      restaurantId: data.restaurantId,
      type: data.type,
      createdAt: { $gte: sixtySecondsAgo },
    };
    if (data.entityId) {
      dedupQuery.entityId = data.entityId;
    }

    const existing = await Notification.findOne(dedupQuery);

    if (existing) {
      return existing;
    }

    // Create the new notification
    const notification = await Notification.create({
      restaurantId: data.restaurantId,
      tableSessionId: data.tableSessionId || null,
      recipientRole: data.recipientRole,
      title: data.title,
      message: data.message,
      type: data.type,
      module,
      category,
      priority,
      entityId: data.entityId || null,
      actionUrl,
      expiresAt,
      metadata: data.metadata || {},
    });

    const restaurantIdStr = data.restaurantId.toString();
    const sessionIdStr = data.tableSessionId ? data.tableSessionId.toString() : null;

    // Real-time Socket.io transmissions
    // 1. Emit to specific role in the restaurant
    socketService.emitToRole(
      restaurantIdStr,
      data.recipientRole,
      SocketEvent.NOTIFICATION_NEW,
      notification
    );

    // 2. Emit to specific active session (if associated)
    if (sessionIdStr) {
      socketService.emitToSession(
        sessionIdStr,
        SocketEvent.NOTIFICATION_NEW,
        notification
      );
    }

    // 3. Emit to general restaurant room
    socketService.emitToRestaurant(
      restaurantIdStr,
      SocketEvent.NOTIFICATION_NEW,
      notification
    );

    return notification;
  }

  public static getScopedRecipientRole(
    actorRole: UserRole,
    requestedRecipientRole?: UserRole
  ): UserRole | undefined {
    if (isPrivilegedRole(actorRole)) {
      return requestedRecipientRole;
    }

    if (requestedRecipientRole && requestedRecipientRole !== actorRole) {
      throw new AppError('Forbidden', 403, ErrorCode.FORBIDDEN);
    }

    return actorRole;
  }

  private static buildScopedQuery(
    restaurantId: mongoose.Types.ObjectId | string,
    actorRole: UserRole,
    filters: NotificationFilters = {},
    options: { activeOnly?: boolean; unreadOnly?: boolean; includeDeleted?: boolean } = {}
  ): NotificationQuery {
    const query: NotificationQuery = {
      restaurantId,
    };

    // By default exclude deleted notifications
    if (!options.includeDeleted) {
      query.isDeleted = { $ne: true };
    }

    if (options.activeOnly) {
      query.expiresAt = { $gt: new Date() };
    }

    if (options.unreadOnly) {
      query.isRead = false;
    } else if (filters.isRead !== undefined) {
      query.isRead = filters.isRead;
    }

    if (filters.module) {
      query.module = filters.module;
    }

    if (filters.type) {
      query.type = filters.type;
    }

    const scopedRecipientRole = this.getScopedRecipientRole(actorRole, filters.requestedRecipientRole);
    if (scopedRecipientRole) {
      query.recipientRole = scopedRecipientRole;
    }

    return query;
  }

  /**
   * Get active (unexpired) notifications for a restaurant, with optional filters.
   * Returns all matching unexpired notifications without pagination.
   * @deprecated Use getNotificationsPaginated for production use.
   */
  public static async getActiveNotifications(
    restaurantId: mongoose.Types.ObjectId | string,
    actorRole: UserRole,
    filters: NotificationFilters = {}
  ): Promise<{ notifications: INotification[]; unreadCount: number }> {
    const query = this.buildScopedQuery(restaurantId, actorRole, filters, { activeOnly: true });
    const unreadQuery = this.buildScopedQuery(
      restaurantId,
      actorRole,
      { requestedRecipientRole: filters.requestedRecipientRole },
      { activeOnly: true, unreadOnly: true }
    );

    const [notifications, unreadCount] = await Promise.all([
      Notification.find(query).sort({ createdAt: -1 }),
      Notification.countDocuments(unreadQuery),
    ]);

    return { notifications, unreadCount };
  }

  /**
   * Get notifications with full pagination support.
   * Returns all non-deleted notifications sorted newest first.
   */
  public static async getNotificationsPaginated(
    restaurantId: mongoose.Types.ObjectId | string,
    actorRole: UserRole,
    filters: NotificationFilters = {},
    pagination: PaginationOptions = { page: 1, limit: 20 }
  ): Promise<PaginatedNotifications> {
    const query = this.buildScopedQuery(restaurantId, actorRole, filters, { includeDeleted: false });
    const unreadQuery = this.buildScopedQuery(
      restaurantId,
      actorRole,
      { requestedRecipientRole: filters.requestedRecipientRole, module: filters.module, type: filters.type },
      { includeDeleted: false, unreadOnly: true }
    );

    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments(query),
      Notification.countDocuments(unreadQuery),
    ]);

    return {
      notifications: notifications as unknown as INotification[],
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + notifications.length < total,
      },
    };
  }

  /**
   * Mark a single notification as read.
   */
  public static async markAsRead(
    notificationId: mongoose.Types.ObjectId | string,
    restaurantId: mongoose.Types.ObjectId | string,
    actorRole: UserRole,
    userId: mongoose.Types.ObjectId | string
  ): Promise<INotification | null> {
    const query = this.buildScopedQuery(restaurantId, actorRole, undefined, { includeDeleted: false });
    query._id = notificationId;

    const notification = await Notification.findOne(query);

    if (!notification) {
      return null;
    }

    if (!notification.isRead) {
      notification.isRead = true;
      notification.readAt = new Date();
      notification.readBy = getReadByObjectId(userId);
      await notification.save();
    }

    return notification;
  }

  /**
   * Mark all notifications of a specific role (or all roles if none specified) in a restaurant as read.
   */
  public static async markAllAsRead(
    restaurantId: mongoose.Types.ObjectId | string,
    actorRole: UserRole,
    recipientRole: UserRole | undefined,
    userId: mongoose.Types.ObjectId | string
  ): Promise<number> {
    const query = this.buildScopedQuery(
      restaurantId,
      actorRole,
      { requestedRecipientRole: recipientRole },
      { includeDeleted: false, unreadOnly: true }
    );
    const readBy = getReadByObjectId(userId);

    const result = await Notification.updateMany(query, {
      $set: {
        isRead: true,
        readAt: new Date(),
        readBy,
      },
    });

    return result.modifiedCount ?? 0;
  }

  /**
   * Soft-delete a single notification.
   */
  public static async deleteNotification(
    notificationId: mongoose.Types.ObjectId | string,
    restaurantId: mongoose.Types.ObjectId | string,
    actorRole: UserRole,
  ): Promise<INotification | null> {
    const query = this.buildScopedQuery(restaurantId, actorRole, undefined, { includeDeleted: false });
    query._id = notificationId;

    const notification = await Notification.findOneAndUpdate(
      query,
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
        },
      },
      { new: true },
    );

    return notification;
  }

  /**
   * Get unread count for a restaurant/role combination.
   */
  public static async getUnreadCount(
    restaurantId: mongoose.Types.ObjectId | string,
    actorRole: UserRole,
    recipientRole?: UserRole,
  ): Promise<number> {
    const query = this.buildScopedQuery(
      restaurantId,
      actorRole,
      { requestedRecipientRole: recipientRole },
      { includeDeleted: false, unreadOnly: true }
    );

    return Notification.countDocuments(query);
  }
}
