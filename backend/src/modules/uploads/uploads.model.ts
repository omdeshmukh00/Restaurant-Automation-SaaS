import mongoose, { Document, Schema, Types } from 'mongoose';


export interface IUpload extends Document {
  tenantId: Types.ObjectId;
  originalName: string;
  fileName: string;
  mimeType: string;
  size: number;
  provider: 'local' | 's3';
  storageKey: string;
  checksum?: string;
  uploadedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}



const UploadSchema = new Schema<IUpload>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
    originalName: { type: String, required: true, trim: true },
    fileName: { type: String, required: true, trim: true },
    mimeType: { type: String, required: true, trim: true },
    size: { type: Number, required: true, min: 0 },
    provider: { type: String, enum: ['local', 's3'], required: true },
    storageKey: { type: String, required: true },
    checksum: { type: String, trim: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, collection: 'uploads' },
);

UploadSchema.index({ tenantId: 1, createdAt: -1 });
UploadSchema.index({ tenantId: 1, _id: 1 });





export const UploadModel = mongoose.model<IUpload>('Upload', UploadSchema);