import mongoose, { Document, Schema } from 'mongoose';
import { RestaurantStatus } from '../../constants/statuses';

type RestaurantSettings = {
  currency: string;
  taxRate: number;
  serviceChargeEnabled: boolean;
  sessionDurationMinutes: number;
  emailPreferences: {
    dailySalesReports: boolean;
    inventoryAlerts: boolean;
    staffNotifications: boolean;
  };
  branding?: {
    logo?: string;
    primaryColor?: string;
    secondaryColor?: string;
    footerText?: string;
    website?: string;
    supportEmail?: string;
    supportPhone?: string;
  };
  timezone: string;
  dateFormat: string;
  timeFormat: string;
  floors?: { name: string; number: number }[];
  sections?: string[];
  integrations?: Record<string, { connected: boolean }>;
  kitchenSettings?: {
    generalSettings?: any;
    notificationSettings?: any;
    displaySettings?: any;
    autoRules?: any;
    prepTimes?: any;
  };
};

export interface IRestaurant extends Document {
  slug: string;
  name: string;
  status: RestaurantStatus;
  plan?: string;
  cuisine: string;
  city: string;
  type: string;
  phone: string;
  address: string;
  rating: number;
  location_url?: string;
  settings: RestaurantSettings;
  ownerName: string;
  email: string;
  state: string;
  country: string;
  pinCode: string;
  gstNumber?: string;
  branches: number;
  expectedMonthlyOrders: number;
  latitude: number;
  longitude: number;
  googleMapsUrl?: string;
  billingCycle?: 'monthly' | 'yearly';
  onboardingRequestId?: mongoose.Types.ObjectId;
  adminUserId?: mongoose.Types.ObjectId;
  subscriptionId?: mongoose.Types.ObjectId | null;
  subscriptionPlan_id?: mongoose.Types.ObjectId | null;
  customCommissionRate?: number | null;
  blockReason?: string;
  revenue?: number;
  lastActive?: Date;
  tags?: string[];
  joinedDate?: Date;
  isDeleted?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const restaurantSettingsSchema = new Schema<RestaurantSettings>(
  {
    currency: { type: String, default: 'INR' },
    taxRate: { type: Number, default: 0.05, min: 0 },
    serviceChargeEnabled: { type: Boolean, default: true },
    sessionDurationMinutes: { type: Number, default: 90, min: 15 },
    emailPreferences: {
      type: {
        dailySalesReports: { type: Boolean, default: true },
        inventoryAlerts: { type: Boolean, default: true },
        staffNotifications: { type: Boolean, default: true },
      },
      default: () => ({
        dailySalesReports: true,
        inventoryAlerts: true,
        staffNotifications: true,
      }),
    },
    branding: {
      type: {
        logo: { type: String, trim: true },
        primaryColor: { type: String, trim: true },
        secondaryColor: { type: String, trim: true },
        footerText: { type: String, trim: true },
        website: { type: String, trim: true },
        supportEmail: { type: String, trim: true },
        supportPhone: { type: String, trim: true },
      },
      default: null,
    },
    timezone: { type: String, default: 'UTC' },
    dateFormat: { type: String, default: 'YYYY-MM-DD' },
    timeFormat: { type: String, default: 'HH:mm' },
    integrations: {
      type: Map,
      of: new Schema(
        {
          connected: { type: Boolean, default: false },
        },
        { _id: false },
      ),
      default: {},
    },
    floors: {
      type: [{
        name: { type: String, required: true },
        number: { type: Number, required: true },
      }],
      default: () => [
        { name: 'Floor 1', number: 1 },
        { name: 'Floor 2', number: 2 },
      ],
    },
    sections: {
      type: [String],
      default: () => ['Indoor', 'Outdoor', 'Bar', 'Private'],
    },
  },
  { _id: false },
);

const restaurantSchema = new Schema<IRestaurant>(
  {
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    name: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: Object.values(RestaurantStatus),
      default: RestaurantStatus.PENDING_APPROVAL,
    },
    plan: { type: String, trim: true },
    cuisine: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    type: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
    rating: { type: Number, default: 4.5, min: 0, max: 5 },
    ownerName: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    state: { type: String, trim: true },
    country: { type: String, trim: true },
    pinCode: { type: String, trim: true },
    gstNumber: { type: String, trim: true },
    branches: { type: Number, required: true, default: 1 },
    expectedMonthlyOrders: { type: Number, required: true, default: 0 },
    latitude: { type: Number, required: true, default: 0 },
    longitude: { type: Number, required: true, default: 0 },
    googleMapsUrl: { type: String, trim: true },
    billingCycle: { type: String, enum: ['monthly', 'yearly'] },
    onboardingRequestId: { type: Schema.Types.ObjectId, ref: 'RestaurantRequest' },
    adminUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    subscriptionId: { type: Schema.Types.ObjectId, ref: 'Subscription', default: null },
    subscriptionPlan_id: { type: Schema.Types.ObjectId, ref: 'PlatformPlan', default: null },
    customCommissionRate: { type: Number, min: 0, max: 100, default: null },
    blockReason: { type: String, default: null },
    revenue: { type: Number, default: 0 },
    lastActive: { type: Date, default: Date.now },
    tags: { type: [String], default: [] },
    joinedDate: { type: Date, default: Date.now },
    isDeleted: { type: Boolean, default: false, index: true },
    location_url: {
      type: String,
      trim: true,
      default: null,
    },
    settings: {
      type: restaurantSettingsSchema,
      default: () => ({
        currency: 'INR',
        taxRate: 0.05,
        serviceChargeEnabled: true,
        sessionDurationMinutes: 90,
        emailPreferences: {
          dailySalesReports: true,
          inventoryAlerts: true,
          staffNotifications: true,
        },
        branding: undefined,
        timezone: 'UTC',
        dateFormat: 'YYYY-MM-DD',
        timeFormat: 'HH:mm',
      }),
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'restaurants',
  },
);

restaurantSchema.index({ status: 1 });
restaurantSchema.index({ plan: 1 });

export const RestaurantModel = mongoose.model<IRestaurant>('Restaurant', restaurantSchema);