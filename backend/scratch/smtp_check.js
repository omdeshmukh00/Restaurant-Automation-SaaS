// backend/scratch/smtp_check.js
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

console.log('--- Checking dotenv loading ---');
const envPath = path.resolve(__dirname, '../.env');
console.log('Resolving .env path:', envPath);
console.log('.env file exists:', fs.existsSync(envPath));

// Read raw file line to inspect trailing spaces
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  const lines = content.split('\n');
  const passLine = lines.find(line => line.startsWith('SMTP_PASS='));
  if (passLine) {
    console.log('Raw SMTP_PASS line in .env:', JSON.stringify(passLine));
    const passValue = passLine.split('=')[1] || '';
    console.log('Raw SMTP_PASS value length:', passValue.length);
    console.log('Raw SMTP_PASS charCodes:', Array.from(passValue).map(c => c.charCodeAt(0)));
    console.log('Raw SMTP_PASS ends with space:', passValue.endsWith(' '));
    console.log('Raw SMTP_PASS ends with carriage return:', passValue.endsWith('\r'));
  }
}

// Load env using dotenv
dotenv.config({ path: envPath });

console.log('\n--- Checking process.env values ---');
console.log('SMTP_HOST:', process.env.SMTP_HOST);
console.log('SMTP_PORT:', process.env.SMTP_PORT);
console.log('SMTP_USER:', process.env.SMTP_USER);
const pass = process.env.SMTP_PASS;
if (pass) {
  console.log('SMTP_PASS length:', pass.length);
  console.log('SMTP_PASS charCodes:', Array.from(pass).map(c => c.charCodeAt(0)));
} else {
  console.log('SMTP_PASS is not defined in process.env');
}
console.log('SMTP_FROM:', process.env.SMTP_FROM);

// Now load env.ts to see if Zod strips/validates it
console.log('\n--- Checking Zod schema validation ---');
try {
  // Use dynamic import or require
  const { env } = require('../dist/config/env');
  console.log('env.SMTP_HOST from env.ts:', env.SMTP_HOST);
  console.log('env.SMTP_PORT from env.ts:', env.SMTP_PORT);
  console.log('env.SMTP_USER from env.ts:', env.SMTP_USER);
  if (env.SMTP_PASS) {
    console.log('env.SMTP_PASS length from env.ts:', env.SMTP_PASS.length);
    console.log('env.SMTP_PASS charCodes from env.ts:', Array.from(env.SMTP_PASS).map(c => c.charCodeAt(0)));
  } else {
    console.log('env.SMTP_PASS is undefined in env.ts');
  }
} catch (e) {
  console.log('Could not load compiled env.ts (is dist built?):', e.message);
}
