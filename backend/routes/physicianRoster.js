const router = require('express').Router();
const multer = require('multer');
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const { requireDeveloperEmail } = requireRole;
const physicianRosterController = require('../controllers/physicianRosterController');

// CSV uploads are parsed in memory (never written to disk) and capped at
// 2MB, comfortably more than enough for a name list.
const csvUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

// Any authenticated user who can open Add Schedule needs this list (it feeds
// the Physician autocomplete), so this isn't role-gated beyond being logged in.
router.get('/', authenticate, physicianRosterController.listRoster);

// Developer-only: bulk-add names via CSV.
router.post(
  '/upload',
  authenticate,
  requireDeveloperEmail,
  csvUpload.single('file'),
  physicianRosterController.uploadRoster
);

module.exports = router;
