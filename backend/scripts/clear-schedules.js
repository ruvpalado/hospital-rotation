require('dotenv').config();
/**
 * One-off cleanup: deletes every rotation schedule record (change requests,
 * rotation weeks, then rotation assignments) WITHOUT touching anything else
 * -- roles, sites, departments, users, curriculum blocks, notifications, and
 * audit logs are left exactly as they are. Safe to run against the live
 * production database; unlike `npm run seed`, this does NOT drop/recreate
 * tables.
 *
 * Usage (from the backend/ directory): npm run clear-schedules
 */
const { sequelize, ChangeRequest, RotationWeek, RotationAssignment } = require('../models');

async function run() {
  const changeRequestCount = await ChangeRequest.destroy({ where: {} });
  const weekCount = await RotationWeek.destroy({ where: {} });
  const assignmentCount = await RotationAssignment.destroy({ where: {} });

  console.log('Schedule sample data removed:');
  console.log(`  Change requests deleted:    ${changeRequestCount}`);
  console.log(`  Rotation weeks deleted:     ${weekCount}`);
  console.log(`  Rotation assignments deleted: ${assignmentCount}`);
  console.log('Roles, sites, departments, users, blocks, notifications, and audit logs were not touched.');

  await sequelize.close();
}

run().catch((err) => {
  console.error('Failed to clear schedule data:', err);
  process.exit(1);
});
