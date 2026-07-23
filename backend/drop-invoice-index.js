const mongoose = require('mongoose');
async function run() {
  await mongoose.connect('mongodb+srv://graphuratestingDB:FChgN9ZIZBi5ItdK@graphuratestingdb.v2gcmi8.mongodb.net/RestaurantAutomation?retryWrites=true&w=majority');
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
