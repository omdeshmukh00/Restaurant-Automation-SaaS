// src/modules/settlement/settlement.model.ts
// Settlement model for restaurant admin settlement records.

import mongoose, { Document, Schema, Types } from 'mongoose';

export enum SettlementStatus {
  PENDING = 'PENDING',
  GENERATED = 'GENERATED',
  PAID = 'PAID',
}

export interface ISettlement extends Document {
  restaurantId: Types.ObjectId;
  settlementPeriod: {
    from: Date;
    to: Date;
  };
  orderIds: Types.ObjectId[];
  grossSales: number;
  discounts: number;
  taxableAmount: number;
  gstCollected: number;
  platformCommissionRate: number;
  platformCommission: number;
  refunds: number;
  netSettlement: number;
  status: SettlementStatus;
  generatedAt?: Date;
  paidAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const settlementSchema = new Schema<ISettlement>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
      index: true,
    },
    settlementPeriod: {
      from: { type: Date, required: true },
      to: { type: Date, required: true },
    },
    orderIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Order',
        required: true,
      },
    ],
    grossSales: { type: Number, required: true, min: 0 },
    discounts: { type: Number, default: 0, min: 0 },
    taxableAmount: { type: Number, default: 0, min: 0 },
    gstCollected: { type: Number, default: 0, min: 0 },
    platformCommissionRate: { type: Number, default: 0, min: 0, max: 100 },
    platformCommission: { type: Number, default: 0, min: 0 },
    refunds: { type: Number, default: 0, min: 0 },
    netSettlement: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: Object.values(SettlementStatus),
      default: SettlementStatus.PENDING,
    },
    generatedAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
    notes: { type: String, trim: true, default: '' },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'settlements',
  },
);

settlementSchema.index({ restaurantId: 1, status: 1 });
settlementSchema.index({ restaurantId: 1, 'settlementPeriod.from': -1 });

export const SettlementModel = mongoose.model<ISettlement>('Settlement', settlementSchema);
