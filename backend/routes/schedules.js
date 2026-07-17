const router = require('express').Router();
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const withAudit = require('../middleware/auditLogger');
const scheduleController = require('../controllers/scheduleController');

router.get('/', authenticate, withAudit('view', 'schedule'), scheduleController.listSchedules);
router.get('/:id', authenticate, withAudit('view', 'schedule'), scheduleController.getSchedule);
router.post('/', authenticate, requireRole('admin', 'scheduler'), withAudit('create', 'schedule'), scheduleController.createSchedule);
router.patch('/weeks/:weekId', authenticate, requireRole('admin', 'scheduler', 'dept_head'), withAudit('edit', 'rotation_week'), scheduleController.updateWeekStatus);
router.post('/:id/approve', authenticate, requireRole('admin', 'dept_head'), withAudit('approve', 'schedule'), scheduleController.approveSchedule);

module.exports = router;
