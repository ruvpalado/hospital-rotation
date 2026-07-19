const router = require('express').Router();
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const userController = require('../controllers/userController');

// Only roles that assign/manage rotations need to browse the user list.
router.get('/', authenticate, requireRole('admin', 'scheduler', 'dept_head'), userController.list);

module.exports = router;
