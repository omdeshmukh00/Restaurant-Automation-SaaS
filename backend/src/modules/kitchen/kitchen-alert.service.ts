import { Types } from 'mongoose';
import { KitchenAlertModel } from './kitchen-alert.model';
import { KitchenAlertType, KitchenAlertStatus } from './kitchen-alert.schema';
import { socketService } from '../../sockets/socket.service';

export class KitchenAlertService {
  /**
   * Create a new kitchen alert and emit socket event
   */
  static async createAlert(data: {
    restaurantId: string | Types.ObjectId;
    type: KitchenAlertType;
    title: string;
    message: string;
    orderId?: string | Types.ObjectId;
    tableId?: string | Types.ObjectId;
    stationId?: string | Types.ObjectId;
  }) {
    const alert = await KitchenAlertModel.create({
      ...data,
      status: KitchenAlertStatus.ACTIVE,
    });

    socketService.emitToRestaurant(data.restaurantId.toString(), 'kitchen.alert' as any, {
      alert,
    });

    return alert;
  }

  /**
   * Get active alerts for a restaurant
   */
  static async getActiveAlerts(restaurantId: string | Types.ObjectId) {
    return KitchenAlertModel.find({
      restaurantId,
      status: KitchenAlertStatus.ACTIVE,
    }).sort({ createdAt: -1 });
  }

  /**
   * Resolve an alert
   */
  static async resolveAlert(
    restaurantId: string | Types.ObjectId,
    alertId: string | Types.ObjectId,
    actorId?: string | Types.ObjectId | null,
  ) {
    const alert = await KitchenAlertModel.findOneAndUpdate(
      { _id: alertId, restaurantId },
      {
        $set: {
          status: KitchenAlertStatus.RESOLVED,
          resolvedAt: new Date(),
          resolvedBy: actorId,
        },
      },
      { new: true }
    );

    if (alert) {
      socketService.emitToRestaurant(restaurantId.toString(), 'kitchen.alert_resolved' as any, {
        alertId: alert._id,
      });
    }

    return alert;
  }
}
