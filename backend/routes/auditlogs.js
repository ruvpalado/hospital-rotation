const router = require('express').Router();
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const controller = require('../controllers/auditController');

router.get('/', authenticate, requireRole('admin'), controller.list);

// Admin-only maintenance action: permanently delete every audit log entry.
// The feature/table stays intact -- new actions keep getting logged.
router.delete('/', authenticate, requireRole('admin'), controller.clearAll);

module.exports = router;
