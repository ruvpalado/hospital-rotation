const { AuditLog, User } = require('../models');

exports.list = async (req, res) => {
  const rows = await AuditLog.findAll({
    include: [{ model: User, attributes: ['id', 'full_name', 'email'] }],
    order: [['createdAt', 'DESC']],
    limit: 500,
  });
  res.json(rows);
};

/**
 * Admin-only maintenance action: permanently deletes every audit log entry.
 * Doesn't touch the AuditLog table/feature itself -- new actions will keep
 * being logged normally going forward. Records this clear action as a fresh
 * audit log entry immediately afterward, so the table is never left
 * literally empty and there's a trace of who cleared it and when.
 */
exports.clearAll = async (req, res) => {
  try {
    const deletedCount = await AuditLog.destroy({ where: {} });

    await AuditLog.create({
      user_id: req.user.id,
      action: 'delete',
      entity_type: 'audit_log_clear',
      details: { deletedCount },
    });

    res.json({ message: 'Audit log cleared', deletedCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to clear audit log', details: err.message });
  }
};
