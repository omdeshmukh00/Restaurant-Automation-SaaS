import { connectToDatabase, disconnectFromDatabase } from '../config/db';
import { UserModel } from '../modules/users/users.model';
import { UserRole } from '../constants/roles';
import { UserStatus } from '../constants/statuses';
import { hashPassword } from '../utils/crypto';

// Helper to parse CLI arguments like --email=admin@test.com or standard positional args
function parseArgs(): { name?: string; email?: string; mobile?: string; password?: string } {
  const args = process.argv.slice(2);
  const result: Record<string, string> = {};
  const positional: string[] = [];

  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, ...valParts] = arg.slice(2).split('=');
      result[key] = valParts.join('=');
    } else {
      positional.push(arg);
    }
  }

  return {
    name: result.name || process.env.SUPERADMIN_NAME || positional[0],
    email: result.email || process.env.SUPERADMIN_EMAIL || positional[1],
    mobile: result.mobile || process.env.SUPERADMIN_MOBILE || positional[2],
    password: result.password || process.env.SUPERADMIN_PASSWORD || positional[3],
  };
}

async function run(): Promise<void> {
  const input = parseArgs();

  const name = input.name || 'Platform Owner';
  const email = (input.email || 'adminsuper22@gmail.com').toLowerCase().trim();
  const mobile = (input.mobile || '4444444444').trim();
  const password = input.password || 'Super@123';

  console.log('\n==================================================');
  console.log('       SUPERADMIN TERMINAL SEEDING TOOL           ');
  console.log('==================================================');
  console.log(`Connecting to MongoDB...`);
  await connectToDatabase();

  console.log(`Seeding SuperAdmin User:`);
  console.log(` - Name    : ${name}`);
  console.log(` - Email   : ${email}`);
  console.log(` - Mobile  : ${mobile}`);
  console.log(` - Password: ${'*'.repeat(password.length)}`);

  const hashedPassword = await hashPassword(password);

  // Find if user already exists by email OR mobile to avoid E11000 duplicate key error
  let user = await UserModel.findOne({
    $or: [{ email }, { mobile }],
  });

  if (user) {
    user.name = name;
    user.email = email;
    user.mobile = mobile;
    user.password = hashedPassword;
    user.role = UserRole.SUPER_ADMIN;
    user.status = UserStatus.ACTIVE;
    user.isEmailVerified = true;
    user.isMobileVerified = true;
    user.isDeleted = false;
    user.deletedAt = undefined;
    await user.save();
  } else {
    user = await UserModel.create({
      name,
      email,
      mobile,
      password: hashedPassword,
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      isEmailVerified: true,
      isMobileVerified: true,
      isDeleted: false,
    });
  }

  console.log('\n✅ SuperAdmin user successfully registered/restored!');
  console.log(`   User ID : ${user._id}`);
  console.log(`   Email   : ${user.email}`);
  console.log(`   Mobile  : ${user.mobile}`);
  console.log(`   Role    : ${user.role}`);
  console.log(`   Status  : ${user.status}`);
  console.log('==================================================\n');

  await disconnectFromDatabase();
}

run()
  .then(() => {
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('\n❌ Failed to seed SuperAdmin user:', error);
    await disconnectFromDatabase();
    process.exit(1);
  });
