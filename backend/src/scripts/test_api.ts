import axios from 'axios';

async function test() {
  const email = 'adminsuper22@gmail.com';
  const password = 'Super@123';
  const baseUrl = 'http://localhost:5000/api/v1';

  console.log('Sending login request...');
  const t0 = Date.now();
  try {
    const loginRes = await axios.post(`${baseUrl}/auth/login`, {
      email,
      password,
      panel: 'superadmin'
    });
    const t1 = Date.now();
    console.log(`Login successful! Status: ${loginRes.status}, Duration: ${t1 - t0}ms`);
    
    const token = loginRes.data?.data?.accessToken;
    if (!token) {
      console.error('No access token received in login response:', JSON.stringify(loginRes.data));
      return;
    }

    console.log('\nSending GET /superadmin/plans request...');
    const t2 = Date.now();
    const plansRes = await axios.get(`${baseUrl}/superadmin/plans`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    const t3 = Date.now();
    console.log(`GET /superadmin/plans Status: ${plansRes.status}, Duration: ${t3 - t2}ms`);
    console.log('Plans response data:', JSON.stringify(plansRes.data, null, 2));

    console.log('\nSending GET /public/plans request...');
    const t4 = Date.now();
    const publicPlansRes = await axios.get(`${baseUrl}/public/plans`);
    const t5 = Date.now();
    console.log(`GET /public/plans Status: ${publicPlansRes.status}, Duration: ${t5 - t4}ms`);
    console.log(`Plans count: ${publicPlansRes.data?.data?.plans?.length || 0}`);

  } catch (error: any) {
    console.error('Error during API request:', error.response?.status, error.response?.data || error.message);
  }
}

test();
