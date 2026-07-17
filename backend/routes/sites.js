const router = require('express').Router();
const authenticate = require('../middleware/auth');
const siteController = require('../controllers/siteController');

router.get('/', authenticate, siteController.listSites);
router.get('/site-departments', authenticate, siteController.listSiteDepartments);

module.exports = router;
