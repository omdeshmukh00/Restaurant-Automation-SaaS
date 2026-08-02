const mongoose = require('mongoose');
async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/RestaurantAutomation');
  const db = mongoose.connection.db;
  try {
    await db.collection('bills').dropIndex('restaurantId_1_invoiceNumber_1');
    console.log('Successfully dropped index restaurantId_1_invoiceNumber_1');
  } catch (err) {
    console.error('Error dropping index:', err.message);
  }
  process.exit(0);
}
run().catch(console.error);
