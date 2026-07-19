const { Op } = require('sequelize');
const {
  RotationAssignment, RotationWeek, Block, SiteDepartment, Site, Department, User, ChangeRequest,
} = require('../models');
const { deriveAssignmentStatus } = require('../utils/rotationRules');
const { sendNotification } = require('../services/notificationService');

const includeFull = [
  { model: RotationWeek, as: 'weeks', order: [['week_number', 'ASC']] },
  { model: Block },
  { model: SiteDepartment, include: [Site, Department] },
  { model: User, as: 'physician', attributes: ['id', 'full_name', 'email', 'phone'] },
];

exports.listSchedules = async (req, res) => {
  const { physicianId, siteId, departmentId, blockId } = req.query;
  const where = {};
  if (physicianId) where.physician_id = physicianId;
  if (blockId) where.block_id = blockId;

  // Most recently created rotation assignment shows first.
  let assignments = await RotationAssignment.findAll({ where, include: includeFull, order: [['createdAt', 'DESC']] });

  if (siteId) assignments = assignments.filter((a) => a.SiteDepartment.Site.id === Number(siteId));
  if (departmentId) assignments = assignments.filter((a) => a.SiteDepartment.Department.id === Number(departmentId));

  // Role-based filtering: physicians only see their own; dept heads see their department; scheduler/admin see all
  if (req.user.role === 'physician') {
    assignments = assignments.filter((a) => a.physician_id === req.user.id);
  } else if (req.user.role === 'dept_head' && req.user.departmentId) {
    assignments = assignments.filter((a) => a.SiteDepartment.Department.id === req.user.departmentId);
  }

  res.json(assignments.map(serialize));
};

exports.getSchedule = async (req, res) => {
  const a = await RotationAssignment.findByPk(req.params.id, { include: includeFull });
  if (!a) return res.status(404).json({ error: 'Not found' });
  res.json(serialize(a));
};

exports.createSchedule = async (req, res) => {
  try {
    const { physicianId, siteDepartmentId, blockId, startDate, endDate } = req.body;
    const block = await Block.findByPk(blockId);
    if (!block) return res.status(400).json({ error: 'Invalid blockId' });

    const assignment = await RotationAssignment.create({
      physician_id: physicianId,
      site_department_id: siteDepartmentId,
      block_id: blockId,
      start_date: startDate,
      end_date: endDate,
      status: 'scheduled',
    });

    // Auto-create 4 week rows (pending) aligned to block.total_weeks
    const start = new Date(startDate);
    for (let i = 0; i < block.total_weeks; i++) {
      const weekStart = new Date(start);
      weekStart.setDate(weekStart.getDate() + i * 7);
      await RotationWeek.create({
        rotation_assignment_id: assignment.id,
        week_number: i + 1,
        week_start_date: weekStart.toISOString().slice(0, 10),
        status: 'pending',
      });
    }

    const physician = await User.findByPk(physicianId);
    if (physician) await sendNotification({
      userId: physician.id, channel: 'system', title: 'New Rotation Assigned',
      message: `You have been assigned to Block ${block.block_number} starting ${startDate}.`,
      phone: physician.phone, email: physician.email, relatedRotationId: assignment.id,
    });

    const full = await RotationAssignment.findByPk(assignment.id, { include: includeFull });
    res.status(201).json(serialize(full));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create schedule', details: err.message });
  }
};

/** Update a specific week's attendance status (attended / maternity_leave / annual_leave / absent) */
exports.updateWeekStatus = async (req, res) => {
  const { weekId } = req.params;
  const { status } = req.body;
  const week = await RotationWeek.findByPk(weekId, { include: [{ model: RotationAssignment, }] });
  if (!week) return res.status(404).json({ error: 'Week not found' });

  week.status = status;
  await week.save();

  const assignment = await RotationAssignment.findByPk(week.rotation_assignment_id, { include: [{ model: RotationWeek, as: 'weeks' }] });
  assignment.status = deriveAssignmentStatus(assignment.weeks);
  await assignment.save();

  res.json({ week, assignmentStatus: assignment.status });
};

exports.approveSchedule = async (req, res) => {
  const a = await RotationAssignment.findByPk(req.params.id);
  if (!a) return res.status(404).json({ error: 'Not found' });
  a.approved_by_id = req.user.id;
  a.approved_at = new Date();
  await a.save();
  res.json({ message: 'Approved', assignment: a });
};

// One-time / repeatable maintenance action: wipes rotation-schedule test
// data (change requests, weeks, assignments) from whatever database this API
// instance is actually connected to, without touching roles, sites,
// departments, users, curriculum blocks, notifications, or audit logs. Lets
// an admin clear seeded test data without needing shell/console access to
// the host. Mirrors backend/scripts/clear-schedules.js.
exports.clearTestData = async (req, res) => {
  try {
    const changeRequestCount = await ChangeRequest.destroy({ where: {} });
    const weekCount = await RotationWeek.destroy({ where: {} });
    const assignmentCount = await RotationAssignment.destroy({ where: {} });

    res.json({
      message: 'Schedule test data cleared',
      changeRequestsDeleted: changeRequestCount,
      rotationWeeksDeleted: weekCount,
      rotationAssignmentsDeleted: assignmentCount,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to clear schedule test data', details: err.message });
  }
};

function serialize(a) {
  return {
    id: a.id,
    physician: a.physician,
    site: a.SiteDepartment.Site,
    department: a.SiteDepartment.Department,
    block: a.Block,
    startDate: a.start_date,
    endDate: a.end_date,
    status: a.status,
    approvedAt: a.approved_at,
    weeks: (a.weeks || []).sort((x, y) => x.week_number - y.week_number),
  };
}
