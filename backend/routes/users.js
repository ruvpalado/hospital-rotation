const router = require('express').Router();
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const withAudit = require('../middleware/auditLogger');
const userController = require('../controllers/userController');

// Only roles that assign/manage rotations need to browse or manage the user list.
router.get('/', authenticate, requireRole('admin', 'scheduler', 'dept_head'), userController.list);

// "Delete" a user account = deactivate (soft delete). Preserves rotation
// history/audit logs tied to the account; see userController.deactivate.
router.delete('/:id', authenticate, requireRole('admin', 'scheduler'), withAudit('delete', 'user'), userController.deactivate);
router.post('/:id/reactivate', authenticate, requireRole('admin', 'scheduler'), withAudit('edit', 'user'), userController.reactivate);

module.exports = router;
