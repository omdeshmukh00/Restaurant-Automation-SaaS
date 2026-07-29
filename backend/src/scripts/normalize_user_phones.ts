import mongoose from 'mongoose';
import { env } from '../config/env';
import { UserModel } from '../modules/users/users.model';
import { CustomerProfileModel } from '../modules/analytics/customerProfile.model';
import { normalizeMobile } from '../utils/crypto';

async function run() {
  try {
    await mongoose.connect(env.MONGODB_URI);
    console.log('Connected to MongoDB for phone normalization script');

    // 1. Normalize User mobile numbers
    const users = await UserModel.find({}).setOptions({ bypassTenant: true });
    console.log(`Processing ${users.length} users...`);

    const mobileMap = new Map<string, typeof users>();

    for (const user of users) {
      const normalized = normalizeMobile(user.mobile);
      if (normalized && user.mobile !== normalized) {
        console.log(`Normalizing user ${user._id} mobile: ${user.mobile} -> ${normalized}`);
      }
      if (normalized) {
        if (!mobileMap.has(normalized)) {
          mobileMap.set(normalized, []);
        }
        mobileMap.get(normalized)!.push(user);
      }
    }

    // Identify and merge duplicates where normalized mobile is identical
    for (const [mobile, userGroup] of mobileMap.entries()) {
      if (userGroup.length > 1) {
        console.log(`Found ${userGroup.length} duplicate users for mobile ${mobile}:`, userGroup.map((u) => u._id.toString()));
        // Keep the oldest or password-enabled user as primary
        const sorted = userGroup.sort((a, b) => {
          if (a.password && !b.password) return -1;
          if (!a.password && b.password) return 1;
          return a.createdAt.getTime() - b.createdAt.getTime();
        });

        const primary = sorted[0];
        const duplicates = sorted.slice(1);

        // Deactivate duplicate users first to free up the normalized mobile key
        for (const dup of duplicates) {
          dup.isDeleted = true;
          dup.deletedAt = new Date();
          dup.mobile = `dup_${Date.now()}_${dup._id.toString()}`;
          dup.email = dup.email ? `dup_${Date.now()}_${dup.email}` : (undefined as any);
          dup.refreshTokens = [];
          await dup.save();
          console.log(`Deactivated duplicate user ${dup._id}`);
        }

        // Now safely normalize primary
        primary.mobile = mobile;
        await primary.save();
      } else {
        const user = userGroup[0];
        if (user.mobile !== mobile) {
          user.mobile = mobile;
          await user.save();
        }
      }
    }

    // 2. Normalize CustomerProfile mobile numbers
    const profiles = await CustomerProfileModel.find({}).setOptions({ bypassTenant: true });
    console.log(`Processing ${profiles.length} customer profiles...`);

    for (const profile of profiles) {
      const normalized = normalizeMobile(profile.mobile);
      if (normalized && profile.mobile !== normalized) {
        console.log(`Normalizing profile ${profile._id} mobile: ${profile.mobile} -> ${normalized}`);
        profile.mobile = normalized;
        try {
          await profile.save();
        } catch (err: any) {
          if (err.code === 11000) {
            console.log(`Duplicate profile found for mobile ${normalized}, removing duplicate ${profile._id}`);
            await CustomerProfileModel.deleteOne({ _id: profile._id }).setOptions({ bypassTenant: true });
          } else {
            throw err;
          }
        }
      }
    }

    console.log('Phone normalization migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

run();
