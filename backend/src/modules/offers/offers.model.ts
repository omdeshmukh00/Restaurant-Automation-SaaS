import mongoose, { Document, Schema, Types } from 'mongoose';

export type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT';
export type OfferStatus = 'ACTIVE' | 'INACTIVE' | 'EXPIRED';

export interface IOffer extends Document {
  restaurantId: Types.ObjectId;
  title: string;
  description?: string;
  promoCode: string;
  discountType: DiscountType;
  discountValue: number;
  requiredPoints: number;
  minOrderAmount?: number;
  maxDiscount?: number;
  startDate: Date;
  expiryDate: Date;
  status: OfferStatus;
  displayPriority: number;
  image: string;
  createdAt: Date;
  updatedAt: Date;
}

const offerSchema = new Schema<IOffer>(
  {
    restaurantId: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    promoCode: { type: String, required: true, trim: true, uppercase: true },
    discountType: {
      type: String,
      enum: ['PERCENTAGE', 'FIXED_AMOUNT'],
      required: true,
    },
    discountValue: { type: Number, required: true, min: 0 },
    requiredPoints: { type: Number, default: 0, min: 0 },
    minOrderAmount: { type: Number, default: null, min: 0 },
    maxDiscount: { type: Number, default: null, min: 0 },
    startDate: { type: Date, required: true },
    expiryDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'EXPIRED'],
      default: 'INACTIVE',
    },
    displayPriority: { type: Number, default: 0, min: 0 },
    image: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'offers',
  },
);

offerSchema.index({ restaurantId: 1, status: 1 });
offerSchema.index({ restaurantId: 1, promoCode: 1 });
offerSchema.index({ restaurantId: 1, startDate: 1, expiryDate: 1 });
offerSchema.index({ restaurantId: 1, status: 1, startDate: 1, expiryDate: 1 });

export const OfferModel = mongoose.model<IOffer>('Offer', offerSchema);
