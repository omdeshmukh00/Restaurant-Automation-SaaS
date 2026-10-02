const mongoose = require('mongoose');

async function run() {
  const uri = process.env.MONGODB_URI || 'mongodb+srv://graphuratestingdb.v2gcmi8.mongodb.net/RestaurantAutomation';
  await mongoose.connect(uri);
  
  const { RestaurantRequestModel } = require('./src/modules/superAdmin/restaurantRequest.model');
  
  const results = await RestaurantRequestModel.find({
    status: { $in: ['APPLICATION_PENDING', 'APPLICATION_APPROVED', 'REJECTED', 'PENDING_PAYMENT'] }
  }).lean();
  
  console.log('Found:', results.length);
  results.forEach(r => console.log(r._id.toString(), r.status, r.restaurantName));
  
  await mongoose.disconnect();
}

run().catch(e => { console.error(e.message); process.exit(1); });
