import mongoose, { Document, Schema, Types } from 'mongoose';

export type MaintenanceIssueType = 'BROKEN_FURNITURE' | 'WATER_LEAK' | 'ELECTRICAL' | 'HYGIENE' | 'OTHER';
export type MaintenanceSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type MaintenanceStatus = 'REPORTED' | 'IN_REPAIR' | 'RESOLVED';

export interface IMaintenanceIssue extends Document {
  restaurantId: Types.ObjectId;
  tableId: Types.ObjectId;
  reportedBy: Types.ObjectId;
  issueType: MaintenanceIssueType;
  description: string;
  severity: MaintenanceSeverity;
  status: MaintenanceStatus;
  createdAt: Date;
  updatedAt: Date;
}

const maintenanceIssueSchema = new Schema<IMaintenanceIssue>(
  {
    restaurantId: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
    tableId: { type: Schema.Types.ObjectId, ref: 'Table', required: true, index: true },
    reportedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    issueType: {
      type: String,
      enum: ['BROKEN_FURNITURE', 'WATER_LEAK', 'ELECTRICAL', 'HYGIENE', 'OTHER'],
      required: true,
    },
    description: { type: String, required: true, trim: true },
    severity: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'MEDIUM',
    },
    status: {
      type: String,
      enum: ['REPORTED', 'IN_REPAIR', 'RESOLVED'],
      default: 'REPORTED',
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'maintenanceIssues',
  },
);

maintenanceIssueSchema.index({ restaurantId: 1, status: 1 });

export const MaintenanceIssueModel = mongoose.model<IMaintenanceIssue>('MaintenanceIssue', maintenanceIssueSchema);
