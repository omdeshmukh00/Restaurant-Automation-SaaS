import type { NextFunction, Request, Response } from 'express';
import { ErrorCode } from '../../constants/errors';
import { AppError } from '../../utils/AppError';
import { ok } from '../../utils/responses';
import { logAudit } from '../auditLogs/auditLogs.helper';
import { AuditAction, AuditEntity } from '../auditLogs/auditLogs.types';
import { OrdersService } from '../orders/orders.service';
import { InventoryService } from '../inventory/inventory.service';
import { KitchenService } from './kitchen.service';
import { KitchenAlertService } from './kitchen-alert.service';
import { MenuService } from '../menu/menu.service';

export class KitchenController {
  private static getRequiredRestaurantId(req: Request) {
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId) {
      throw new AppError('Restaurant context required', 403, ErrorCode.FORBIDDEN);
    }

    return restaurantId;
  }

  static async getDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const restaurantId = KitchenController.getRequiredRestaurantId(req);
      const metrics = await KitchenService.getDashboard(restaurantId);

      ok(res, { metrics });
    } catch (error) {
      next(error);
    }
  }

  static async getInventory(req: Request, res: Response, next: NextFunction) {
    try {
      const restaurantId = KitchenController.getRequiredRestaurantId(req);
      const search = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      const active = typeof req.query.active === 'boolean' ? req.query.active : undefined;

      const items = await InventoryService.listInventoryItems(restaurantId, search, active);

      ok(res, {
        items,
        meta: {
          count: items.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getInventoryAlerts(req: Request, res: Response, next: NextFunction) {
    try {
      const restaurantId = KitchenController.getRequiredRestaurantId(req);
      const items = await InventoryService.getInventoryAlerts(restaurantId);

      ok(res, {
        alerts: items.map((item) => ({
          ...item,
          shortage: Math.max(0, item.threshold - item.stock),
        })),
        meta: {
          count: items.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const restaurantId = KitchenController.getRequiredRestaurantId(req);
      const orders = await KitchenService.getOrders(restaurantId, {
        status: req.query.status as any,
        priority: req.query.priority as string | undefined,
        table: req.query.table as string | undefined,
        batch: req.query.batch as boolean | undefined,
      });

      ok(res, {
        orders,
        meta: {
          count: orders.length,
          filters: {
            status: req.query.status ?? null,
            priority: req.query.priority ?? null,
            table: req.query.table ?? null,
            batch: req.query.batch ?? null,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getOrderDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const restaurantId = KitchenController.getRequiredRestaurantId(req);
      const order = await KitchenService.getOrderDetails(restaurantId, req.params.id);

      ok(res, { order });
    } catch (error) {
      next(error);
    }
  }

  static async acceptOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const restaurantId = KitchenController.getRequiredRestaurantId(req);
      const order = await OrdersService.acceptOrder(
        restaurantId,
        req.params.id,
        req.body.estimatedPreparationTime,
        req.user?.id,
      );

      await logAudit(req, {
        entityType: AuditEntity.ORDER,
        entityId: order._id.toString(),
        action: AuditAction.KITCHEN_ORDER_ACCEPTED,
        metadata: { estimatedPreparationTime: req.body.estimatedPreparationTime },
      });

      ok(res, { order });
    } catch (error) {
      next(error);
    }
  }

  static async startCooking(req: Request, res: Response, next: NextFunction) {
    try {
      const restaurantId = KitchenController.getRequiredRestaurantId(req);
      const order = await OrdersService.startCooking(restaurantId, req.params.id, req.user?.id);

      await logAudit(req, {
        entityType: AuditEntity.ORDER,
        entityId: order._id.toString(),
        action: AuditAction.KITCHEN_ORDER_STARTED,
      });

      ok(res, { order });
    } catch (error) {
      next(error);
    }
  }

  static async markReady(req: Request, res: Response, next: NextFunction) {
    try {
      const restaurantId = KitchenController.getRequiredRestaurantId(req);
      const order = await OrdersService.markReady(restaurantId, req.params.id, req.user?.id);

      await logAudit(req, {
        entityType: AuditEntity.ORDER,
        entityId: order._id.toString(),
        action: AuditAction.KITCHEN_ORDER_READY,
      });

      ok(res, { order });
    } catch (error) {
      next(error);
    }
  }

  static async delayOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const restaurantId = KitchenController.getRequiredRestaurantId(req);
      const order = await OrdersService.delayOrder(restaurantId, req.params.id, req.body.delayMinutes, req.body.reason, req.user?.id);

      await logAudit(req, {
        entityType: AuditEntity.ORDER,
        entityId: order._id.toString(),
        action: AuditAction.KITCHEN_ORDER_DELAYED,
        metadata: { delayMinutes: req.body.delayMinutes },
      });

      ok(res, { order });
    } catch (error) {
      next(error);
    }
  }

  static async rejectOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const restaurantId = KitchenController.getRequiredRestaurantId(req);
      const order = await OrdersService.rejectOrder(restaurantId, req.params.id, req.body.reason, req.user?.id);

      await logAudit(req, {
        entityType: AuditEntity.ORDER,
        entityId: order._id.toString(),
        action: AuditAction.KITCHEN_ORDER_REJECTED,
        metadata: { reason: req.body.reason },
      });

      ok(res, { order });
    } catch (error) {
      next(error);
    }
  }

  static async addInternalNote(req: Request, res: Response, next: NextFunction) {
    try {
      const restaurantId = KitchenController.getRequiredRestaurantId(req);
      if (!req.user) {
        throw new AppError('User context required', 403, ErrorCode.FORBIDDEN);
      }

      const actor = {
        id: req.user.id,
        name: (req.user as any).name || 'Unknown',
        role: req.user.role,
      };

      const order = await OrdersService.addInternalNote(restaurantId, req.params.id, req.body.content, actor);

      await logAudit(req, {
        entityType: AuditEntity.ORDER,
        entityId: order._id.toString(),
        action: AuditAction.KITCHEN_ORDER_NOTE_ADDED,
        metadata: { event: 'KITCHEN_ORDER_NOTE_ADDED', content: req.body.content },
      });

      ok(res, { order });
    } catch (error) {
      next(error);
    }
  }

  static async getBatches(req: Request, res: Response, next: NextFunction) {
    try {
      const restaurantId = KitchenController.getRequiredRestaurantId(req);
      const batches = await KitchenService.getBatches(restaurantId);

      ok(res, {
        batches,
        meta: {
          count: batches.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getSuggestedBatches(req: Request, res: Response, next: NextFunction) {
    try {
      const restaurantId = KitchenController.getRequiredRestaurantId(req);
      const batches = await KitchenService.getSuggestedBatches(restaurantId);

      ok(res, {
        batches,
        meta: {
          count: batches.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getBatch(req: Request, res: Response, next: NextFunction) {
    try {
      const restaurantId = KitchenController.getRequiredRestaurantId(req);
      const batch = await KitchenService.getBatchById(restaurantId, req.params.id);

      ok(res, { batch });
    } catch (error) {
      next(error);
    }
  }

  static async createBatch(req: Request, res: Response, next: NextFunction) {
    try {
      const restaurantId = KitchenController.getRequiredRestaurantId(req);
      const batch = await KitchenService.createBatch(restaurantId, req.body);

      // Emit socket event for Kitchen
      const { socketService } = await import('../../sockets/socket.service');
      const { SocketEvent } = await import('../../constants/events');
      socketService.emitToRestaurant(restaurantId.toString(), SocketEvent.KITCHEN_BATCH_UPDATED, { batch });

      await logAudit(req, {
        entityType: AuditEntity.KITCHEN,
        entityId: batch._id.toString(),
        action: AuditAction.ADMIN_SETTINGS_UPDATED,
        metadata: { event: 'KITCHEN_BATCH_CREATED', orderIds: req.body.orderIds, station: req.body.station },
      });

      ok(res, { batch }, 201);
    } catch (error) {
      next(error);
    }
  }

  static async updateBatch(req: Request, res: Response, next: NextFunction) {
    try {
      const restaurantId = KitchenController.getRequiredRestaurantId(req);
      const batch = await KitchenService.updateBatch(restaurantId, req.params.id, req.body);

      // Emit socket event for Kitchen
      const { socketService } = await import('../../sockets/socket.service');
      const { SocketEvent } = await import('../../constants/events');
      socketService.emitToRestaurant(restaurantId.toString(), SocketEvent.KITCHEN_BATCH_UPDATED, { batch });

      await logAudit(req, {
        entityType: AuditEntity.KITCHEN,
        entityId: batch._id.toString(),
        action: AuditAction.ADMIN_SETTINGS_UPDATED,
        metadata: { event: 'KITCHEN_BATCH_UPDATED', ...req.body },
      });

      ok(res, { batch });
    } catch (error) {
      next(error);
    }
  }

  static async getLoad(req: Request, res: Response, next: NextFunction) {
    try {
      const restaurantId = KitchenController.getRequiredRestaurantId(req);
      const result = await KitchenService.getStationLoad(restaurantId);

      ok(res, {
        stations: result.stations,
        aggregate: result.aggregate,
        meta: {
          count: result.stations.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getPerformance(req: Request, res: Response, next: NextFunction) {
    try {
      const restaurantId = KitchenController.getRequiredRestaurantId(req);
      const chefs = await KitchenService.getPerformance(restaurantId);

      ok(res, {
        chefs,
        meta: {
          count: chefs.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getMenuItems(req: Request, res: Response, next: NextFunction) {
    try {
      const restaurantId = KitchenController.getRequiredRestaurantId(req);
      const query = {
        page: 1,
        limit: 1000,
        skip: 0,
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
      };
      const result = await MenuService.getItems(restaurantId, query);
      ok(res, result);
    } catch (error) {
      next(error);
    }
  }

  static async updateMenuAvailability(req: Request, res: Response, next: NextFunction) {
    try {
      const restaurantId = KitchenController.getRequiredRestaurantId(req);
      const menuItem = await MenuService.updateItemAvailabilityStatus(
        restaurantId,
        req.params.id,
        req.body.availabilityStatus,
        req.user?.id as string
      );

      await logAudit(req, {
        entityType: AuditEntity.MENU_ITEM,
        entityId: menuItem._id.toString(),
        action: AuditAction.ADMIN_SETTINGS_UPDATED,
        metadata: {
          event: 'KITCHEN_MENU_AVAILABILITY_UPDATED',
          availabilityStatus: menuItem.availabilityStatus,
          isAvailable: menuItem.isAvailable,
        },
      });

      ok(res, { item: menuItem });
    } catch (error) {
      next(error);
    }
  }

  static async getAlerts(req: Request, res: Response, next: NextFunction) {
    try {
      const restaurantId = KitchenController.getRequiredRestaurantId(req);
      const alerts = await KitchenAlertService.getActiveAlerts(restaurantId);
      ok(res, alerts);
    } catch (error) {
      next(error);
    }
  }

  static async resolveAlert(req: Request, res: Response, next: NextFunction) {
    try {
      const restaurantId = KitchenController.getRequiredRestaurantId(req);
      const alert = await KitchenAlertService.resolveAlert(
        restaurantId,
        req.params.id,
        req.user?.id
      );

      if (alert) {
        await logAudit(req, {
          entityType: AuditEntity.RESTAURANT,
          entityId: restaurantId.toString(),
          action: AuditAction.KITCHEN_ALERT_RESOLVED,
          metadata: {
            event: 'KITCHEN_ALERT_RESOLVED',
            alertId: alert._id.toString(),
            alertType: alert.type,
          },
        });
      }

      ok(res, { alert });
    } catch (error) {
      next(error);
    }
  }

  static async getJoinees(req: Request, res: Response, next: NextFunction) {
    try {
      const restaurantId = KitchenController.getRequiredRestaurantId(req);
      const { KitchenJoineeModel } = await import('./kitchenJoinee.model');
      const joinees = await KitchenJoineeModel.find({ restaurantId }).sort({ createdAt: -1 });
      ok(res, joinees);
    } catch (error) {
      next(error);
    }
  }

  static async updateJoineeStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const restaurantId = KitchenController.getRequiredRestaurantId(req);
      const { KitchenJoineeModel } = await import('./kitchenJoinee.model');
      const joinee = await KitchenJoineeModel.findOneAndUpdate(
        { _id: req.params.id, restaurantId },
        { status: req.body.status },
        { new: true }
      );
      if (!joinee) throw new AppError('Joinee not found', 404, ErrorCode.NOT_FOUND);
      ok(res, joinee);
    } catch (error) {
      next(error);
    }
  }

  static async getSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const restaurantId = KitchenController.getRequiredRestaurantId(req);
      const { RestaurantModel } = await import('../restaurants/restaurants.model');
      const restaurant = await RestaurantModel.findById(restaurantId).select('settings.kitchenSettings');
      const settings = restaurant?.settings?.kitchenSettings || {};
      ok(res, settings);
    } catch (error) {
      next(error);
    }
  }

  static async updateSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const restaurantId = KitchenController.getRequiredRestaurantId(req);
      const { RestaurantModel } = await import('../restaurants/restaurants.model');
      
      const updateData: any = {};
      for (const [key, value] of Object.entries(req.body)) {
        updateData[`settings.kitchenSettings.${key}`] = value;
      }
      
      const restaurant = await RestaurantModel.findByIdAndUpdate(
        restaurantId,
        { $set: updateData },
        { new: true }
      );
      
      ok(res, restaurant?.settings?.kitchenSettings || {});
    } catch (error) {
      next(error);
    }
  }

  static async updateInventoryUsage(req: Request, res: Response, next: NextFunction) {
    try {
      const restaurantId = KitchenController.getRequiredRestaurantId(req);
      const amount = req.body.amount || 1;
      const { InventoryItemModel } = await import('../inventory/inventory.model');
      const item = await InventoryItemModel.findOneAndUpdate(
        { _id: req.params.id, restaurantId },
        { $inc: { stock: -amount, dailyUsage: amount } },
        { new: true }
      );
      if (!item) throw new AppError('Inventory item not found', 404, ErrorCode.NOT_FOUND);
      ok(res, item);
    } catch (error) {
      next(error);
    }
  }

  static async restockInventory(req: Request, res: Response, next: NextFunction) {
    try {
      const restaurantId = KitchenController.getRequiredRestaurantId(req);
      const amount = req.body.amount || 10;
      const { InventoryItemModel } = await import('../inventory/inventory.model');
      const item = await InventoryItemModel.findOneAndUpdate(
        { _id: req.params.id, restaurantId },
        { 
          $inc: { stock: amount },
          $set: { lastRestocked: new Date() }
        },
        { new: true }
      );
      if (!item) throw new AppError('Inventory item not found', 404, ErrorCode.NOT_FOUND);
      ok(res, item);
    } catch (error) {
      next(error);
    }
  }
}
