import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IKitchenJoinee extends Document {
  restaurantId: Types.ObjectId;
  name: string;
  role: string;
  email: string;
  phone: string;
  status: 'pending' | 'approved' | 'rejected';
  appliedDate: Date;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
}

const kitchenJoineeSchema = new Schema<IKitchenJoinee>(
  {
    restaurantId: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
    name: { type: String, required: true },
    role: { type: String, required: true },
    email: { type: String, required: true, lowercase: true },
    phone: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    appliedDate: { type: Date, default: Date.now },
    avatar: { type: String },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'kitchenJoinees',
  }
);

export const KitchenJoineeModel = mongoose.models.KitchenJoinee || mongoose.model<IKitchenJoinee>('KitchenJoinee', kitchenJoineeSchema);
