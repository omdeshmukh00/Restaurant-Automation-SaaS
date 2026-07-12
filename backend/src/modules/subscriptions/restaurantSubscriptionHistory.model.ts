import { Schema, model, Document, Types } from 'mongoose';

export enum RestaurantSubscriptionHistoryEventType {
  SUBSCRIPTION_CREATED = 'SUBSCRIPTION_CREATED',
  PLAN_UPDATED = 'PLAN_UPDATED',
  UPGRADED = 'UPGRADED',
  DOWNGRADED = 'DOWNGRADED',
  CANCELLED = 'CANCELLED',
  CANCELLATION_SCHEDULED = 'CANCELLATION_SCHEDULED',
  RENEWED = 'RENEWED',
  EXPIRED = 'EXPIRED',
  USAGE_RECORDED = 'USAGE_RECORDED',
  PAYMENT_CREATED = 'PAYMENT_CREATED',
  PAYMENT_COMPLETED = 'PAYMENT_COMPLETED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  LIMIT_WARNING = 'LIMIT_WARNING',
  LIMIT_EXCEEDED = 'LIMIT_EXCEEDED',
  FEATURE_BLOCKED = 'FEATURE_BLOCKED',
  REFUNDED = 'REFUNDED',
}

export interface IRestaurantSubscriptionHistory extends Document {
  subscriptionId?: Types.ObjectId;
  restaurantId: Types.ObjectId;
  plan: string;
  billingCycle: string;
  startDate: Date;
  endDate: Date;
  paymentId?: string;
  amount: number;
  status: string;
  changedBy: string;
  eventType: RestaurantSubscriptionHistoryEventType;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

const restaurantSubscriptionHistorySchema = new Schema<IRestaurantSubscriptionHistory>(
  {
    subscriptionId: { type: Schema.Types.ObjectId, ref: 'Subscription', index: true },
    restaurantId: { type: Schema.Types.ObjectId, required: true, ref: 'Restaurant', index: true },
    plan: { type: String, required: true, default: 'Free' },
    billingCycle: { type: String, required: true, default: 'monthly' },
    startDate: { type: Date, required: true, default: Date.now },
    endDate: { type: Date, required: true, default: Date.now },
    paymentId: { type: String, default: null },
    amount: { type: Number, required: true, default: 0 },
    status: { type: String, required: true, default: 'active' },
    changedBy: { type: String, required: true, default: 'system' },
    eventType: { type: String, required: true, enum: Object.values(RestaurantSubscriptionHistoryEventType), index: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { collection: 'restaurantSubscriptionHistory', timestamps: true },
);



restaurantSubscriptionHistorySchema.index({ restaurantId: 1, subscriptionId: 1, createdAt: -1 });

export const RestaurantSubscriptionHistoryModel = model<IRestaurantSubscriptionHistory>(
  'RestaurantSubscriptionHistory',
  restaurantSubscriptionHistorySchema,
);

