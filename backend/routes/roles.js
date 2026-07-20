const router = require('express').Router();
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const roleController = require('../controllers/roleController');

// Admin-only maintenance action: widen the roles ENUM and provision the
// program_manager / hospital_admin roles on a live database.
router.post('/sync', authenticate, requireRole('admin'), roleController.syncRoles);

module.exports = router;
