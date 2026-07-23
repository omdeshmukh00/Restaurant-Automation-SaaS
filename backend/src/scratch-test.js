const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const restaurantSchema = new mongoose.Schema({}, { strict: false, collection: 'restaurants' });
const Restaurant = mongoose.models.Restaurant || mongoose.model('Restaurant', restaurantSchema);

const menuItemSchema = new mongoose.Schema({
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant' }
}, { strict: false, collection: 'menuItems' });
const MenuItem = mongoose.models.MenuItem || mongoose.model('MenuItem', menuItemSchema);

async function test() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/RestaurantAutomation');
  console.log('Connected to DB');
  
  const dishes = await MenuItem.find().populate('restaurantId', 'name').limit(2).lean();
  console.log('Dishes:', JSON.stringify(dishes, null, 2));
  
  await mongoose.disconnect();
}

test().catch(console.error);
