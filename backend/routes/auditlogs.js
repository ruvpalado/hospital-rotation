const router = require('express').Router();
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const controller = require('../controllers/auditController');

router.get('/', authenticate, requireRole('admin'), controller.list);

module.exports = router;
