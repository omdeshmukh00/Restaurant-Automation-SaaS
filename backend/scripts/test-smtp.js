const nodemailer = require('nodemailer');
require('dotenv').config();

async function testSmtp() {
  console.log('Testing SMTP connection with settings:');
  console.log('Host:', process.env.SMTP_HOST || 'smtp.gmail.com');
  console.log('Port:', process.env.SMTP_PORT || 587);
  console.log('User:', process.env.SMTP_USER);

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  try {
    await transporter.verify();
    console.log('✅ SMTP Connection Verified Successfully! Ready to send emails.');
  } catch (err) {
    console.error('❌ SMTP Connection Failed:', err.message);
  }
}

testSmtp();
