const mongoose = require('mongoose');
async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/RestaurantAutomation');
  const db = mongoose.connection.db;
  const billingsIndexes = await db.collection('billings').indexes();
  console.log('Billings Indexes:', JSON.stringify(billingsIndexes, null, 2));
  
  const paymentIndexes = await db.collection('payments').indexes();
  console.log('Payments Indexes:', JSON.stringify(paymentIndexes, null, 2));

  process.exit(0);
}
run().catch(console.error);
