import { RestaurantModel } from '../modules/restaurants/restaurants.model';
import { connectToDatabase, disconnectFromDatabase } from '../config/db';

async function update() {
  console.log('Connecting to database...');
  await connectToDatabase();
  console.log('Connected!');

  const restaurants = await RestaurantModel.find();
  console.log(`Found ${restaurants.length} restaurants. Starting updates...`);

  for (const r of restaurants) {
    let changed = false;
    if (r.revenue === undefined) {
      r.revenue = 0;
      changed = true;
    }
    if (!r.lastActive) {
      r.lastActive = r.createdAt || new Date();
      changed = true;
    }
    if (!r.joinedDate) {
      r.joinedDate = r.createdAt || new Date();
      changed = true;
    }
    if (!r.tags || r.tags.length === 0) {
      r.tags = ['New'];
      changed = true;
    }
    if (changed) {
      await r.save();
      console.log(`Updated restaurant: ${r.name} (${r._id})`);
    }
  }

  console.log('Update complete!');
  await disconnectFromDatabase();
}

update().catch(console.error);
