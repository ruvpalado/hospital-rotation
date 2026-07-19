const router = require('express').Router();
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const withAudit = require('../middleware/auditLogger');
const scheduleController = require('../controllers/scheduleController');

router.get('/', authenticate, withAudit('view', 'schedule'), scheduleController.listSchedules);
router.get('/:id', authenticate, withAudit('view', 'schedule'), scheduleController.getSchedule);
// Only the Master Scheduler may create new rotation assignments.
router.post('/', authenticate, requireRole('scheduler'), withAudit('create', 'schedule'), scheduleController.createSchedule);
// Only the Master Scheduler may change a week's attendance status (attended /
// maternity_leave / annual_leave / absent) -- admins and dept heads can view
// schedules but not edit attendance directly.
router.patch('/weeks/:weekId', authenticate, requireRole('scheduler'), withAudit('edit', 'rotation_week'), scheduleController.updateWeekStatus);
router.post('/:id/approve', authenticate, requireRole('admin', 'dept_head'), withAudit('approve', 'schedule'), scheduleController.approveSchedule);
// Admin-only maintenance action: wipe rotation-schedule test data (change
// requests, weeks, assignments) without touching reference data.
router.post('/clear-test-data', authenticate, requireRole('admin'), withAudit('delete', 'schedule'), scheduleController.clearTestData);

module.exports = router;
