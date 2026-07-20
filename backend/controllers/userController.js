const bcrypt = require('bcryptjs');
const {
  User, Role, Site, Department, AuditLog, Notification, RotationAssignment, RotationWeek, ChangeRequest,
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

/**
 * One-time / repeatable maintenance action: wipes every user account (and
 * everything that references a user -- notifications, change requests,
 * rotation weeks/assignments, and audit-log attribution), then provisions
 * exactly two fresh accounts:
 *   1. A merged "Master Scheduler / Admin" account under the 'admin' role.
 *      Since the scheduler-exclusive actions (create schedule, edit week
 *      status) already accept 'admin' too (see routes/schedules.js), this
 *      one login can do everything both Hospital Administrator and Master
 *      Scheduler could do separately.
 *   2. A developer account with the same 'admin' role, for checking the live
 *      app / dashboards when an update is needed, without touching the
 *      primary login.
 * Reference data (roles, sites, departments, curriculum blocks) is left
 * completely untouched -- only user accounts and user-owned records are
 * removed.
 */
exports.resetAllUsers = async (req, res) => {
  try {
    const adminRole = await Role.findOne({ where: { key: 'admin' } });
    if (!adminRole) return res.status(500).json({ error: "'admin' role not found -- run the seed script first" });

    // Order matters: children before parents, to satisfy foreign keys.
    await RotationWeek.destroy({ where: {} });
    await ChangeRequest.destroy({ where: {} });
    await RotationAssignment.destroy({ where: {} });
    await Notification.destroy({ where: {} });
    await AuditLog.update({ user_id: null }, { where: {} });
    await User.destroy({ where: {} });

    const password_hash = await bcrypt.hash('Passw0rd!', 10);
    const mainAccount = await User.create({
      full_name: 'Master Scheduler / Admin',
      email: 'admin@obgyn-rotation.local',
      phone: '+96890000001',
      password_hash,
      role_id: adminRole.id,
      language_pref: 'en',
    });

    const devPasswordHash = await bcrypt.hash('DevAccess#2026!', 10);
    const devAccount = await User.create({
      full_name: 'Ruel Palado (Developer)',
      email: 'ruvpalado@gmail.com',
      password_hash: devPasswordHash,
      role_id: adminRole.id,
      language_pref: 'en',
    });

    await AuditLog.create({
      user_id: mainAccount.id,
      action: 'delete',
      entity_type: 'user_full_reset',
      details: { note: 'All user accounts wiped and reprovisioned via /api/users/reset-all' },
    });

    res.json({
      message: 'All users deleted. Two fresh accounts provisioned.',
      accounts: [
        { purpose: 'main (Master Scheduler + Admin merged)', email: mainAccount.email, password: 'Passw0rd!', role: 'admin' },
        { purpose: 'developer', email: devAccount.email, password: 'DevAccess#2026!', role: 'admin' },
      ],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to reset users', details: err.message });
  }
};

/**
 * One-time / repeatable maintenance action: ensures exactly one demo account
 * exists for each of the five non-admin roles (scheduler, dept_head,
 * physician, program_manager, hospital_admin). Doesn't touch the 'admin'
 * role -- the account you're already logged in as (admin@obgyn-rotation.local)
 * is that role's demo/primary login. Idempotent: uses findOrCreate keyed on
 * email, so calling this more than once won't create duplicates or disturb
 * accounts that already exist.
 */
exports.seedDemoAccounts = async (req, res) => {
  try {
    const firstSite = await Site.findOne({ order: [['id', 'ASC']] });
    const firstDept = await Department.findOne({ order: [['id', 'ASC']] });
    const password_hash = await bcrypt.hash('Demo123!', 10);

    const demoDefs = [
      {
        key: 'scheduler',
        email: 'scheduler.demo@obgyn-rotation.local',
        full_name: 'Demo Master Scheduler',
      },
      {
        key: 'dept_head',
        email: 'depthead.demo@obgyn-rotation.local',
        full_name: 'Demo Department Head',
        home_department_id: firstDept ? firstDept.id : null,
      },
      {
        key: 'physician',
        email: 'physician.demo@obgyn-rotation.local',
        full_name: 'Demo Physician',
        home_site_id: firstSite ? firstSite.id : null,
        home_department_id: firstDept ? firstDept.id : null,
      },
      {
        key: 'program_manager',
        email: 'programmanager.demo@obgyn-rotation.local',
        full_name: 'Demo Program Manager',
      },
      {
        key: 'hospital_admin',
        email: 'hospitaladmin.demo@obgyn-rotation.local',
        full_name: 'Demo Hospital Administrator',
        home_site_id: firstSite ? firstSite.id : null,
      },
    ];

    const accounts = [];
    for (const def of demoDefs) {
      const role = await Role.findOne({ where: { key: def.key } });
      if (!role) {
        accounts.push({ role: def.key, error: `Role '${def.key}' not found -- run POST /api/roles/sync first` });
        continue;
      }
      const [user, created] = await User.findOrCreate({
        where: { email: def.email },
        defaults: {
          full_name: def.full_name,
          email: def.email,
          password_hash,
          role_id: role.id,
          home_site_id: def.home_site_id || null,
          home_department_id: def.home_department_id || null,
          language_pref: 'en',
        },
      });
      accounts.push({
        role: def.key,
        email: user.email,
        password: 'Demo123!',
        created,
        homeSiteId: user.home_site_id,
        homeDepartmentId: user.home_department_id,
      });
    }

    res.json({ message: 'Demo accounts ensured (one per non-admin role)', accounts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to seed demo accounts', details: err.message });
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
