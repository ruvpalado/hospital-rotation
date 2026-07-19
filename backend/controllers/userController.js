const { User, Role, Site, Department, AuditLog } = require('../models');

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
