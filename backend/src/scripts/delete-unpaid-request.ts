import dotenv from 'dotenv';
dotenv.config();

import { connectToDatabase, disconnectFromDatabase } from '../config/db';
import { RestaurantRequestModel } from '../modules/superAdmin/restaurantRequest.model';

async function run() {
  try {
    await connectToDatabase();
    console.log('Connected to DB.');

    const email = 'restauranttesting@mail.com';
    const result = await RestaurantRequestModel.deleteMany({ email: email.toLowerCase() }).setOptions({ bypassTenant: true });
    
    console.log(`Deleted ${result.deletedCount} request(s) for email: ${email}`);
  } catch (err) {
    console.error('Error deleting request:', err);
  } finally {
    await disconnectFromDatabase();
    process.exit(0);
  }
}

run();
