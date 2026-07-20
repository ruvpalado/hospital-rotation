require('dotenv').config();
/**
 * One-off cleanup: deletes ALL user and organizational data -- users, roles,
 * sites, departments, site-department links, notifications, audit logs,
 * change requests, and every rotation schedule record (rotation weeks and
 * rotation assignments) -- while leaving the 13 curriculum blocks
 * (Sept 2026 - Aug 2027) completely untouched.
 *
 * Deletion order respects foreign key constraints:
 *   1. User          (references Role, Site, Department)
 *   2. Role
 *   3. Site
 *   4. SiteDepartment (references Site, Department)
 *   5. Department
 *   6. Notification   (references User)
 *   7. AuditLog       (references User)
 *   8. ChangeRequest  (references RotationAssignment, User)
 *   9. RotationWeek   (references RotationAssignment)
 *  10. RotationAssignment (references Block, User, SiteDepartment)
 *
 * Block records are never touched by this script.
 *
 * Usage (from the backend/ directory): npm run clear-all-user-data
 */
const {
  sequelize,
  Role,
  User,
  Site,
  Department,
  SiteDepartment,
  Block,
  Notification,
  AuditLog,
  ChangeRequest,
  RotationWeek,
  RotationAssignment,
} = require('../models');

async function run() {
  const blockCountBefore = await Block.count();

  const userCount = await User.destroy({ where: {} });
  const roleCount = await Role.destroy({ where: {} });
  const siteCount = await Site.destroy({ where: {} });
  const siteDepartmentCount = await SiteDepartment.destroy({ where: {} });
  const departmentCount = await Department.destroy({ where: {} });
  const notificationCount = await Notification.destroy({ where: {} });
  const auditLogCount = await AuditLog.destroy({ where: {} });
  const changeRequestCount = await ChangeRequest.destroy({ where: {} });
  const rotationWeekCount = await RotationWeek.destroy({ where: {} });
  const rotationAssignmentCount = await RotationAssignment.destroy({ where: {} });

  const blockCountAfter = await Block.count();

  console.log('All user/organizational data removed:');
  console.log(`  Users deleted:                ${userCount}`);
  console.log(`  Roles deleted:                ${roleCount}`);
  console.log(`  Sites deleted:                ${siteCount}`);
  console.log(`  Site-department links deleted: ${siteDepartmentCount}`);
  console.log(`  Departments deleted:          ${departmentCount}`);
  console.log(`  Notifications deleted:        ${notificationCount}`);
  console.log(`  Audit logs deleted:           ${auditLogCount}`);
  console.log(`  Change requests deleted:      ${changeRequestCount}`);
  console.log(`  Rotation weeks deleted:       ${rotationWeekCount}`);
  console.log(`  Rotation assignments deleted: ${rotationAssignmentCount}`);

  if (blockCountBefore === blockCountAfter) {
    console.log(`Blocks were NOT touched. Curriculum blocks remain intact: ${blockCountAfter} block(s).`);
  } else {
    console.warn(
      `WARNING: Block count changed from ${blockCountBefore} to ${blockCountAfter}. Blocks should never be modified by this script.`
    );
  }

  await sequelize.close();
}

run().catch(async (err) => {
  console.error('Failed to clear user data:', err);
  try {
    await sequelize.close();
  } catch (closeErr) {
    console.error('Failed to close database connection:', closeErr);
  }
  process.exit(1);
});
