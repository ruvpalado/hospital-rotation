const { User, Role, Site, Department } = require('../models');

/**
 * List users, optionally filtered by role (e.g. ?role=physician).
 * Used by the Master Scheduler UI to populate the "Physician" dropdown when
 * creating a rotation assignment. Restricted to admin/scheduler/dept_head via
 * the route middleware -- physicians don't need to browse other users.
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
  res.json(users.map((u) => ({
    id: u.id,
    fullName: u.full_name,
    email: u.email,
    role: u.Role.key,
    roleLabel: u.Role.label,
    homeSite: u.homeSite ? { id: u.homeSite.id, name: u.homeSite.name, short_code: u.homeSite.short_code } : null,
    homeDepartment: u.homeDepartment ? { id: u.homeDepartment.id, code: u.homeDepartment.code, name: u.homeDepartment.name } : null,
  })));
};
