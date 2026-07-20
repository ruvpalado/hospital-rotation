const router = require('express').Router();
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const withAudit = require('../middleware/auditLogger');
const scheduleController = require('../controllers/scheduleController');

router.get('/', authenticate, withAudit('view', 'schedule'), scheduleController.listSchedules);
router.get('/:id', authenticate, withAudit('view', 'schedule'), scheduleController.getSchedule);
// The Master Scheduler may create new rotation assignments; the merged
// admin account also holds Master Scheduler permissions, so admin is
// included here too.
router.post('/', authenticate, requireRole('scheduler', 'admin'), withAudit('create', 'schedule'), scheduleController.createSchedule);
// The Master Scheduler may change a week's attendance status (attended /
// maternity_leave / annual_leave / absent) -- dept heads can view schedules
// but not edit attendance directly. Admin included for the same reason as
// above.
router.patch('/weeks/:weekId', authenticate, requireRole('scheduler', 'admin'), withAudit('edit', 'rotation_week'), scheduleController.updateWeekStatus);
router.post('/:id/approve', authenticate, requireRole('admin', 'dept_head'), withAudit('approve', 'schedule'), scheduleController.approveSchedule);
// Admin-only maintenance action: wipe rotation-schedule test data (change
// requests, weeks, assignments) without touching reference data.
router.post('/clear-test-data', authenticate, requireRole('admin'), withAudit('delete', 'schedule'), scheduleController.clearTestData);

module.exports = router;
