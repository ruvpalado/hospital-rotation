const { Notification } = require('../models');

exports.listForUser = async (req, res) => {
  const rows = await Notification.findAll({
    where: { user_id: req.user.id },
    order: [['createdAt', 'DESC']],
  });
  res.json(rows);
};

exports.listAll = async (req, res) => {
  const rows = await Notification.findAll({ order: [['createdAt', 'DESC']], limit: 200 });
  res.json(rows);
};
