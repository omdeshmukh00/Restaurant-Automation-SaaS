/**
 * Script to find and fix garbled/encrypted customer names in the database.
 * These are base64-like strings that appear as customer names and render
 * as garbled text on the admin customers page.
 *
 * Run: MONGO_URI=mongodb://localhost:27017/restaurant-automation node backend/scripts/cleanup_garbled_names.mjs
 */

import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/restaurant-automation';

// Pattern to detect garbled/encrypted names:
// - Contains '+' or '/' (base64 encoding chars rarely in real names)
// - Contains '=' padding (base64 padding char never in real names)
// - Very long random-looking string with no proper word breaks
function isGarbledName(name) {
  if (!name || typeof name !== 'string') return false;
  if (name.length < 10) return false; // short names are fine

  // Base64 signatures: + / = characters not found in normal names
  const base64Chars = /[+\/=]/;
  if (base64Chars.test(name)) return true;

  // If name is very long (over 50 chars) and has no spaces, it's likely gibberish
  if (name.length > 50 && !name.includes(' ')) {
    // Check if it's mostly random letters and numbers
    const alphaOnly = name.replace(/[a-zA-Z0-9]/g, '').length;
    const ratio = alphaOnly / name.length;
    // If less than 5% are spaces/punctuation, likely garbage
    if (ratio < 0.05) return true;
  }

  // Check if name has a suspiciously high ratio of digits to letters
  const digits = (name.match(/\d/g) || []).length;
  const letters = (name.match(/[a-zA-Z]/g) || []).length;
  if (name.length > 20 && digits > letters * 0.5) return true;

  return false;
}

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const db = mongoose.connection.db;

  // 1. Check Users
  const users = await db.collection('users')
    .find({})
    .project({ _id: 1, name: 1, mobile: 1, email: 1 })
    .toArray();

  let fixedUsers = 0;
  let fixedProfiles = 0;

  for (const user of users) {
    if (isGarbledName(user.name)) {
      const displayName = user.email
        ? user.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, ' ').trim() || null
        : null;
      const newName = displayName || (user.mobile ? `Customer ${user.mobile.slice(-4)}` : 'Guest');

      // Cap at 50 chars
      const safeName = newName.slice(0, 50);

      await db.collection('users').updateOne(
        { _id: user._id },
        { $set: { name: safeName } }
      );
      console.log(`Fixed User ${user._id}: "${user.name.slice(0, 40)}..." \u2192 "${safeName}"`);
      fixedUsers++;
    }
  }

  // 2. Check CustomerProfiles
  const profiles = await db.collection('customerprofiles')
    .find({})
    .project({ _id: 1, name: 1, mobile: 1, email: 1 })
    .toArray();

  for (const profile of profiles) {
    if (isGarbledName(profile.name)) {
      const displayName = profile.email
        ? profile.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, ' ').trim() || null
        : null;
      const newName = displayName || (profile.mobile ? `Customer ${profile.mobile.slice(-4)}` : 'Guest');
      const safeName = newName.slice(0, 50);

      await db.collection('customerprofiles').updateOne(
        { _id: profile._id },
        { $set: { name: safeName } }
      );
      console.log(`Fixed CustomerProfile ${profile._id}: "${profile.name.slice(0, 40)}..." \u2192 "${safeName}"`);
      fixedProfiles++;
    }
  }

  console.log(`\nDone! Fixed ${fixedUsers} users and ${fixedProfiles} customer profiles.`);

  await mongoose.disconnect();
}

main().catch(console.error);
