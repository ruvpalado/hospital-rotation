const {
  sequelize, Role, User, Notification, ChangeRequest, RotationAssignment, RotationWeek, AuditLog,
} = require('../models');

/**
 * One-time / repeatable maintenance action: brings the live `roles` table up
 * to date with the current Role.js definition without touching any other
 * data. Needed because `key` is a MySQL ENUM column -- adding a new role
 * requires an ALTER TABLE, which a plain Role.create()/seed re-run can't do
 * on a live database without dropping everything (seed.js uses
 * sequelize.sync({ force: true })).
 *
 * Concretely, this:
 *   1. Widens the roles.key ENUM to include 'program_manager' and
 *      'hospital_admin' alongside the original four.
 *   2. Relabels the existing 'admin' role from "Hospital Administrator" to
 *      "Admin" -- the plain "site admin" concept has moved to the new
 *      'hospital_admin' role, so 'admin' (site-wide, full access) needed a
 *      label that doesn't collide with it.
 *   3. Ensures 'program_manager' ("Program Manager") and 'hospital_admin'
 *      ("Hospital Administrator") rows exist, creating them if missing.
 * Safe to call more than once -- every step is idempotent.
 */
exports.syncRoles = async (req, res) => {
  try {
    await sequelize.query(
      "ALTER TABLE roles MODIFY COLUMN `key` ENUM('admin','scheduler','dept_head','physician','program_manager','hospital_admin') NOT NULL"
    );

    await Role.update({ label: 'Admin' }, { where: { key: 'admin' } });

    const [programManager] = await Role.findOrCreate({
      where: { key: 'program_manager' },
      defaults: { label: 'Program Manager' },
    });
    const [hospitalAdmin] = await Role.findOrCreate({
      where: { key: 'hospital_admin' },
      defaults: { label: 'Hospital Administrator' },
    });

    const allRoles = await Role.findAll({ order: [['id', 'ASC']] });
    res.json({
      message: 'Roles synced',
      programManagerId: programManager.id,
      hospitalAdminId: hospitalAdmin.id,
      roles: allRoles.map((r) => ({ id: r.id, key: r.key, label: r.label })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to sync roles', details: err.message });
  }
};

/**
 * One-time / repeatable maintenance action: fully removes the 'scheduler'
 * (Master Scheduler) role from the system, now that the 'admin' role holds
 * every scheduler permission too (see routes/schedules.js). Concretely:
 *   1. Deletes every user account currently on the scheduler role, along
 *      with anything that references them: notifications, change requests
 *      they filed, rotation weeks/assignments where they're the physician
 *      (deleted in that order to satisfy foreign keys) or approver (nulled,
 *      since approved_by_id is optional), and audit-log attribution (nulled,
 *      since user_id is optional there).
 *   2. Deletes the 'scheduler' Role row itself.
 *   3. Narrows the roles.key ENUM so 'scheduler' can never be selected or
 *      recreated again (e.g. via Register.js or a raw API call) until
 *      someone widens it again on purpose.
 * Idempotent -- if 'scheduler' is already gone, just confirms that and does
 * nothing destructive.
 */
exports.removeSchedulerRole = async (req, res) => {
  try {
    const schedulerRole = await Role.findOne({ where: { key: 'scheduler' } });
    if (!schedulerRole) {
      return res.json({ message: "'scheduler' role already removed, nothing to do" });
    }

    const schedulerUsers = await User.findAll({ where: { role_id: schedulerRole.id } });
    const deletedUserIds = schedulerUsers.map((u) => u.id);
    const deletedEmails = schedulerUsers.map((u) => u.email);

    if (deletedUserIds.length > 0) {
      await Notification.destroy({ where: { user_id: deletedUserIds } });
      await ChangeRequest.destroy({ where: { requested_by_id: deletedUserIds } });
      await ChangeRequest.update({ resolved_by_id: null }, { where: { resolved_by_id: deletedUserIds } });
      await RotationAssignment.update({ approved_by_id: null }, { where: { approved_by_id: deletedUserIds } });

      // A scheduler account is never itself a rotation's physician, but
      // clean it up defensively the same way the other user-removal
      // endpoints do: delete the assignment's weeks before the assignment,
      // to satisfy RotationWeek's required rotation_assignment_id FK.
      const orphanedAssignments = await RotationAssignment.findAll({
        where: { physician_id: deletedUserIds },
        attributes: ['id'],
      });
      const orphanedAssignmentIds = orphanedAssignments.map((a) => a.id);
      if (orphanedAssignmentIds.length > 0) {
        await RotationWeek.destroy({ where: { rotation_assignment_id: orphanedAssignmentIds } });
        await RotationAssignment.destroy({ where: { id: orphanedAssignmentIds } });
      }

      await AuditLog.update({ user_id: null }, { where: { user_id: deletedUserIds } });
      await User.destroy({ where: { id: deletedUserIds } });
    }

    await Role.destroy({ where: { id: schedulerRole.id } });

    await sequelize.query(
      "ALTER TABLE roles MODIFY COLUMN `key` ENUM('admin','dept_head','physician','program_manager','hospital_admin') NOT NULL"
    );

    const remainingRoles = await Role.findAll({ order: [['id', 'ASC']] });
    res.json({
      message: "'scheduler' role fully removed",
      deletedUserAccounts: deletedEmails,
      roles: remainingRoles.map((r) => ({ id: r.id, key: r.key, label: r.label })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove scheduler role', details: err.message });
  }
};
