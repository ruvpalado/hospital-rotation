const router = require('express').Router();
const authenticate = require('../middleware/auth');
const siteController = require('../controllers/siteController');

// Public: the Registration form (used before login exists) needs to populate
// its Site dropdown, so this listing must not require authentication.
router.get('/', siteController.listSites);
// Capacity/scheduling data stays behind login -- only used by already
// authenticated schedulers/admins building rotation assignments.
router.get('/site-departments', authenticate, siteController.listSiteDepartments);

module.exports = router;
