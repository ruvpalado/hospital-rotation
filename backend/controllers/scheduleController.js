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
    const { physicianId, physicianName, siteDepartmentId, blockId, startDate, endDate } = req.body;
    const block = await Block.findByPk(blockId);
    if (!block) return res.status(400).json({ error: 'Invalid blockId' });

    // Physician is a free-typed name field, not restricted to a predefined
    // list. If it matches a registered physician (physicianId resolved
    // client-side from the autocomplete suggestions), link the real account
    // so that physician's dashboard, per-physician KPIs, and reminder
    // notifications all work as before. Otherwise this assignment is
    // display-only under the typed name, with no account attached.
    let physician = null;
    if (physicianId) {
      physician = await User.findByPk(physicianId);
      if (!physician) return res.status(400).json({ error: 'Invalid physicianId' });
    }
    const resolvedName = physician ? physician.full_name : (physicianName || '').trim();
    if (!resolvedName) return res.status(400).json({ error: 'physicianName is required' });

    // Block Assignment Control: one schedule per physician per block. The
    // frontend disables already-assigned blocks in the dropdown, but this is
    // enforced here too so a direct API call can't create a conflict.
    const conflict = await RotationAssignment.findOne({
      where: {
        block_id: blockId,
        ...(physician ? { physician_id: physician.id } : { physician_name: resolvedName }),
      },
    });
    if (conflict) {
      return res.status(409).json({ error: `${resolvedName} already has a schedule assigned for this block.` });
    }

    const assignment = await RotationAssignment.create({
      physician_id: physician ? physician.id : null,
      physician_name: resolvedName,
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

    // physician is null for a free-typed name with no matching account --
    // there's nothing to notify in that case. For a registered physician,
    // the assignment notice goes out on every channel we have contact
    // details for: in-app (system), the email address and -- when a mobile
    // number was provided at registration -- SMS. Each is best-effort so a
    // delivery failure never rolls back the schedule that was just created.
    if (physician) {
      const sd = await SiteDepartment.findByPk(siteDepartmentId, { include: [Site, Department] });
      const title = 'New Rotation Assigned';
      const message = `Hi ${physician.full_name}, you have been assigned to Block ${block.block_number} (${block.name})`
        + `${sd ? ` at ${sd.Site?.name} - ${sd.Department?.name}` : ''}, from ${startDate} to ${endDate}.`;

      const channels = ['system', 'email'];
      if (physician.phone) channels.push('sms');
      for (const channel of channels) {
        try {
          await sendNotification({
            userId: physician.id, channel, title, message,
            phone: physician.phone, email: physician.email, relatedRotationId: assignment.id,
          });
        } catch (notifyErr) {
          console.error(`Failed to send ${channel} notification for new rotation:`, notifyErr.message);
        }
      }
    }

    const full = await RotationAssignment.findByPk(assignment.id, { include: includeFull });
    res.status(201).json(serialize(full));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create schedule', details: err.message });
  }
};

/**
 * Edit an existing rotation schedule (physician, site/department, block,
 * dates) from the Edit Schedule module. Physician follows the same
 * resolution rules as createSchedule: a matching registered account keeps
 * the account link (dashboard/KPIs/notifications), any other typed name is
 * stored as free text with no account attached.
 *
 * If the start date or block changes, the weekly attendance rows are
 * re-anchored to the new dates -- each week keeps its already-recorded
 * status (attended/leave/etc.), weeks are added or removed only if the new
 * block has a different total_weeks, and the assignment's derived status is
 * recomputed afterwards.
 */
exports.updateSchedule = async (req, res) => {
  try {
    const assignment = await RotationAssignment.findByPk(req.params.id);
    if (!assignment) return res.status(404).json({ error: 'Not found' });

    const { physicianId, physicianName, siteDepartmentId, blockId, startDate, endDate } = req.body;

    const block = await Block.findByPk(blockId);
    if (!block) return res.status(400).json({ error: 'Invalid blockId' });
    const siteDepartment = await SiteDepartment.findByPk(siteDepartmentId);
    if (!siteDepartment) return res.status(400).json({ error: 'Invalid siteDepartmentId' });

    let physician = null;
    if (physicianId) {
      physician = await User.findByPk(physicianId);
      if (!physician) return res.status(400).json({ error: 'Invalid physicianId' });
    }
    const resolvedName = physician ? physician.full_name : (physicianName || '').trim();
    if (!resolvedName) return res.status(400).json({ error: 'physicianName is required' });

    // Same one-schedule-per-physician-per-block rule as createSchedule,
    // excluding the assignment being edited itself.
    const conflict = await RotationAssignment.findOne({
      where: {
        id: { [Op.ne]: assignment.id },
        block_id: blockId,
        ...(physician ? { physician_id: physician.id } : { physician_name: resolvedName }),
      },
    });
    if (conflict) {
      return res.status(409).json({ error: `${resolvedName} already has a schedule assigned for this block.` });
    }

    const startChanged = String(assignment.start_date) !== String(startDate);
    const blockChanged = Number(assignment.block_id) !== Number(blockId);

    assignment.physician_id = physician ? physician.id : null;
    assignment.physician_name = resolvedName;
    assignment.site_department_id = Number(siteDepartmentId);
    assignment.block_id = Number(blockId);
    assignment.start_date = startDate;
    assignment.end_date = endDate;
    await assignment.save();

    if (startChanged || blockChanged) {
      const weeks = await RotationWeek.findAll({
        where: { rotation_assignment_id: assignment.id },
        order: [['week_number', 'ASC']],
      });
      const start = new Date(startDate);
      for (let i = 0; i < block.total_weeks; i++) {
        const weekStart = new Date(start);
        weekStart.setDate(weekStart.getDate() + i * 7);
        const dateStr = weekStart.toISOString().slice(0, 10);
        const existing = weeks.find((w) => w.week_number === i + 1);
        if (existing) {
          existing.week_start_date = dateStr; // status intentionally preserved
          await existing.save();
        } else {
          await RotationWeek.create({
            rotation_assignment_id: assignment.id,
            week_number: i + 1,
            week_start_date: dateStr,
            status: 'pending',
          });
        }
      }
      for (const w of weeks) {
        if (w.week_number > block.total_weeks) await w.destroy();
      }

      const withWeeks = await RotationAssignment.findByPk(assignment.id, { include: [{ model: RotationWeek, as: 'weeks' }] });
      withWeeks.status = deriveAssignmentStatus(withWeeks.weeks);
      await withWeeks.save();
    }

    const full = await RotationAssignment.findByPk(assignment.id, { include: includeFull });
    res.json(serialize(full));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update schedule', details: err.message });
  }
};

/**
 * Admin override / finalize: sets a week's official status directly
 * (scheduler/admin/developer). This is the administrator's authority to
 * change and finalize on the physician's behalf -- it also clears any
 * pending proposal, since the admin has now had the final say.
 */
exports.updateWeekStatus = async (req, res) => {
  const { weekId } = req.params;
  const { status } = req.body;
  const week = await RotationWeek.findByPk(weekId, { include: [{ model: RotationAssignment, }] });
  if (!week) return res.status(404).json({ error: 'Week not found' });

  // Once a rotation is marked completed, its weekly attendance is locked --
  // enforced here (not just hidden in the UI) so a direct API call can't
  // change history on a finished rotation either.
  if (week.RotationAssignment?.status === 'completed') {
    return res.status(400).json({ error: 'This rotation is completed; weekly attendance can no longer be changed.' });
  }

  week.status = status;
  week.proposed_status = null; // admin finalized -> no proposal outstanding
  week.approved_by_id = req.user.id;
  week.approved_at = new Date();
  await week.save();

  const assignment = await RotationAssignment.findByPk(week.rotation_assignment_id, { include: [{ model: RotationWeek, as: 'weeks' }] });
  assignment.status = deriveAssignmentStatus(assignment.weeks);
  await assignment.save();

  res.json({ week, assignmentStatus: assignment.status });
};

/**
 * Physician self-update: a physician proposes a new status for one of THEIR
 * OWN weeks. It's held in proposed_status pending admin approval -- the
 * official `status` (and therefore the rotation's completion) does not change
 * until an admin approves. Only the physician who owns the rotation may call
 * this (enforced by comparing the assignment's physician_id to req.user.id).
 */
exports.proposeWeekStatus = async (req, res) => {
  const { weekId } = req.params;
  const { status } = req.body;
  const week = await RotationWeek.findByPk(weekId, { include: [{ model: RotationAssignment }] });
  if (!week) return res.status(404).json({ error: 'Week not found' });

  if (week.RotationAssignment?.physician_id !== req.user.id) {
    return res.status(403).json({ error: 'You can only update your own rotation weeks.' });
  }
  if (week.RotationAssignment?.status === 'completed') {
    return res.status(400).json({ error: 'This rotation is completed; weekly attendance can no longer be changed.' });
  }

  // Proposing the value that's already official is a no-op proposal -> clear.
  week.proposed_status = status === week.status ? null : status;
  await week.save();

  res.json({ week, message: week.proposed_status
    ? 'Update submitted for administrator approval.'
    : 'No change (matches the current approved status).' });
};

/**
 * Admin approval: approve a physician's proposed week status
 * (scheduler/admin/developer). Copies proposed_status into the official
 * status, clears the proposal, and recomputes the rotation's status.
 * Passing nothing approves the outstanding proposal; there's also a reject
 * path (approve=false) that just discards the proposal.
 */
exports.approveWeekStatus = async (req, res) => {
  const { weekId } = req.params;
  const { approve = true } = req.body;
  const week = await RotationWeek.findByPk(weekId, { include: [{ model: RotationAssignment }] });
  if (!week) return res.status(404).json({ error: 'Week not found' });
  if (!week.proposed_status) {
    return res.status(400).json({ error: 'There is no pending update to approve for this week.' });
  }
  if (week.RotationAssignment?.status === 'completed') {
    return res.status(400).json({ error: 'This rotation is completed; weekly attendance can no longer be changed.' });
  }

  if (approve) {
    week.status = week.proposed_status;
    week.approved_by_id = req.user.id;
    week.approved_at = new Date();
  }
  week.proposed_status = null;
  await week.save();

  const assignment = await RotationAssignment.findByPk(week.rotation_assignment_id, { include: [{ model: RotationWeek, as: 'weeks' }] });
  assignment.status = deriveAssignmentStatus(assignment.weeks);
  await assignment.save();

  res.json({ week, assignmentStatus: assignment.status, message: approve ? 'Update approved.' : 'Update rejected.' });
};

/**
 * Bulk approve: approve every pending physician-proposed week status for a
 * physician in one action (the "Approve All" button). Scheduler/admin only.
 * Skips completed rotations (locked). Recomputes each affected rotation's
 * derived status afterwards.
 */
exports.approveAllProposals = async (req, res) => {
  try {
    const { physicianId, physicianName } = req.body;
    const physicianWhere = physicianId
      ? { physician_id: physicianId }
      : { physician_name: (physicianName || '').trim() };
    if (!physicianId && !physicianWhere.physician_name) {
      return res.status(400).json({ error: 'physicianId or physicianName is required' });
    }

    const assignments = await RotationAssignment.findAll({
      where: physicianWhere,
      include: [{ model: RotationWeek, as: 'weeks' }],
    });

    let approved = 0;
    for (const a of assignments) {
      if (a.status === 'completed') continue; // locked
      let changed = false;
      for (const w of a.weeks) {
        if (w.proposed_status) {
          w.status = w.proposed_status;
          w.proposed_status = null;
          w.approved_by_id = req.user.id;
          w.approved_at = new Date();
          await w.save();
          approved += 1;
          changed = true;
        }
      }
      if (changed) {
        a.status = deriveAssignmentStatus(a.weeks);
        await a.save();
      }
    }

    res.json({ approved, message: `${approved} proposed update(s) approved.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to approve proposals', details: err.message });
  }
};

exports.approveSchedule = async (req, res) => {
  const a = await RotationAssignment.findByPk(req.params.id);
  if (!a) return res.status(404).json({ error: 'Not found' });
  a.approved_by_id = req.user.id;
  a.approved_at = new Date();
  await a.save();
  res.json({ message: 'Approved', assignment: a });
};

/**
 * Permanently deletes a single rotation assignment (and its dependent rows:
 * change requests, which have a required rotation_assignment_id FK, and
 * weekly attendance rows). Restricted to the developer account only (see
 * routes/schedules.js requireDeveloperEmail) -- this is a one-off cleanup
 * tool, not a general scheduling action.
 */
exports.deleteSchedule = async (req, res) => {
  try {
    const assignment = await RotationAssignment.findByPk(req.params.id, {
      include: [{ model: RotationWeek, as: 'weeks' }],
    });
    if (!assignment) return res.status(404).json({ error: 'Not found' });

    // A completed rotation is part of the physician's training record and must
    // not be removed -- enforced here so the UI's disabled Delete button can't
    // be bypassed via a direct API call.
    if (deriveAssignmentStatus(assignment.weeks || []) === 'completed') {
      return res.status(400).json({ error: 'Completed rotations cannot be deleted.' });
    }

    await ChangeRequest.destroy({ where: { rotation_assignment_id: assignment.id } });
    await RotationWeek.destroy({ where: { rotation_assignment_id: assignment.id } });
    await assignment.destroy();

    res.json({ message: 'Rotation schedule deleted', id: Number(req.params.id) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete schedule', details: err.message });
  }
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
    // a.physician is the linked User row when physician_id resolved to a real
    // account; otherwise fall back to the free-typed physician_name so every
    // consumer of this shape (ScheduleViewer, reports, KPI drill-downs) can
    // keep reading physician?.full_name unchanged either way.
    physician: a.physician
      ? { id: a.physician.id, full_name: a.physician.full_name, email: a.physician.email, phone: a.physician.phone }
      : { id: null, full_name: a.physician_name, email: null, phone: null },
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
