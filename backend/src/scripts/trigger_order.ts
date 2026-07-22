import mongoose from 'mongoose';
import { OrdersService } from '../modules/orders/orders.service';
import { TableSessionModel } from '../modules/tableSessions/tableSessions.model';
import { Cart } from '../modules/cart/cart.model';
import { config } from 'dotenv';
import path from 'path';

config({ path: path.resolve(__dirname, '../../.env') });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/restaurant_automation');
  console.log('Connected to DB');

  const session = await TableSessionModel.findOne({ status: 'ACTIVE' });
  if (!session) {
    console.log('No active session found.');
    process.exit(1);
  }

  let cart = await Cart.findOne({ sessionId: session._id });
  if (!cart) {
    cart = await Cart.create({
      restaurantId: session.restaurantId,
      sessionId: session._id,
      items: [],
      subtotal: 0,
      tax: 0,
      discount: 0,
      grandTotal: 0
    });
  }

  if (cart.items.length === 0) {
    const menuItem = await mongoose.model('MenuItem').findOne({ restaurantId: session.restaurantId });
    if (menuItem) {
      cart.items.push({
        menuItem: menuItem._id,
        quantity: 1,
        unitPrice: menuItem.price,
        subtotal: menuItem.price
      } as any);
      cart.subtotal = menuItem.price;
      cart.grandTotal = menuItem.price;
      await cart.save();
    } else {
      console.log('No menu items found for restaurant.');
      process.exit(1);
    }
  }

  console.log(`Triggering order for session ${session._id}...`);
  try {
    const order = await OrdersService.placeOrder(
      session.restaurantId,
      session._id,
      session.tableId,
      session.customerName,
      { specialInstructions: '' }
    );
    console.log('Order placed successfully:', order._id);
  } catch (err: any) {
    console.error('API Error caught in script:', err.message);
  }

  process.exit(0);
}

run();
