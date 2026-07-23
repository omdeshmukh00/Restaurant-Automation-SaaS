import { model } from 'mongoose';
import { IKitchenAlert, kitchenAlertSchema } from './kitchen-alert.schema';

export const KitchenAlertModel = model<IKitchenAlert>('KitchenAlert', kitchenAlertSchema);
