const { sequelize, Role } = require('../models');

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
