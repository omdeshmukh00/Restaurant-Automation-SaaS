// backend/scratch/smtp_test.js
const nodemailer = require('nodemailer');
const path = require('path');
const dotenv = require('dotenv');

const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

console.log('Testing SMTP connection with the following config:');
console.log({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  user: process.env.SMTP_USER,
  passLength: process.env.SMTP_PASS ? process.env.SMTP_PASS.length : 0,
});

async function testPassword(label, user, pass) {
  console.log(`\nTesting [${label}] - User: ${user}, Pass Length: ${pass ? pass.length : 0}`);
  
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    auth: {
      user: user,
      pass: pass,
    },
  });

  try {
    await transporter.verify();
    console.log(`✅ Success! SMTP verified for [${label}]`);
  } catch (error) {
    console.error(`❌ Failed for [${label}]:`, error.message);
  }
}

async function runTest() {
  const user = 'heavydriver2030@gmail.com';
  
  // Test current password
  await testPassword('current_password', user, 'bbtwjeyufvfoltoo');
  
  // Test previous password (without space)
  await testPassword('previous_password_no_space', user, 'htybvzycqhsiglch');
  
  // Test previous password (with space)
  await testPassword('previous_password_with_space', user, 'htybvzycqhsiglch ');
}

runTest();
