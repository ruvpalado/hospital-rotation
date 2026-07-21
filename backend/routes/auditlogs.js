const router = require('express').Router();
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const { requireDeveloperEmail } = requireRole;
const controller = require('../controllers/auditController');

// Per Audit and Account Creation Policy: exclusively accessible via the
// ruvpalado@gmail.com account, regardless of role.
router.get('/', authenticate, requireDeveloperEmail, controller.list);

// Maintenance action: permanently delete every audit log entry. The
// feature/table stays intact -- new actions keep getting logged.
router.delete('/', authenticate, requireDeveloperEmail, controller.clearAll);

module.exports = router;
