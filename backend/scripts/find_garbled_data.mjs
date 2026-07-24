import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('MONGO_URI env required');
  process.exit(1);
}

async function main() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;

  // Check ALL collections for fields that look like base64 garbled text
  const collections = await db.listCollections().toArray();

  for (const colInfo of collections) {
    const name = colInfo.name;
    if (name.startsWith('system.')) continue;

    const col = db.collection(name);
    const sample = await col.findOne();

    if (!sample) continue;

    // Check all string fields in the document
    for (const [key, value] of Object.entries(sample)) {
      if (typeof value === 'string' && value.length > 20) {
        // Check for base64 chars
        if (/[+\/=]/.test(value)) {
          const count = await col.countDocuments({ [key]: /[+\/=]/ });
          if (count > 0) {
            const examples = await col.find({ [key]: /[+\/=]/ })
              .project({ [key]: 1, mobile: 1, email: 1 })
              .limit(3)
              .toArray();
            console.log(`\nFound ${count} docs in "${name}"."${key}" with base64 chars:`);
            for (const ex of examples) {
              console.log(`  ${ex._id}: "${String(ex[key]).substring(0, 60)}..."`);
            }
          }
        }
      }
    }
  }

  // Also check long strings with no spaces
  for (const colInfo of collections) {
    const name = colInfo.name;
    if (name.startsWith('system.')) continue;

    const col = db.collection(name);
    const sample = await col.findOne();

    if (!sample) continue;

    for (const [key, value] of Object.entries(sample)) {
      if (typeof value === 'string' && value.length > 40 && !value.includes(' ')) {
        // Count how many have this pattern
        const cursor = col.find({ [key]: { $regex: /^[A-Za-z0-9+/=]{40,}$/ } });
        const count = await cursor.count();
        if (count > 0) {
          const examples = await col.find({ [key]: { $regex: /^[A-Za-z0-9+/=]{40,}$/ } })
            .project({ [key]: 1, mobile: 1, email: 1 })
            .limit(3)
            .toArray();
          console.log(`\nFound ${count} docs in "${name}"."${key}" with long alphanumeric strings:`);
          for (const ex of examples) {
            console.log(`  ${ex._id}: "${String(ex[key]).substring(0, 60)}..."`);
          }
        }
      }
    }
  }

  await mongoose.disconnect();
}

main().catch(console.error);
