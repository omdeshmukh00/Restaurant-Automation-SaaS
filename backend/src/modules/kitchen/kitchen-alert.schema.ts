import mongoose, { Schema, Document } from 'mongoose';

export enum KitchenAlertType {
  OVERDUE_ORDER = 'OVERDUE_ORDER',
  VIP_ARRIVAL = 'VIP_ARRIVAL',
  CRITICAL_LOAD = 'CRITICAL_LOAD',
  INGREDIENT_SHORTAGE = 'INGREDIENT_SHORTAGE',
}

export enum KitchenAlertStatus {
  ACTIVE = 'ACTIVE',
  RESOLVED = 'RESOLVED',
  IGNORED = 'IGNORED',
}

export interface IKitchenAlert extends Document {
  restaurantId: mongoose.Types.ObjectId;
  type: KitchenAlertType;
  title: string;
  message: string;
  status: KitchenAlertStatus;
  
  // Optional references
  orderId?: mongoose.Types.ObjectId;
  tableId?: mongoose.Types.ObjectId;
  stationId?: mongoose.Types.ObjectId;
  
  resolvedAt?: Date;
  resolvedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export const kitchenAlertSchema = new Schema<IKitchenAlert>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(KitchenAlertType),
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(KitchenAlertStatus),
      default: KitchenAlertStatus.ACTIVE,
      index: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
    },
    tableId: {
      type: Schema.Types.ObjectId,
      ref: 'Table',
    },
    stationId: {
      type: Schema.Types.ObjectId,
      ref: 'KitchenBatch', // Or Station model if exists
    },
    resolvedAt: {
      type: Date,
    },
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);
