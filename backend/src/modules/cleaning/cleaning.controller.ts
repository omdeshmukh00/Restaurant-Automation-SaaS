import type { NextFunction, Request, Response } from 'express';
import { CleaningStatus, TableStatus } from '../../constants/statuses';
import { ErrorCode } from '../../constants/errors';
import { AppError } from '../../utils/AppError';
import { ok } from '../../utils/responses';
import { updateTableStatus } from '../tables/tables.service';
import { TableModel } from '../tables/tables.model';
import { CleaningTaskModel } from './cleaning.model';
import { MaintenanceIssueModel } from './maintenanceIssue.model';
import { logger } from '../../config/logger';
import { NotificationsService } from '../notifications/notifications.service';
import { UserRole } from '../../constants/roles';
import { socketService } from '../../sockets/socket.service';

function ensureCleaningStatus(currentStatus: CleaningStatus, allowedStatuses: CleaningStatus[], message: string): void {
  if (!allowedStatuses.includes(currentStatus)) {
    throw new AppError(message, 400, ErrorCode.INVALID_REQUEST);
  }
}

export class CleaningController {
  private static getRequiredRestaurantId(req: Request) {
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId) {
      throw new AppError('Restaurant context required', 403, ErrorCode.FORBIDDEN);
    }

    return restaurantId;
  }

  private static async getTaskForRestaurant(req: Request) {
    const restaurantId = CleaningController.getRequiredRestaurantId(req);
    const task = await CleaningTaskModel.findOne({
      _id: req.params.id,
      restaurantId,
    });

    if (!task) {
      throw new AppError('Cleaning task not found', 404, ErrorCode.NOT_FOUND);
    }

    return task;
  }

  static async getTasks(req: Request, res: Response, next: NextFunction) {
    try {
      const restaurantId = CleaningController.getRequiredRestaurantId(req);
      const { status, priority } = req.query;
      const query: Record<string, unknown> = { restaurantId };

      if (status) query.status = status;
      if (priority) query.priority = priority;

      const tasks = await CleaningTaskModel.find(query)
        .populate('tableId')
        .populate('assignedStaffId', 'name email phone avatar')
        .sort({ createdAt: -1 });

      const responseTasks = tasks.map((task) => {
        const taskObj = task.toObject() as any;
        if (taskObj.tableId && typeof taskObj.tableId === 'object') {
          taskObj.tableDetails = taskObj.tableId;
          taskObj.tableId = (taskObj.tableId as any)._id?.toString() || String(taskObj.tableId);
        }
        return taskObj;
      });

      ok(res, {
        tasks: responseTasks,
        meta: {
          count: responseTasks.length,
          filters: {
            status: status ?? null,
            priority: priority ?? null,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getTask(req: Request, res: Response, next: NextFunction) {
    try {
      const restaurantId = CleaningController.getRequiredRestaurantId(req);
      const task = await CleaningTaskModel.findOne({
        _id: req.params.id,
        restaurantId,
      })
        .populate('tableId')
        .populate('assignedStaffId', 'name email phone avatar');

      if (!task) {
        throw new AppError('Cleaning task not found', 404, ErrorCode.NOT_FOUND);
      }

      const taskObj = task.toObject() as any;
      if (taskObj.tableId && typeof taskObj.tableId === 'object') {
        taskObj.tableDetails = taskObj.tableId;
        taskObj.tableId = (taskObj.tableId as any)._id?.toString() || String(taskObj.tableId);
      }

      ok(res, { task: taskObj });
    } catch (error) {
      next(error);
    }
  }

  static async startTask(req: Request, res: Response, next: NextFunction) {
    try {
      const task = await CleaningController.getTaskForRestaurant(req);

      ensureCleaningStatus(task.status, [CleaningStatus.PENDING, CleaningStatus.PAUSED], 'Only pending or paused cleaning tasks can be started');

      const startedBy = req.body?.staffId ?? req.user?.id ?? null;
      task.status = CleaningStatus.IN_PROGRESS;
      task.isPaused = false;
      task.startedAt = task.startedAt || new Date();
      task.startedBy = startedBy;
      if (req.body?.staffId) {
        task.assignedStaffId = req.body.staffId;
      }
      await task.save();

      await updateTableStatus(
        task.tableId.toString(),
        TableStatus.CLEANING_IN_PROGRESS,
        task.restaurantId.toString()
      );
      
      socketService.emitToRestaurant(task.restaurantId.toString(), 'cleaning.started', { task });

      logger.info('Cleaning task started', { taskId: task._id, tableId: task.tableId });

      ok(res, { task, startedBy });
    } catch (error) {
      next(error);
    }
  }

  static async completeTask(req: Request, res: Response, next: NextFunction) {
    try {
      const task = await CleaningController.getTaskForRestaurant(req);

      ensureCleaningStatus(task.status, [CleaningStatus.IN_PROGRESS, CleaningStatus.PAUSED], 'Only in-progress or paused cleaning tasks can be completed');

      task.status = CleaningStatus.COMPLETED;
      task.isPaused = false;
      task.completedAt = new Date();
      task.completedBy = req.body?.staffId ?? req.user?.id ?? null;
      await task.save();

      const table = await TableModel.findById(task.tableId);
      if (table && table.status !== TableStatus.AVAILABLE) {
        await updateTableStatus(
          task.tableId.toString(),
          TableStatus.AVAILABLE,
          task.restaurantId.toString()
        );
      }

      socketService.emitToRestaurant(task.restaurantId.toString(), 'cleaning.completed', { task });

      // Notify admin about cleaning task completion
      NotificationsService.createNotification({
        restaurantId: task.restaurantId.toString(),
        recipientRole: UserRole.RESTAURANT_ADMIN,
        title: 'Cleaning Task Completed',
        message: `Cleaning task for table has been completed.`,
        type: 'CLEANING_TASK_COMPLETED',
        entityId: task._id.toString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }).catch(() => {});

      logger.info('Cleaning task completed', { taskId: task._id, tableId: task.tableId });

      ok(res, { task });
    } catch (error) {
      next(error);
    }
  }

  static async verifyTask(req: Request, res: Response, next: NextFunction) {
    try {
      const task = await CleaningController.getTaskForRestaurant(req);

      ensureCleaningStatus(task.status, [CleaningStatus.COMPLETED], 'Only completed cleaning tasks can be verified');

      task.status = CleaningStatus.VERIFIED;
      task.verifiedAt = new Date();
      task.verifiedBy = req.body?.verifiedBy ?? req.user?.id ?? null;
      await task.save();

      const table = await TableModel.findById(task.tableId);
      if (table && table.status !== TableStatus.AVAILABLE) {
        await updateTableStatus(
          task.tableId.toString(),
          TableStatus.AVAILABLE,
          task.restaurantId.toString()
        );
      }

      socketService.emitToRestaurant(task.restaurantId.toString(), 'cleaning.completed', { task });

      logger.info('Cleaning task verified', { taskId: task._id, tableId: task.tableId });

      ok(res, { task });
    } catch (error) {
      next(error);
    }
  }

  static async assignTask(req: Request, res: Response, next: NextFunction) {
    try {
      const task = await CleaningController.getTaskForRestaurant(req);
      const { staffId } = req.body;

      task.assignedStaffId = staffId || null;
      await task.save();

      socketService.emitToRestaurant(task.restaurantId.toString(), 'cleaning.task.assigned', { task, staffId });

      logger.info('Cleaning task assigned to staff', { taskId: task._id, staffId });

      ok(res, { task, message: 'Task assigned to staff member successfully' });
    } catch (error) {
      next(error);
    }
  }

  static async pauseTask(req: Request, res: Response, next: NextFunction) {
    try {
      const task = await CleaningController.getTaskForRestaurant(req);
      const isPaused = req.body.isPaused ?? !task.isPaused;

      task.isPaused = isPaused;
      if (isPaused) {
        task.status = CleaningStatus.PAUSED;
      } else if (task.status === CleaningStatus.PAUSED) {
        task.status = CleaningStatus.IN_PROGRESS;
      }
      await task.save();

      socketService.emitToRestaurant(task.restaurantId.toString(), 'cleaning.task.paused', { task, isPaused });

      logger.info('Cleaning task pause status toggled', { taskId: task._id, isPaused });

      ok(res, { task, message: isPaused ? 'Task paused successfully' : 'Task resumed successfully' });
    } catch (error) {
      next(error);
    }
  }

  static async deepCleanTask(req: Request, res: Response, next: NextFunction) {
    try {
      const task = await CleaningController.getTaskForRestaurant(req);
      const isDeepCleaning = req.body.isDeepCleaning ?? !task.isDeepCleaning;

      task.isDeepCleaning = isDeepCleaning;
      if (isDeepCleaning) {
        task.priority = 'URGENT' as any;
      }
      await task.save();

      socketService.emitToRestaurant(task.restaurantId.toString(), 'cleaning.task.deepclean', { task, isDeepCleaning });

      logger.info('Cleaning task deep cleaning mode updated', { taskId: task._id, isDeepCleaning });

      ok(res, { task, message: isDeepCleaning ? 'Deep cleaning mode enabled' : 'Deep cleaning mode disabled' });
    } catch (error) {
      next(error);
    }
  }

  static async reportMaintenanceIssue(req: Request, res: Response, next: NextFunction) {
    try {
      const restaurantId = CleaningController.getRequiredRestaurantId(req);
      const { tableId, issueType, description, severity } = req.body;

      const issue = await MaintenanceIssueModel.create({
        restaurantId,
        tableId,
        reportedBy: req.user?.id,
        issueType,
        description,
        severity: severity || 'MEDIUM',
        status: 'REPORTED',
      });

      // Automatically lock table to UNDER_MAINTENANCE status
      await updateTableStatus(tableId, TableStatus.UNDER_MAINTENANCE, restaurantId.toString());

      // Broadcast socket alert to restaurant staff/admins
      socketService.emitToRestaurant(restaurantId.toString(), 'cleaning.issue.reported', { issue });

      logger.info('Maintenance issue reported', { issueId: issue._id, tableId });

      ok(res, { issue, message: 'Maintenance issue reported and table set to Under Maintenance.' });
    } catch (error) {
      next(error);
    }
  }

  static async getMaintenanceIssues(req: Request, res: Response, next: NextFunction) {
    try {
      const restaurantId = CleaningController.getRequiredRestaurantId(req);
      const { status, tableId } = req.query;
      const query: Record<string, unknown> = { restaurantId };

      if (status) query.status = status;
      if (tableId) query.tableId = tableId;

      const issues = await MaintenanceIssueModel.find(query)
        .populate('tableId')
        .populate('reportedBy', 'name email role')
        .sort({ createdAt: -1 });

      ok(res, { issues });
    } catch (error) {
      next(error);
    }
  }

  static async updateMaintenanceIssue(req: Request, res: Response, next: NextFunction) {
    try {
      const restaurantId = CleaningController.getRequiredRestaurantId(req);
      const { id } = req.params;
      const { status } = req.body;

      const issue = await MaintenanceIssueModel.findOneAndUpdate(
        { _id: id, restaurantId },
        { status },
        { new: true }
      );

      if (!issue) {
        throw new AppError('Maintenance issue not found', 404, ErrorCode.NOT_FOUND);
      }

      // If resolved, restore table status to AVAILABLE
      if (status === 'RESOLVED') {
        await updateTableStatus(issue.tableId.toString(), TableStatus.AVAILABLE, restaurantId.toString());
      }

      socketService.emitToRestaurant(restaurantId.toString(), 'cleaning.issue.updated', { issue });

      ok(res, { issue, message: `Maintenance issue status updated to ${status}.` });
    } catch (error) {
      next(error);
    }
  }

  static async getTables(req: Request, res: Response, next: NextFunction) {
    try {
      const restaurantId = CleaningController.getRequiredRestaurantId(req);
      const tables = await TableModel.find({ restaurantId }).sort({ floor: 1, tableNumber: 1 });
      ok(res, { tables });
    } catch (error) {
      next(error);
    }
  }
}
