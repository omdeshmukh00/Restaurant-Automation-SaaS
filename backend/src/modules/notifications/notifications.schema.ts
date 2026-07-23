// src/modules/notifications/notifications.schema.ts
// Notification schemas and enums — matches PRD Section 16 (Admin Notification Bell)

export enum NotificationModule {
  ORDERS = 'ORDERS',
  KITCHEN = 'KITCHEN',
  RESERVATIONS = 'RESERVATIONS',
  PAYMENTS = 'PAYMENTS',
  STAFF = 'STAFF',
  INVENTORY = 'INVENTORY',
  CLEANING = 'CLEANING',
  MENU = 'MENU',
  RESTAURANT_SETTINGS = 'RESTAURANT_SETTINGS',
  SUBSCRIPTION = 'SUBSCRIPTION',
  SETTLEMENT = 'SETTLEMENT',
  SYSTEM = 'SYSTEM',
}

export enum NotificationCategory {
  STAFF = 'STAFF',
  CLEANING = 'CLEANING',
  SYSTEM = 'SYSTEM',
}

export enum NotificationPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export const NOTIFICATION_TYPE_MAP: Record<string, { module: NotificationModule; category: NotificationCategory; priority: NotificationPriority }> = {
  // ── Orders ──
  ORDER_NEW: { module: NotificationModule.ORDERS, category: NotificationCategory.STAFF, priority: NotificationPriority.NORMAL },
  ORDER_CANCELLED: { module: NotificationModule.ORDERS, category: NotificationCategory.STAFF, priority: NotificationPriority.NORMAL },
  ORDER_LARGE_VALUE: { module: NotificationModule.ORDERS, category: NotificationCategory.STAFF, priority: NotificationPriority.HIGH },
  ORDER_MULTIPLE_CANCELLATIONS: { module: NotificationModule.ORDERS, category: NotificationCategory.STAFF, priority: NotificationPriority.HIGH },

  // ── Kitchen ──
  KITCHEN_QUEUE_OVERLOADED: { module: NotificationModule.KITCHEN, category: NotificationCategory.STAFF, priority: NotificationPriority.HIGH },
  KITCHEN_PREPARATION_DELAYED: { module: NotificationModule.KITCHEN, category: NotificationCategory.STAFF, priority: NotificationPriority.NORMAL },
  KITCHEN_PROCESSING_ERROR: { module: NotificationModule.KITCHEN, category: NotificationCategory.STAFF, priority: NotificationPriority.HIGH },

  // ── Reservations ──
  RESERVATION_NEW: { module: NotificationModule.RESERVATIONS, category: NotificationCategory.STAFF, priority: NotificationPriority.NORMAL },
  RESERVATION_CANCELLED: { module: NotificationModule.RESERVATIONS, category: NotificationCategory.STAFF, priority: NotificationPriority.NORMAL },
  RESERVATION_NO_SHOW: { module: NotificationModule.RESERVATIONS, category: NotificationCategory.STAFF, priority: NotificationPriority.NORMAL },
  RESERVATION_ARRIVAL_EXPIRED: { module: NotificationModule.RESERVATIONS, category: NotificationCategory.STAFF, priority: NotificationPriority.NORMAL },

  // ── Payments ──
  PAYMENT_SUCCESS: { module: NotificationModule.PAYMENTS, category: NotificationCategory.STAFF, priority: NotificationPriority.NORMAL },
  PAYMENT_FAILED: { module: NotificationModule.PAYMENTS, category: NotificationCategory.STAFF, priority: NotificationPriority.HIGH },
  PAYMENT_REFUND_PROCESSED: { module: NotificationModule.PAYMENTS, category: NotificationCategory.STAFF, priority: NotificationPriority.NORMAL },
  PAYMENT_VERIFICATION_FAILED: { module: NotificationModule.PAYMENTS, category: NotificationCategory.STAFF, priority: NotificationPriority.HIGH },

  // ── Staff ──
  STAFF_CREATED: { module: NotificationModule.STAFF, category: NotificationCategory.STAFF, priority: NotificationPriority.NORMAL },
  STAFF_UPDATED: { module: NotificationModule.STAFF, category: NotificationCategory.STAFF, priority: NotificationPriority.NORMAL },
  STAFF_DELETED: { module: NotificationModule.STAFF, category: NotificationCategory.STAFF, priority: NotificationPriority.NORMAL },
  STAFF_SUSPENDED: { module: NotificationModule.STAFF, category: NotificationCategory.STAFF, priority: NotificationPriority.NORMAL },

  // ── Inventory ──
  INVENTORY_LOW_STOCK: { module: NotificationModule.INVENTORY, category: NotificationCategory.STAFF, priority: NotificationPriority.HIGH },
  INVENTORY_OUT_OF_STOCK: { module: NotificationModule.INVENTORY, category: NotificationCategory.STAFF, priority: NotificationPriority.URGENT },
  INVENTORY_CRITICAL_STOCK: { module: NotificationModule.INVENTORY, category: NotificationCategory.STAFF, priority: NotificationPriority.URGENT },

  // ── Cleaning ──
  CLEANING_TASK_OVERDUE: { module: NotificationModule.CLEANING, category: NotificationCategory.CLEANING, priority: NotificationPriority.NORMAL },
  CLEANING_TASK_COMPLETED: { module: NotificationModule.CLEANING, category: NotificationCategory.CLEANING, priority: NotificationPriority.LOW },
  CLEANING_HIGH_PRIORITY_ASSIGNED: { module: NotificationModule.CLEANING, category: NotificationCategory.CLEANING, priority: NotificationPriority.HIGH },

  // ── Menu ──
  MENU_ITEM_DISABLED: { module: NotificationModule.MENU, category: NotificationCategory.STAFF, priority: NotificationPriority.NORMAL },
  MENU_ITEM_UNAVAILABLE: { module: NotificationModule.MENU, category: NotificationCategory.STAFF, priority: NotificationPriority.NORMAL },
  MENU_CATEGORY_DISABLED: { module: NotificationModule.MENU, category: NotificationCategory.STAFF, priority: NotificationPriority.NORMAL },

  // ── Restaurant Settings ──
  RESTAURANT_PROFILE_UPDATED: { module: NotificationModule.RESTAURANT_SETTINGS, category: NotificationCategory.STAFF, priority: NotificationPriority.LOW },
  RESTAURANT_BUSINESS_INFO_UPDATED: { module: NotificationModule.RESTAURANT_SETTINGS, category: NotificationCategory.STAFF, priority: NotificationPriority.LOW },
  RESTAURANT_SETTINGS_MODIFIED: { module: NotificationModule.RESTAURANT_SETTINGS, category: NotificationCategory.STAFF, priority: NotificationPriority.LOW },

  // ── Subscription ──
  SUBSCRIPTION_UPGRADED: { module: NotificationModule.SUBSCRIPTION, category: NotificationCategory.SYSTEM, priority: NotificationPriority.LOW },
  SUBSCRIPTION_DOWNGRADED: { module: NotificationModule.SUBSCRIPTION, category: NotificationCategory.SYSTEM, priority: NotificationPriority.LOW },
  SUBSCRIPTION_RENEWED: { module: NotificationModule.SUBSCRIPTION, category: NotificationCategory.SYSTEM, priority: NotificationPriority.LOW },
  SUBSCRIPTION_PAYMENT_FAILED: { module: NotificationModule.SUBSCRIPTION, category: NotificationCategory.SYSTEM, priority: NotificationPriority.HIGH },
  SUBSCRIPTION_TRIAL_ENDING: { module: NotificationModule.SUBSCRIPTION, category: NotificationCategory.SYSTEM, priority: NotificationPriority.NORMAL },
  SUBSCRIPTION_EXPIRING_SOON: { module: NotificationModule.SUBSCRIPTION, category: NotificationCategory.SYSTEM, priority: NotificationPriority.HIGH },

  // ── Settlement ──
  SETTLEMENT_GENERATED: { module: NotificationModule.SETTLEMENT, category: NotificationCategory.STAFF, priority: NotificationPriority.NORMAL },
  SETTLEMENT_COMPLETED: { module: NotificationModule.SETTLEMENT, category: NotificationCategory.STAFF, priority: NotificationPriority.NORMAL },
  SETTLEMENT_FAILED: { module: NotificationModule.SETTLEMENT, category: NotificationCategory.STAFF, priority: NotificationPriority.HIGH },

  // ── System ──
  SYSTEM_JOB_FAILED: { module: NotificationModule.SYSTEM, category: NotificationCategory.SYSTEM, priority: NotificationPriority.HIGH },
  SYSTEM_DATABASE_BACKUP_COMPLETED: { module: NotificationModule.SYSTEM, category: NotificationCategory.SYSTEM, priority: NotificationPriority.LOW },
  SYSTEM_MAINTENANCE_ANNOUNCEMENT: { module: NotificationModule.SYSTEM, category: NotificationCategory.SYSTEM, priority: NotificationPriority.NORMAL },
  SYSTEM_CRITICAL_ISSUE: { module: NotificationModule.SYSTEM, category: NotificationCategory.SYSTEM, priority: NotificationPriority.URGENT },
};

export const MODULE_ACTION_URLS: Record<string, string> = {
  ORDERS: '/admin/orders',
  KITCHEN: '/admin/orders',
  RESERVATIONS: '/admin/reservations',
  PAYMENTS: '/admin/orders',
  STAFF: '/admin/staff',
  INVENTORY: '/admin/inventory',
  CLEANING: '/admin',
  MENU: '/admin/menu',
  RESTAURANT_SETTINGS: '/admin/settings',
  SUBSCRIPTION: '/admin/settings',
  SETTLEMENT: '/admin/settlements',
  SYSTEM: '/admin',
};
