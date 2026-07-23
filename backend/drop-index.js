const mongoose = require('mongoose');
async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/restaurant-automation');
  const db = mongoose.connection.db;
  try {
    await db.collection('billings').dropIndex('restaurantId_1');
    console.log('Dropped index restaurantId_1');
  } catch (e) {
    console.log('Error dropping index:', e.message);
  }
  process.exit(0);
}
run().catch(console.error);
