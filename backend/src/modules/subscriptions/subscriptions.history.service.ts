import mongoose from 'mongoose';
import { SubscriptionEventModel, SubscriptionEventType } from './subscriptions.model';
import {
  RestaurantSubscriptionHistoryEventType,
  RestaurantSubscriptionHistoryModel,
} from './restaurantSubscriptionHistory.model';

function mapEventType(type: SubscriptionEventType): RestaurantSubscriptionHistoryEventType {
  switch (type) {
    case SubscriptionEventType.CREATED:
      return RestaurantSubscriptionHistoryEventType.SUBSCRIPTION_CREATED;
    case SubscriptionEventType.UPGRADED:
      return RestaurantSubscriptionHistoryEventType.UPGRADED;
    case SubscriptionEventType.DOWNGRADED:
      return RestaurantSubscriptionHistoryEventType.DOWNGRADED;
    case SubscriptionEventType.CANCELLED:
      return RestaurantSubscriptionHistoryEventType.CANCELLED;
    case SubscriptionEventType.CANCELLATION_SCHEDULED:
      return RestaurantSubscriptionHistoryEventType.CANCELLATION_SCHEDULED;
    case SubscriptionEventType.RENEWED:
      return RestaurantSubscriptionHistoryEventType.RENEWED;
    case SubscriptionEventType.EXPIRED:
      return RestaurantSubscriptionHistoryEventType.EXPIRED;
    case SubscriptionEventType.USAGE_RECORDED:
      return RestaurantSubscriptionHistoryEventType.USAGE_RECORDED;
    case SubscriptionEventType.LIMIT_WARNING:
      return RestaurantSubscriptionHistoryEventType.LIMIT_WARNING;
    case SubscriptionEventType.LIMIT_EXCEEDED:
      return RestaurantSubscriptionHistoryEventType.LIMIT_EXCEEDED;
    case SubscriptionEventType.FEATURE_BLOCKED:
      return RestaurantSubscriptionHistoryEventType.FEATURE_BLOCKED;
    case SubscriptionEventType.PAYMENT_CREATED:
      return RestaurantSubscriptionHistoryEventType.PAYMENT_CREATED;
    case SubscriptionEventType.PAYMENT_COMPLETED:
      return RestaurantSubscriptionHistoryEventType.PAYMENT_COMPLETED;
    case SubscriptionEventType.PAYMENT_FAILED:
      return RestaurantSubscriptionHistoryEventType.PAYMENT_FAILED;
    case SubscriptionEventType.AUTO_RENEWAL_SKIPPED:
      // Not explicitly represented in history enum; reuse expired slot to preserve audit trail.
      return RestaurantSubscriptionHistoryEventType.EXPIRED;
    case SubscriptionEventType.ACTIVATED:
    case SubscriptionEventType.UPDATED:
    default:
      return RestaurantSubscriptionHistoryEventType.PLAN_UPDATED;
  }
}

export async function appendSubscriptionHistory(params: {
  subscriptionId?: string | mongoose.Types.ObjectId;
  restaurantId: string | mongoose.Types.ObjectId;
  eventType: SubscriptionEventType | RestaurantSubscriptionHistoryEventType;
  plan?: string;
  billingCycle?: string;
  startDate?: Date;
  endDate?: Date;
  paymentId?: string;
  amount?: number;
  status?: string;
  changedBy?: string;
  metadata?: Record<string, unknown>;
  writeLegacyEvent?: boolean;
}) {
  const {
    subscriptionId,
    restaurantId,
    eventType,
    plan = 'Free',
    billingCycle = 'monthly',
    startDate = new Date(),
    endDate = new Date(),
    paymentId = 'manual',
    amount = 0,
    status = 'active',
    changedBy = 'system',
    metadata = {},
    writeLegacyEvent = true,
  } = params;

  const subId = subscriptionId ? new mongoose.Types.ObjectId(subscriptionId) : undefined;
  const restId = new mongoose.Types.ObjectId(restaurantId);

  // Determine the RestaurantSubscriptionHistoryEventType
  let mappedType: RestaurantSubscriptionHistoryEventType;
  if (Object.values(RestaurantSubscriptionHistoryEventType).includes(eventType as any)) {
    mappedType = eventType as RestaurantSubscriptionHistoryEventType;
  } else {
    mappedType = mapEventType(eventType as SubscriptionEventType);
  }

  // Write to legacy subscriptionEvents as well (so we don’t break existing analytics).
  if (writeLegacyEvent && subId) {
    const legacyType = Object.values(SubscriptionEventType).includes(eventType as any)
      ? (eventType as SubscriptionEventType)
      : SubscriptionEventType.UPDATED;

    await SubscriptionEventModel.create({
      subscriptionId: subId,
      restaurantId: restId,
      type: legacyType,
      metadata,
    });
  }

  // Write to dedicated history model.
  await RestaurantSubscriptionHistoryModel.create({
    subscriptionId: subId,
    restaurantId: restId,
    plan,
    billingCycle,
    startDate,
    endDate,
    paymentId,
    amount,
    status,
    changedBy,
    eventType: mappedType,
    metadata,
  });
}

