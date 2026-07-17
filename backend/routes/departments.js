const router = require('express').Router();
const authenticate = require('../middleware/auth');
const siteController = require('../controllers/siteController');

router.get('/', authenticate, siteController.listDepartments);

module.exports = router;
