import mongoose, { Document, Schema } from 'mongoose';

export interface IPlatformSettings extends Document {
  platformName: string;
  supportEmail: string;
  notificationEmail?: string;
  emailNotifications?: {
    newRestaurant: boolean;
    subscriptionChange: boolean;
    paymentFailed: boolean;
    alertEscalation: boolean;
    weeklyDigest: boolean;
  };
  pushNotifications?: {
    enabled: boolean;
    criticalAlerts: boolean;
    restaurantUpdates: boolean;
    systemHealth: boolean;
  };
  inAppPreferences?: {
    sound: boolean;
    badge: boolean;
    desktopPopup: boolean;
  };
  timezone: string;
  language: string;
  dateFormat: string;
  maintenanceMode: boolean;
  disableCustomerPanel: boolean;
  disableKitchenPanel: boolean;
  disableStaffPanel: boolean;
  disableCleaningPanel: boolean;
  disableAdminPanel: boolean;
  applicationFeeEnabled: boolean;
  applicationFeeAmount: number;
  currency: string;
  refundPolicy: 'refundable' | 'non-refundable';
  enablePartnerRegistration: boolean;
  maxPendingApplications: number;
  applicationExpiryDays: number;
  platformCommissionRate?: number;
  createdAt: Date;
  updatedAt: Date;
}

const platformSettingsSchema = new Schema<IPlatformSettings>(
  {
    platformName: { type: String, default: 'Graphura', trim: true },
    supportEmail: { type: String, default: 'support@graphura.in', trim: true, lowercase: true },
    notificationEmail: { type: String, default: 'support@graphura.in', trim: true, lowercase: true },
    emailNotifications: {
      newRestaurant: { type: Boolean, default: true },
      subscriptionChange: { type: Boolean, default: true },
      paymentFailed: { type: Boolean, default: true },
      alertEscalation: { type: Boolean, default: true },
      weeklyDigest: { type: Boolean, default: false },
    },
    pushNotifications: {
      enabled: { type: Boolean, default: true },
      criticalAlerts: { type: Boolean, default: true },
      restaurantUpdates: { type: Boolean, default: false },
      systemHealth: { type: Boolean, default: true },
    },
    inAppPreferences: {
      sound: { type: Boolean, default: true },
      badge: { type: Boolean, default: true },
      desktopPopup: { type: Boolean, default: false },
    },
    timezone: { type: String, default: 'Asia/Kolkata' },
    language: { type: String, default: 'en' },
    dateFormat: { type: String, default: 'DD/MM/YYYY' },
    maintenanceMode: { type: Boolean, default: false },
    disableCustomerPanel: { type: Boolean, default: false },
    disableKitchenPanel: { type: Boolean, default: false },
    disableStaffPanel: { type: Boolean, default: false },
    disableCleaningPanel: { type: Boolean, default: false },
    disableAdminPanel: { type: Boolean, default: false },
    applicationFeeEnabled: { type: Boolean, default: false },
    applicationFeeAmount: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'INR', uppercase: true },
    refundPolicy: { type: String, enum: ['refundable', 'non-refundable'], default: 'refundable' },
    enablePartnerRegistration: { type: Boolean, default: true },
    maxPendingApplications: { type: Number, default: 50, min: 1 },
    applicationExpiryDays: { type: Number, default: 30, min: 1 },
    platformCommissionRate: { type: Number, default: 8, min: 0, max: 100 },
  },
  {
    timestamps: true,
    collection: 'platformSettings',
  }
);

export const PlatformSettingsModel = mongoose.model<IPlatformSettings>('PlatformSettings', platformSettingsSchema);

/**
 * Retrieves the global platform settings document (singleton pattern).
 * If no document exists, it creates one with default values.
 */
export async function getPlatformSettings(): Promise<IPlatformSettings> {
  // Find all settings documents (there may be duplicates from tenant plugin bug)
  const allSettings = await PlatformSettingsModel.find().setOptions({ bypassTenant: true }).sort({ updatedAt: -1 });

  if (allSettings.length === 0) {
    // No document exists — create one with defaults
    const settings = await PlatformSettingsModel.create({
      platformName: 'Graphura',
      supportEmail: 'support@graphura.in',
      notificationEmail: 'support@graphura.in',
      emailNotifications: {
        newRestaurant: true,
        subscriptionChange: true,
        paymentFailed: true,
        alertEscalation: true,
        weeklyDigest: false,
      },
      pushNotifications: {
        enabled: true,
        criticalAlerts: true,
        restaurantUpdates: false,
        systemHealth: true,
      },
      inAppPreferences: {
        sound: true,
        badge: true,
        desktopPopup: false,
      },
      timezone: 'Asia/Kolkata',
      language: 'en',
      dateFormat: 'DD/MM/YYYY',
      maintenanceMode: false,
      disableCustomerPanel: false,
      disableKitchenPanel: false,
      disableStaffPanel: false,
      disableCleaningPanel: false,
      disableAdminPanel: false,
      applicationFeeEnabled: false,
      applicationFeeAmount: 0,
      currency: 'INR',
      refundPolicy: 'refundable',
      enablePartnerRegistration: true,
      maxPendingApplications: 50,
      applicationExpiryDays: 30,
      platformCommissionRate: 10,
    });
    return settings;
  }

  // Use the most recently updated document as the canonical one
  const canonical = allSettings[0];

  // Clean up duplicates if any exist
  if (allSettings.length > 1) {
    const duplicateIds = allSettings.slice(1).map((s) => s._id);
    await PlatformSettingsModel.deleteMany({ _id: { $in: duplicateIds } }).setOptions({ bypassTenant: true });
  }

  // Strip any stale tenantId field from the canonical document
  if ((canonical as any).tenantId) {
    await PlatformSettingsModel.updateOne(
      { _id: canonical._id },
      { $unset: { tenantId: '' } }
    ).setOptions({ bypassTenant: true });
  }

  return canonical;
}
