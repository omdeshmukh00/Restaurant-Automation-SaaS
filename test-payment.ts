import axios from 'axios';
async function test() {
  try {
    const api = axios.create({ baseURL: 'http://localhost:5000/api/v1' });
    const { data: s } = await api.post('/public/qr/scan', { restaurantId: '6a4a0a6233639ea0eb5548c2', tableId: '6a4a0a6233639ea0eb5548c6', customerName: 'Test', mobile: '9999999999' });
    console.log('Got response', s);
    const customerToken = s.data.accessToken; // Wait, it might be accessToken!
    api.defaults.headers.common['Authorization'] = 'Bearer ' + customerToken;
    const sessionId = s.data.session.id;
    console.log('Session created', sessionId);
    
    await api.post('/customer/cart/items', { menuItemId: '6a4b1b6233639ea0eb5548c2', quantity: 1, customInstructions: '' });
    console.log('Added to cart');
    
    await api.post('/customer/orders', { notes: '' });
    console.log('Order placed');

    const { data: p } = await api.post('/payments/customer/create', { method: 'ONLINE' });
    console.log('Payment created', p.data.payment.id);

    const { data: v } = await api.post('/payments/customer/verify', { 
        restaurantId: '6a4a0a6233639ea0eb5548c2',
        sessionId: sessionId,
        paymentId: p.data.payment.id,
        simulateStatus: 'success'
    });
    console.log('Verified', v.data);
  } catch(e: any) {
    console.error('Failed', e.response?.data || e.message);
    if (e.response?.data) console.error(JSON.stringify(e.response.data, null, 2));
  }
}
test();
