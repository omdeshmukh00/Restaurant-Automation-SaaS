import mongoose, { Document, Schema, Types } from 'mongoose';
import { UserRole } from '../../constants/roles';
import { NotificationCategory, NotificationModule, NotificationPriority } from './notifications.schema';

export interface INotification extends Document {
  restaurantId: Types.ObjectId;
  tableSessionId?: Types.ObjectId | null;
  recipientRole: UserRole;
  title: string;
  message: string;
  type: string;
  module: NotificationModule;
  category: NotificationCategory;
  priority: NotificationPriority;
  entityId?: string | null;
  actionUrl?: string | null;
  expiresAt: Date;
  metadata?: Record<string, unknown>;
  isRead: boolean;
  readAt?: Date | null;
  readBy?: Types.ObjectId | null;
  isDeleted: boolean;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: [true, 'Restaurant ID is required'],
      index: true,
    },
    tableSessionId: {
      type: Schema.Types.ObjectId,
      ref: 'TableSession',
      default: null,
      index: true,
    },
    recipientRole: {
      type: String,
      enum: Object.values(UserRole),
      required: [true, 'Recipient role is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
      trim: true,
    },
    type: {
      type: String,
      required: [true, 'Notification type is required'],
      trim: true,
    },
    module: {
      type: String,
      enum: Object.values(NotificationModule),
      required: [true, 'Module is required'],
      index: true,
    },
    category: {
      type: String,
      enum: Object.values(NotificationCategory),
      default: NotificationCategory.STAFF,
      required: [true, 'Category is required'],
    },
    priority: {
      type: String,
      enum: Object.values(NotificationPriority),
      default: NotificationPriority.NORMAL,
      required: [true, 'Priority is required'],
    },
    entityId: {
      type: String,
      default: null,
      index: true,
    },
    actionUrl: {
      type: String,
      default: null,
    },
    expiresAt: {
      type: Date,
      required: [true, 'Expiry time is required'],
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    readBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'notifications',
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

notificationSchema.index({ restaurantId: 1, tableSessionId: 1, type: 1, createdAt: -1 });
notificationSchema.index({ restaurantId: 1, recipientRole: 1, isRead: 1, isDeleted: 1 });
notificationSchema.index({ restaurantId: 1, module: 1, createdAt: -1 });
notificationSchema.index({ restaurantId: 1, isDeleted: 1, createdAt: -1 });

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);
export const NotificationModel = Notification;
