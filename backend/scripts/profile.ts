import mongoose from 'mongoose';
import { env } from 'c:/Users/harsh/Restaurant-automation-Saas/backend/src/config/env';
import { OrderModel } from 'c:/Users/harsh/Restaurant-automation-Saas/backend/src/modules/orders/orders.model';
import { PaymentModel } from 'c:/Users/harsh/Restaurant-automation-Saas/backend/src/modules/payments/payments.model';
import { BillingModel } from 'c:/Users/harsh/Restaurant-automation-Saas/backend/src/modules/billing/billing.model';

async function profile() {
  await mongoose.connect(env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const restaurantId = new mongoose.Types.ObjectId().toString(); // Use a dummy ID for explain
  const sessionId = new mongoose.Types.ObjectId().toString();

  console.log('--- Profiling OrderModel ---');
  const orderExplain: any = await OrderModel.find({ restaurantId, sessionId, status: { $ne: 'CANCELLED' } }).explain('executionStats');
  console.log('Order Index Used:', orderExplain[0]?.queryPlanner?.winningPlan?.inputStage?.indexName || orderExplain[0]?.queryPlanner?.winningPlan?.indexName || orderExplain.queryPlanner?.winningPlan?.inputStage?.indexName || 'COLLSCAN');

  console.log('--- Profiling PaymentModel ---');
  const paymentExplain: any = await PaymentModel.find({ restaurantId, sessionId, status: 'COMPLETED' }).explain('executionStats');
  console.log('Payment Index Used:', paymentExplain[0]?.queryPlanner?.winningPlan?.inputStage?.indexName || paymentExplain[0]?.queryPlanner?.winningPlan?.indexName || paymentExplain.queryPlanner?.winningPlan?.inputStage?.indexName || 'COLLSCAN');

  console.log('--- Profiling BillingModel ---');
  const billExplain: any = await BillingModel.find({ restaurantId, sessionId }).explain('executionStats');
  console.log('Billing Index Used:', billExplain[0]?.queryPlanner?.winningPlan?.inputStage?.indexName || billExplain[0]?.queryPlanner?.winningPlan?.indexName || billExplain.queryPlanner?.winningPlan?.inputStage?.indexName || 'COLLSCAN');

  await mongoose.disconnect();
}

profile().catch(console.error);
