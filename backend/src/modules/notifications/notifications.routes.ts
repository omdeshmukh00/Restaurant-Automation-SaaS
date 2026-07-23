// src/modules/notifications/notifications.routes.ts
// REST routes for admin notification operations

import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { validate } from '../../middleware/validate';
import { NotificationsController } from './notifications.controller';
import {
  markAllNotificationsQuerySchema,
  notificationIdParamSchema,
  notificationsListQuerySchema,
  unreadCountQuerySchema,
} from './notifications.validation';

const router = Router();

// Secure all endpoints in this router
router.use(requireAuth);

// GET /notifications — paginated notification history
router.get('/', validate({ query: notificationsListQuerySchema }), NotificationsController.getNotifications);

// GET /notifications/unread-count — unread count only
router.get('/unread-count', validate({ query: unreadCountQuerySchema }), NotificationsController.getUnreadCount);

// PATCH /notifications/read-all — mark all as read
router.patch('/read-all', validate({ query: markAllNotificationsQuerySchema }), NotificationsController.markAllAsRead);

// PATCH /notifications/:id/read — mark single as read
router.patch('/:id/read', validate({ params: notificationIdParamSchema }), NotificationsController.markAsRead);

// DELETE /notifications/:id — soft-delete a notification
router.delete('/:id', validate({ params: notificationIdParamSchema }), NotificationsController.deleteNotification);

export default router;
