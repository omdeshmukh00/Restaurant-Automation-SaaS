import mongoose, { Document, Schema } from 'mongoose';

export interface IPlatformSettings extends Document {
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
    applicationFeeEnabled: { type: Boolean, default: false },
    applicationFeeAmount: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'INR', uppercase: true },
    refundPolicy: { type: String, enum: ['refundable', 'non-refundable'], default: 'refundable' },
    enablePartnerRegistration: { type: Boolean, default: true },
    maxPendingApplications: { type: Number, default: 50, min: 1 },
    applicationExpiryDays: { type: Number, default: 30, min: 1 },
    platformCommissionRate: { type: Number, default: 10, min: 0, max: 100 },
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
  const allSettings = await PlatformSettingsModel.find().sort({ updatedAt: -1 });

  if (allSettings.length === 0) {
    // No document exists — create one with defaults
    const settings = await PlatformSettingsModel.create({
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
    await PlatformSettingsModel.deleteMany({ _id: { $in: duplicateIds } });
  }

  // Strip any stale tenantId field from the canonical document
  if ((canonical as any).tenantId) {
    await PlatformSettingsModel.updateOne(
      { _id: canonical._id },
      { $unset: { tenantId: '' } }
    );
  }

  return canonical;
}
