const { ChangeRequest, RotationAssignment, User } = require('../models');

exports.list = async (req, res) => {
  const where = {};
  if (req.query.status) where.status = req.query.status;
  const rows = await ChangeRequest.findAll({
    where,
    include: [RotationAssignment, { model: User, as: 'requestedBy' }, { model: User, as: 'resolvedBy' }],
    order: [['requested_at', 'DESC']],
  });
  res.json(rows);
};

exports.create = async (req, res) => {
  const { rotationAssignmentId, reason } = req.body;
  const cr = await ChangeRequest.create({
    rotation_assignment_id: rotationAssignmentId,
    requested_by_id: req.user.id,
    reason,
    status: 'pending',
    requested_at: new Date(),
  });
  res.status(201).json(cr);
};

exports.resolve = async (req, res) => {
  const { decision } = req.body; // 'approved' | 'rejected'
  const cr = await ChangeRequest.findByPk(req.params.id);
  if (!cr) return res.status(404).json({ error: 'Not found' });
  cr.status = decision;
  cr.resolved_by_id = req.user.id;
  cr.resolved_at = new Date();
  await cr.save();
  res.json(cr);
};
