const router = require('express').Router();
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const denyDeveloperWrite = require('../middleware/denyDeveloperWrite');
const roleController = require('../controllers/roleController');

// Developer Account -- view-only on the roles reference table.
const denyDevRole = denyDeveloperWrite('role');

// Admin-only maintenance action: widen the roles ENUM and provision the
// program_manager / hospital_admin roles on a live database.
router.post('/sync', authenticate, denyDevRole, requireRole('admin'), roleController.syncRoles);

// Admin-only maintenance action: fully remove the 'scheduler' role, its
// accounts, and narrow the roles ENUM so it can't be selected again.
router.post('/remove-scheduler', authenticate, denyDevRole, requireRole('admin'), roleController.removeSchedulerRole);

module.exports = router;
