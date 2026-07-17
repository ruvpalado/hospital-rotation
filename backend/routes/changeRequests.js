const router = require('express').Router();
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const withAudit = require('../middleware/auditLogger');
const controller = require('../controllers/changeRequestController');

router.get('/', authenticate, controller.list);
router.post('/', authenticate, withAudit('create', 'change_request'), controller.create);
router.post('/:id/resolve', authenticate, requireRole('admin', 'dept_head'), withAudit('approve', 'change_request'), controller.resolve);

module.exports = router;
