import mongoose, { Document, Schema, Types } from 'mongoose';
import { ReservationStatus } from '../../constants/statuses';

export enum NotificationPreference {
  NONE = 'NONE',
  SMS = 'SMS',
  WHATSAPP = 'WHATSAPP'
}

export interface IReservation extends Document {
  restaurantId: Types.ObjectId;
  customerProfileId?: Types.ObjectId | null;
  customerName: string;
  customerEmail?: string;
  mobile: string;
  guests: number;
  date: string;
  slot: string;
  status: ReservationStatus;
  tableId?: Types.ObjectId | null;

  // Conflict prevention — ensures a table can only be reserved once per slot
  // The compound index { restaurantId, tableId, date, slot } enforces uniqueness
  // so the DB itself rejects overlapping reservations for the same table.
  tableSlotLock?: string | null; // e.g. "tableId_date_slot" — unique key for atomic conflict detection

  notes?: string;
  occasion?: string;
  preferredArea?: string | null;
  sessionId?: Types.ObjectId | null;

  // Reservation lifecycle timing fields
  reservedAt?: Date | null;            // When the table was auto-reserved at slot start time
  reservationExpiresAt?: Date | null;  // When the reservation auto-expires (30 min after slot start)
  noShowProcessedAt?: Date | null;     // When the no-show was processed by the cron job
  arrivedAt?: Date | null;            // When the customer arrived (staff marks them)

  notificationPreference: NotificationPreference;
  notificationSentAt?: Date | null;
  lastNotificationType?: string | null;
  notificationFailureReason?: string | null;
  reminderSent: boolean;
  reminderSentAt?: Date | null;
  reminderFailureReason?: string | null;
  messageStatus?: string | null;
  messageProvider?: string | null;
  deliveredAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const reservationSchema = new Schema<IReservation>(
  {
    restaurantId: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
    customerProfileId: { type: Schema.Types.ObjectId, ref: 'CustomerProfile', default: null, index: true },
    customerName: { type: String, required: true, trim: true },
    customerEmail: { type: String, trim: true },
    mobile: { type: String, required: true, trim: true },
    guests: { type: Number, required: true, min: 1 },
    date: { type: String, required: true, trim: true },
    slot: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: Object.values(ReservationStatus),
      default: ReservationStatus.PENDING,
    },
    tableId: { type: Schema.Types.ObjectId, ref: 'Table', default: null },

    // Conflict prevention: unique compound key for table+date+slot
    tableSlotLock: { type: String, default: null, unique: true, sparse: true },

    notes: { type: String, trim: true },
    occasion: { type: String, trim: true, default: null },
    preferredArea: { type: String, trim: true, default: null },
    sessionId: { type: Schema.Types.ObjectId, ref: 'TableSession', default: null, index: true },

    // Auto-expiry / no-show
    reservationExpiresAt: { type: Date, default: null },
    noShowProcessedAt: { type: Date, default: null },
    arrivedAt: { type: Date, default: null },

    reservedAt: { type: Date, default: null },
    notificationPreference: {
      type: String,
      enum: Object.values(NotificationPreference),
      default: NotificationPreference.NONE
    },
    notificationSentAt: { type: Date, default: null },
    lastNotificationType: { type: String, default: null },
    notificationFailureReason: { type: String, default: null },
    reminderSent: { type: Boolean, default: false },
    reminderSentAt: { type: Date, default: null },
    reminderFailureReason: { type: String, default: null },
    messageStatus: { type: String, default: null },
    messageProvider: { type: String, default: null },
    deliveredAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'reservations',
  },
);

// Compound index for fast lookups by restaurant + date + slot
reservationSchema.index({ restaurantId: 1, date: 1, slot: 1 });
reservationSchema.index({ restaurantId: 1, status: 1 });
reservationSchema.index({ restaurantId: 1, mobile: 1 });

// Index for the no-show expiry cron job: find expired reservations fast
reservationSchema.index({ reservationExpiresAt: 1, status: 1 });

export const ReservationModel = mongoose.model<IReservation>('Reservation', reservationSchema);
