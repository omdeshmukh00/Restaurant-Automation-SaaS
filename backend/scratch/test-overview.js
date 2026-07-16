const jwt = require('jsonwebtoken');
const http = require('http');

const JWT_SECRET = '753192ff4f179400841ff6244e7014b6a3804fef6e7e3211eae616ff5a633e20';

const payload = {
  _id: '6a58ee855bba9ea19ef3737d', // superadmin user id or dummy
  email: 'adminsuper22@gmail.com',
  role: 'super-admin',
  panel: 'superadmin',
  tenantId: null,
  restaurantId: null,
};

const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
console.log('Generated Superadmin token:', token);

const start = Date.now();
const req = http.request(
  {
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/superadmin/transactions',
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  },
  (res) => {
    console.log('Status code:', res.statusCode);
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      console.log('Execution time:', Date.now() - start, 'ms');
      console.log('Response body:', data.slice(0, 1000));
    });
  }
);

req.on('error', (e) => {
  console.error('Request failed:', e);
});

req.end();
