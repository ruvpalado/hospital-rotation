const router = require('express').Router();
const authenticate = require('../middleware/auth');
const controller = require('../controllers/kpiController');

router.get('/overview', authenticate, controller.overview);
router.get('/physician/:id', authenticate, controller.physicianKpis);

module.exports = router;
