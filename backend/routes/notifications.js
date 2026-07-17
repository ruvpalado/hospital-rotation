const router = require('express').Router();
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const controller = require('../controllers/notificationController');

router.get('/', authenticate, controller.listForUser);
router.get('/all', authenticate, requireRole('admin'), controller.listAll);

module.exports = router;
