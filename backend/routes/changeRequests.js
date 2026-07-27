const router = require('express').Router();
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const withAudit = require('../middleware/auditLogger');
const denyDeveloperWrite = require('../middleware/denyDeveloperWrite');
const controller = require('../controllers/changeRequestController');

// Developer Account -- view-only on change requests (a Program Administrator input).
const denyDevCR = denyDeveloperWrite('change_request');

router.get('/', authenticate, controller.list);
router.post('/', authenticate, denyDevCR, withAudit('create', 'change_request'), controller.create);
router.post('/:id/resolve', authenticate, denyDevCR, requireRole('admin', 'dept_head'), withAudit('approve', 'change_request'), controller.resolve);

module.exports = router;
