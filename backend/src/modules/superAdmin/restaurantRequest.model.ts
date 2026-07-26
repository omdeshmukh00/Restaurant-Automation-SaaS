import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IRestaurantRequest extends Document {
  restaurantName: string;
  ownerName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  pinCode: string;
  gstNumber?: string;
  cuisine: string;
  branches: number;
  expectedMonthlyOrders: number;
  selectedPlan?: string;
  latitude: number;
  longitude: number;
  googleMapsUrl?: string;
  message?: string;
  status: 'PENDING_PAYMENT' | 'APPLICATION_PENDING' | 'APPLICATION_APPROVED' | 'REJECTED';
  submittedAt: Date;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  restaurantId?: Types.ObjectId;
  rejectionReason?: string;
  isVeg?: string;
  coverImage?: string;
  
  // Payment Details
  paymentId?: string;
  orderId?: string;
  paymentAmount?: number;
  paymentCurrency?: string;
  paymentStatus?: string;
  paymentSignature?: string;
  paymentTimestamp?: Date;
  billingFrequency?: 'monthly' | 'yearly';
}

const restaurantRequestSchema = new Schema<IRestaurantRequest>(
  {
    restaurantName: { type: String, required: true, trim: true },
    ownerName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true },
    pinCode: { type: String, required: true, trim: true },
    gstNumber: { type: String, trim: true },
    cuisine: { type: String, required: true, trim: true },
    branches: { type: Number, required: true, default: 1 },
    expectedMonthlyOrders: { type: Number, required: true },
    selectedPlan: { type: String, trim: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    googleMapsUrl: { type: String, trim: true },
    message: { type: String, trim: true },
    status: {
      type: String,
      enum: ['PENDING_PAYMENT', 'APPLICATION_PENDING', 'APPLICATION_APPROVED', 'REJECTED'],
      default: 'APPLICATION_PENDING',
      index: true,
    },
    submittedAt: { type: Date, default: Date.now },
     reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    restaurantId: { type: Schema.Types.ObjectId, ref: 'Restaurant' },
    rejectionReason: { type: String, trim: true },
    isVeg: { type: String, enum: ['veg', 'non-veg', 'both'], default: 'both' },
    coverImage: { type: String, trim: true },

    paymentId: { type: String },
    orderId: { type: String },
    paymentAmount: { type: Number },
    paymentCurrency: { type: String },
    paymentStatus: { type: String },
    paymentSignature: { type: String },
    paymentTimestamp: { type: Date },
    billingFrequency: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'restaurant_requests',
  }
);

// Optimize query performance for Super Admin listing
restaurantRequestSchema.index({ status: 1, submittedAt: -1 });
restaurantRequestSchema.index({ email: 1 });

export const RestaurantRequestModel =
  mongoose.models.RestaurantRequest ||
  mongoose.model<IRestaurantRequest>('RestaurantRequest', restaurantRequestSchema);

export function formatRestaurantRequest(req: any) {
  const city = req.city || '';
  const state = req.state || '';
  const country = req.country || '';
  const locationParts = [city, state, country].filter(Boolean);
  const location = locationParts.length > 0 ? locationParts.join(', ') : (req.address || 'Unknown Location');

  return {
    id: req._id ? req._id.toString() : req.id,
    name: req.restaurantName || req.name || '',
    owner: req.ownerName || req.owner || '',
    email: req.email || '',
    phone: req.phone || '',
    location,
    plan: req.selectedPlan || req.plan || (req.paymentId ? 'Paid Onboarding' : 'Free Onboarding'),
    requestedAt: req.submittedAt ? new Date(req.submittedAt).toISOString() : req.requestedAt || new Date().toISOString(),
    message: req.message ?? '',
    latitude: req.latitude,
    longitude: req.longitude,
    googleMapsUrl: req.googleMapsUrl ?? '',
    address: req.address || '',
    city: req.city || '',
    state: req.state || '',
    country: req.country || '',
    pinCode: req.pinCode || '',
    gstNumber: req.gstNumber ?? '',
    cuisine: req.cuisine || '',
    branches: typeof req.branches === 'number' ? req.branches : 1,
    expectedMonthlyOrders: typeof req.expectedMonthlyOrders === 'number' ? req.expectedMonthlyOrders : 0,
    isVeg: req.isVeg || 'both',
    coverImage: req.coverImage || undefined,
    paymentId: req.paymentId ?? '',
    paymentAmount: req.paymentAmount ?? 0,
    paymentStatus: req.paymentStatus ?? '',
    paymentSignature: req.paymentSignature ?? '',
    paymentTimestamp: req.paymentTimestamp ? new Date(req.paymentTimestamp).toISOString() : undefined,
    billingFrequency: req.billingFrequency ?? 'monthly',
    status: req.status || 'APPLICATION_PENDING',
    rejectionReason: req.rejectionReason ?? '',
  };
}
