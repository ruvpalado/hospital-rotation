const router = require('express').Router();
const multer = require('multer');
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const { requireDeveloperEmail } = requireRole;
const physicianRosterController = require('../controllers/physicianRosterController');

// Uploads are parsed in memory (never written to disk) and capped at 5MB --
// comfortably enough for a physician name list in CSV or Excel form.
const listUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Any authenticated user who can open Add Schedule needs this list (it feeds
// the Physician autocomplete), so the read isn't gated beyond being logged in.
router.get('/', authenticate, physicianRosterController.listRoster);

// Developer-only mutations: bulk upload (CSV/Excel), manual add, delete.
router.post(
  '/upload',
  authenticate,
  requireDeveloperEmail,
  listUpload.single('file'),
  physicianRosterController.uploadRoster
);
router.post('/', authenticate, requireDeveloperEmail, physicianRosterController.addName);
router.delete('/:id', authenticate, requireDeveloperEmail, physicianRosterController.deleteName);

module.exports = router;
