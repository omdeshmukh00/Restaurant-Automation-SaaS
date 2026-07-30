import mongoose, { Document, Schema, Types } from 'mongoose';

export type TicketCategory =
  | 'TECHNICAL'
  | 'BILLING'
  | 'FEATURE_REQUEST'
  | 'ACCOUNT'
  | 'ORDER_QUERY'
  | 'STAFF_QUERY'
  | 'OTHER';

export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type TicketStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'ESCALATED'
  | 'RESOLVED'
  | 'REJECTED'
  | 'CLOSED';

export type TicketTargetRole =
  | 'SUPER_ADMIN'
  | 'RESTAURANT_ADMIN'
  | 'STAFF'
  | 'KITCHEN'
  | 'CLEANING'
  | 'CUSTOMER';

export interface ITicketMessage {
  _id?: Types.ObjectId;
  senderId?: Types.ObjectId;
  senderName: string;
  senderRole: string; // 'RESTAURANT_ADMIN' | 'SUPER_ADMIN' | 'SUPPORT' | 'STAFF' | 'KITCHEN' | 'CLEANING' | 'CUSTOMER'
  message: string;
  attachments?: string[];
  status?: 'sent' | 'delivered' | 'seen';
  isDeleted?: boolean;
  deletedForEveryone?: boolean;
  createdAt: Date;
}

export interface ITicket extends Document {
  ticketId: string;
  restaurantId: Types.ObjectId;
  createdBy: Types.ObjectId;
  targetRole: TicketTargetRole;
  targetUser?: Types.ObjectId;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  description: string;
  rejectionReason?: string;
  escalatedTo?: string;
  escalationReason?: string;
  escalatedAt?: Date;
  messages: ITicketMessage[];
  attachments?: string[];
  isBlocked?: boolean;
  blockedBy?: string;
  lastRepliedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ticketMessageSchema = new Schema<ITicketMessage>(
  {
    senderId: { type: Schema.Types.ObjectId, ref: 'User' },
    senderName: { type: String, required: true },
    senderRole: { type: String, required: true, default: 'RESTAURANT_ADMIN' },
    message: { type: String, required: true, trim: true },
    attachments: [{ type: String }],
    status: { type: String, enum: ['sent', 'delivered', 'seen'], default: 'seen' },
    isDeleted: { type: Boolean, default: false },
    deletedForEveryone: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const ticketSchema = new Schema<ITicket>(
  {
    ticketId: { type: String, required: true, unique: true, index: true },
    restaurantId: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    targetRole: {
      type: String,
      enum: ['SUPER_ADMIN', 'RESTAURANT_ADMIN', 'STAFF', 'KITCHEN', 'CLEANING', 'CUSTOMER'],
      default: 'SUPER_ADMIN',
      index: true,
    },
    targetUser: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    subject: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ['TECHNICAL', 'BILLING', 'FEATURE_REQUEST', 'ACCOUNT', 'ORDER_QUERY', 'STAFF_QUERY', 'OTHER'],
      required: true,
      default: 'TECHNICAL',
    },
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      default: 'MEDIUM',
    },
    status: {
      type: String,
      enum: ['OPEN', 'IN_PROGRESS', 'ESCALATED', 'RESOLVED', 'REJECTED', 'CLOSED'],
      default: 'OPEN',
      index: true,
    },
    description: { type: String, required: true, trim: true },
    rejectionReason: { type: String, trim: true },
    escalatedTo: { type: String, trim: true },
    escalationReason: { type: String, trim: true },
    escalatedAt: { type: Date },
    messages: [ticketMessageSchema],
    attachments: [{ type: String }],
    isBlocked: { type: Boolean, default: false },
    blockedBy: { type: String, trim: true },
    lastRepliedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'tickets',
  }
);

ticketSchema.index({ restaurantId: 1, status: 1 });
ticketSchema.index({ restaurantId: 1, priority: 1 });
ticketSchema.index({ targetRole: 1, status: 1 });
ticketSchema.index({ targetUser: 1 });

export const TicketModel = mongoose.model<ITicket>('Ticket', ticketSchema);
