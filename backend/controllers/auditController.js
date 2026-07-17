const { AuditLog, User } = require('../models');

exports.list = async (req, res) => {
  const rows = await AuditLog.findAll({
    include: [{ model: User, attributes: ['id', 'full_name', 'email'] }],
    order: [['createdAt', 'DESC']],
    limit: 500,
  });
  res.json(rows);
};
