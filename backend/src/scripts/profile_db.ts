import { PlatformPlanModel } from '../modules/superAdmin/superAdmin.model';
import { connectToDatabase, disconnectFromDatabase } from '../config/db';

async function test() {
  console.log('Connecting to database...');
  await connectToDatabase();
  console.log('Connected!');

  console.log('Running query: PlatformPlanModel.find()...');
  const t0 = Date.now();
  const plans = await PlatformPlanModel.find().sort({ priceMonthly: 1 }).lean();
  const t1 = Date.now();
  console.log(`Query completed in ${t1 - t0}ms. Count: ${plans.length}`);

  console.log('Running query: PlatformPlanModel.find({ isActive: { $ne: false } })...');
  const t2 = Date.now();
  const activePlans = await PlatformPlanModel.find({ isActive: { $ne: false } }).sort({ priceMonthly: 1 }).lean();
  const t3 = Date.now();
  console.log(`Query completed in ${t3 - t2}ms. Count: ${activePlans.length}`);

  await disconnectFromDatabase();
}

test().catch(console.error);
