const {
  User, Role, Site, Department, AuditLog, Notification, RotationAssignment, ChangeRequest,
} = require('../models');

/**
 * List users, optionally filtered by role (e.g. ?role=physician).
 * Used both by the Master Scheduler's "Physician" dropdown when creating a
 * rotation assignment, and by the User Management page. Restricted to
 * admin/scheduler/dept_head via the route middleware.
 */
exports.list = async (req, res) => {
  const where = {};
  if (req.query.role) {
    const role = await Role.findOne({ where: { key: req.query.role } });
    if (!role) return res.json([]);
    where.role_id = role.id;
  }
  const users = await User.findAll({
    where,
    include: [Role, { model: Site, as: 'homeSite' }, { model: Department, as: 'homeDepartment' }],
    order: [['full_name', 'ASC']],
  });
  res.json(users.map(serialize));
};

/**
 * Deactivate a user (soft delete). The account can no longer log in, and
 * disappears from active pickers, but all historical rotation assignments,
 * change requests, notifications, and audit log entries referencing them
 * stay intact for compliance/audit purposes.
 */
exports.deactivate = async (req, res) => {
  const targetId = Number(req.params.id);
  if (targetId === req.user.id) {
    return res.status(400).json({ error: 'You cannot deactivate your own account.' });
  }
  const user = await User.findByPk(targetId, { include: [Role, { model: Site, as: 'homeSite' }, { model: Department, as: 'homeDepartment' }] });
  if (!user) return res.status(404).json({ error: 'User not found' });

  user.is_active = false;
  await user.save();

  await AuditLog.create({
    user_id: req.user.id,
    action: 'edit',
    entity_type: 'user_deactivation',
    entity_id: user.id,
    details: { deactivatedUserEmail: user.email },
  });

  res.json(serialize(user));
};

/** Reactivate a previously deactivated user. */
exports.reactivate = async (req, res) => {
  const user = await User.findByPk(req.params.id, { include: [Role, { model: Site, as: 'homeSite' }, { model: Department, as: 'homeDepartment' }] });
  if (!user) return res.status(404).json({ error: 'User not found' });

  user.is_active = true;
  await user.save();

  await AuditLog.create({
    user_id: req.user.id,
    action: 'edit',
    entity_type: 'user_reactivation',
    entity_id: user.id,
    details: { reactivatedUserEmail: user.email },
  });

  res.json(serialize(user));
};

/**
 * One-time / repeatable maintenance action: hard-deletes duplicate seed
 * users, keeping exactly one account per role (the earliest-created / lowest
 * id -- for admin this is the demo login used throughout setup, so the
 * caller's own session never breaks). Unlike deactivate(), this permanently
 * removes rows rather than soft-deleting.
 *
 * Before deleting a user, dependent rows that would otherwise violate a
 * foreign key are cleaned up: notifications addressed to the removed user
 * are deleted (they're per-user reminders with no meaning once the account
 * is gone), and change-request / rotation-assignment references to the
 * removed user are nulled out where the column allows it, or deleted where
 * the referencing column is required. The current authenticated caller is
 * never deleted, regardless of role.
 */
exports.cleanupDuplicates = async (req, res) => {
  try {
    const roles = await Role.findAll();
    const keptUsers = [];
    const deletedUserIds = [];

    for (const role of roles) {
      const usersInRole = await User.findAll({ where: { role_id: role.id }, order: [['id', 'ASC']] });
      if (usersInRole.length === 0) continue;

      // Prefer keeping whichever account is currently logged in for its own
      // role (never lock the caller out); otherwise keep the lowest id.
      const keep = usersInRole.find((u) => u.id === req.user.id) || usersInRole[0];
      keptUsers.push(keep);

      const toDelete = usersInRole.filter((u) => u.id !== keep.id);
      deletedUserIds.push(...toDelete.map((u) => u.id));
    }

    if (deletedUserIds.length > 0) {
      await Notification.destroy({ where: { user_id: deletedUserIds } });
      // requested_by_id is required (NOT NULL), so a change request whose
      // requester is being removed has no valid owner left -- delete it
      // rather than nulling a required column.
      await ChangeRequest.destroy({ where: { requested_by_id: deletedUserIds } });
      // resolved_by_id is optional -- safe to null out.
      await ChangeRequest.update({ resolved_by_id: null }, { where: { resolved_by_id: deletedUserIds } });
      await RotationAssignment.update({ approved_by_id: null }, { where: { approved_by_id: deletedUserIds } });
      // Rotation assignments belonging to a removed physician have no valid
      // owner left -- remove them (their weeks/change-requests cascade via
      // the existing associations' onDelete behavior, or are already empty
      // after a prior schedules cleanup).
      await RotationAssignment.destroy({ where: { physician_id: deletedUserIds } });
      await AuditLog.update({ user_id: null }, { where: { user_id: deletedUserIds } });
      await User.destroy({ where: { id: deletedUserIds } });
    }

    await AuditLog.create({
      user_id: req.user.id,
      action: 'delete',
      entity_type: 'user_cleanup',
      details: { deletedCount: deletedUserIds.length, keptUserIds: keptUsers.map((u) => u.id) },
    });

    const remaining = await User.findAll({ include: [Role], order: [['role_id', 'ASC']] });
    res.json({
      message: 'Duplicate users removed, one kept per role',
      deletedCount: deletedUserIds.length,
      remaining: remaining.map(serialize),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to clean up duplicate users', details: err.message });
  }
};

function serialize(u) {
  return {
    id: u.id,
    fullName: u.full_name,
    email: u.email,
    phone: u.phone,
    role: u.Role.key,
    roleLabel: u.Role.label,
    isActive: u.is_active,
    homeSite: u.homeSite ? { id: u.homeSite.id, name: u.homeSite.name, short_code: u.homeSite.short_code } : null,
    homeDepartment: u.homeDepartment ? { id: u.homeDepartment.id, code: u.homeDepartment.code, name: u.homeDepartment.name } : null,
  };
}
