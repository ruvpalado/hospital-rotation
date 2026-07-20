const router = require('express').Router();
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const siteController = require('../controllers/siteController');

// Public for the same reason as sites.js: the Registration form (pre-login)
// needs to populate its Department dropdown.
router.get('/', siteController.listDepartments);

// Admin-only maintenance action: rename a department by its code, e.g.
// { "code": "CLINIC", "name": "GYNE Clinic" }.
router.patch('/rename', authenticate, requireRole('admin'), siteController.renameDepartment);

module.exports = router;
