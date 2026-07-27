const router = require('express').Router();
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const { requireDeveloperEmail } = requireRole;
const withAudit = require('../middleware/auditLogger');
const denyDeveloperWrite = require('../middleware/denyDeveloperWrite');
const scheduleController = require('../controllers/scheduleController');

// Developer Account -- view-only on schedules (and all Program-Administrator
// data). This blocks + audits every schedule-modifying action for the
// developer, since it would otherwise pass as an admin superset. The developer
// keeps VIEW access (the GETs below) and its own exclusive schedule-delete.
const denyDevSchedule = denyDeveloperWrite('schedule');

router.get('/', authenticate, withAudit('view', 'schedule'), scheduleController.listSchedules);
router.get('/:id', authenticate, withAudit('view', 'schedule'), scheduleController.getSchedule);
// The Master Scheduler may create new rotation assignments; the merged
// admin account also holds Master Scheduler permissions, so admin is
// included here too.
router.post('/', authenticate, denyDevSchedule, requireRole('scheduler', 'admin'), withAudit('create', 'schedule'), scheduleController.createSchedule);
// Edit an existing rotation schedule (physician, site/department, block,
// dates) -- same audience as create, minus the view-only developer account.
router.put('/:id', authenticate, denyDevSchedule, requireRole('scheduler', 'admin'), withAudit('edit', 'schedule'), scheduleController.updateSchedule);
// The Master Scheduler may change a week's attendance status (attended /
// maternity_leave / annual_leave / absent) -- dept heads can view schedules
// but not edit attendance directly. Admin included for the same reason as
// above.
router.patch('/weeks/:weekId', authenticate, denyDevSchedule, requireRole('scheduler', 'admin'), withAudit('edit', 'rotation_week'), scheduleController.updateWeekStatus);
// Weekly Status Update workflow:
//  - Physicians propose a status for their OWN week (held for approval).
//  - Admins/schedulers approve (or reject) a physician's proposed status.
router.patch('/weeks/:weekId/propose', authenticate, requireRole('physician'), withAudit('edit', 'rotation_week'), scheduleController.proposeWeekStatus);
router.post('/weeks/:weekId/approve', authenticate, denyDevSchedule, requireRole('scheduler', 'admin'), withAudit('approve', 'rotation_week'), scheduleController.approveWeekStatus);
// "Approve All": bulk-approve every pending proposed week status for a
// physician in one action.
router.post('/approve-all-proposals', authenticate, denyDevSchedule, requireRole('scheduler', 'admin'), withAudit('approve', 'rotation_week'), scheduleController.approveAllProposals);
router.post('/:id/approve', authenticate, denyDevSchedule, requireRole('admin', 'dept_head'), withAudit('approve', 'schedule'), scheduleController.approveSchedule);
// Admin-only maintenance action: wipe rotation-schedule test data (change
// requests, weeks, assignments) without touching reference data.
router.post('/clear-test-data', authenticate, denyDevSchedule, requireRole('admin'), withAudit('delete', 'schedule'), scheduleController.clearTestData);

// Schedule deletion is DISABLED. The developer was previously the only account
// allowed to delete a rotation schedule; per the "disable Delete in the
// Developer account" requirement, denyDeveloperWrite blocks + audits the
// developer here, and requireDeveloperEmail still blocks everyone else -- so
// no account can remove scheduled records through this endpoint.
router.delete('/:id', authenticate, denyDeveloperWrite('schedule'), requireDeveloperEmail, withAudit('delete', 'schedule'), scheduleController.deleteSchedule);

module.exports = router;
