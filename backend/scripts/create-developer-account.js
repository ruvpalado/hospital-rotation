require('dotenv').config();
/**
 * One-off provisioning: ensures the developer account (ruvpalado@gmail.com)
 * exists on whatever database this connects to, with the 'admin' role and
 * approval_status already 'approved' -- bypassing the normal self-registration
 * pending-approval flow, which is otherwise a chicken-and-egg problem for this
 * specific account (see backend/controllers/userController.js: only
 * ruvpalado@gmail.com itself can approve an admin-role registration, but it
 * can't log in to approve its own first-ever registration on a fresh
 * database).
 *
 * Idempotent: if the account already exists, its password/role/approval
 * status/active flag are reset to the values below rather than creating a
 * duplicate. Does not touch any other user account or reference data.
 *
 * Usage (from the backend/ directory): node scripts/create-developer-account.js
 */
const bcrypt = require('bcryptjs');
const { sequelize, User, Role } = require('../models');

const DEVELOPER_EMAIL = 'ruvpalado@gmail.com';
const DEVELOPER_PASSWORD = 'DevAccess#2026!';

async function run() {
  const adminRole = await Role.findOne({ where: { key: 'admin' } });
  if (!adminRole) {
    throw new Error("'admin' role not found -- run the seed script first.");
  }

  const password_hash = await bcrypt.hash(DEVELOPER_PASSWORD, 10);
  const [user, created] = await User.findOrCreate({
    where: { email: DEVELOPER_EMAIL },
    defaults: {
      full_name: 'Ruel Palado (Developer)',
      email: DEVELOPER_EMAIL,
      password_hash,
      role_id: adminRole.id,
      language_pref: 'en',
      is_active: true,
      approval_status: 'approved',
    },
  });

  if (!created) {
    user.password_hash = password_hash;
    user.role_id = adminRole.id;
    user.is_active = true;
    user.approval_status = 'approved';
    await user.save();
  }

  console.log(created ? 'Developer account created.' : 'Developer account already existed -- reset to a known-good state.');
  console.log(`  Email:    ${DEVELOPER_EMAIL}`);
  console.log(`  Password: ${DEVELOPER_PASSWORD}`);
  console.log('  Role:     admin (approved, active)');

  await sequelize.close();
}

run().catch((err) => {
  console.error('Failed to provision developer account:', err);
  process.exit(1);
});
