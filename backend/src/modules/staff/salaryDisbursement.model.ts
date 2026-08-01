// src/modules/staff/salaryDisbursement.model.ts
// Mongoose model for tracking salary payments to restaurant staff.

import mongoose, { Document, Schema, Types } from 'mongoose';

export enum DisbursementStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
}

export enum PaymentMethod {
  CASH = 'CASH',
  BANK_TRANSFER = 'BANK_TRANSFER',
  UPI = 'UPI',
  OTHER = 'OTHER',
}

export interface ISalaryDisbursement extends Document {
  restaurantId: Types.ObjectId;
  staffId: Types.ObjectId;
  staffName: string;
  staffRole: string;
  amount: number;
  month: number; // 1-12
  year: number;
  status: DisbursementStatus;
  paymentMethod: PaymentMethod;
  paidAt?: Date | null;
  paidBy?: Types.ObjectId | null; // admin who initiated the payment
  transactionRef?: string | null;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const salaryDisbursementSchema = new Schema<ISalaryDisbursement>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
      index: true,
    },
    staffId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    staffName: { type: String, required: true, trim: true },
    staffRole: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true, min: 2020 },
    status: {
      type: String,
      enum: Object.values(DisbursementStatus),
      default: DisbursementStatus.PENDING,
    },
    paymentMethod: {
      type: String,
      enum: Object.values(PaymentMethod),
      default: PaymentMethod.CASH,
    },
    paidAt: { type: Date, default: null },
    paidBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    transactionRef: { type: String, trim: true, default: null },
    notes: { type: String, trim: true, default: '' },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'salaryDisbursements',
  },
);

salaryDisbursementSchema.index({ restaurantId: 1, month: 1, year: 1 });
salaryDisbursementSchema.index({ restaurantId: 1, staffId: 1, month: 1, year: 1 }, { unique: true });

export const SalaryDisbursementModel = mongoose.model<ISalaryDisbursement>(
  'SalaryDisbursement',
  salaryDisbursementSchema,
);
