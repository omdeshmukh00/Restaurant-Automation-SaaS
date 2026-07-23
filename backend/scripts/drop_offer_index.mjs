import mongoose from 'mongoose';

async function dropIndex() {
  // Use the same URI as configured - read from .env if available
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/restaurant-automation';
  console.log('Connecting to:', uri);
  
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const collections = await db.listCollections({ name: 'offers' }).toArray();
  
  if (collections.length === 0) {
    console.log('Offers collection does not exist yet');
    await mongoose.disconnect();
    return;
  }
  
  const indexes = await db.collection('offers').indexes();
  console.log('Current offers indexes:', JSON.stringify(indexes, null, 2));
  
  const uniqueIdx = indexes.find(i => i.name === 'restaurantId_1_promoCode_1' && i.unique === true);
  if (uniqueIdx) {
    await db.collection('offers').dropIndex('restaurantId_1_promoCode_1');
    console.log('SUCCESS: Dropped unique index restaurantId_1_promoCode_1');
  } else {
    console.log('Unique index not found — might already be dropped. Listing remaining:');
    indexes.forEach(i => console.log(`  - ${i.name} (unique: ${!!i.unique})`));
  }
  
  await mongoose.disconnect();
}

dropIndex().catch(e => { console.error(e); process.exit(1); });
