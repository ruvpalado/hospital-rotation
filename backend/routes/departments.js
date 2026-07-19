const router = require('express').Router();
const siteController = require('../controllers/siteController');

// Public for the same reason as sites.js: the Registration form (pre-login)
// needs to populate its Department dropdown.
router.get('/', siteController.listDepartments);

module.exports = router;
