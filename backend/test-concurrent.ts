import mongoose from 'mongoose';
import { env } from './src/config/env';
import { PaymentModel } from './src/modules/payments/payments.model';
import { PaymentsService } from './src/modules/payments/payments.service';
import { PaymentStatus } from './src/constants/statuses';

async function run() {
  await mongoose.connect(env.MONGODB_URI);
  console.log('Connected');
  
  // Try calling verifyCustomerPayment twice concurrently
  const restaurantId = new mongoose.Types.ObjectId().toString();
  const sessionId = new mongoose.Types.ObjectId().toString();
  
  // We need a real payment to test
  const p = new PaymentModel({
    restaurantId,
    sessionId,
    amount: 100,
    method: 'ONLINE',
    provider: 'razorpay'
  });
  await p.save();
  
  const paymentId = p._id.toString();
  
  const razorpayFields = {
    razorpay_order_id: 'order_123',
    razorpay_payment_id: 'pay_123',
    razorpay_signature: 'sig_123'
  };

  console.log('Starting concurrent requests');
  
  const p1 = PaymentsService.verifyCustomerPayment(restaurantId, sessionId, paymentId, 'PAID', undefined);
  
  // Simulate webhook
  const p2 = (async () => {
    p.razorpayPaymentId = 'pay_123';
    p.providerPaymentId = 'pay_123';
    p.status = PaymentStatus.COMPLETED as any;
    await p.save();
    console.log('Webhook saved payment');
  })();
  
  try {
    const results = await Promise.all([p1, p2]);
    console.log('Results:', results);
  } catch (err) {
    console.error('Error caught in outer:', err);
  }
  
  await mongoose.disconnect();
}

run();
