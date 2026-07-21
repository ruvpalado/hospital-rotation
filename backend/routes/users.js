const router = require('express').Router();
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const withAudit = require('../middleware/auditLogger');
const userController = require('../controllers/userController');

// Only roles that assign/manage rotations need to browse or manage the user list.
router.get('/', authenticate, requireRole('admin', 'scheduler', 'dept_head'), userController.list);

// "Delete" a user account = deactivate (soft delete). Preserves rotation
// history/audit logs tied to the account; see userController.deactivate.
router.delete('/:id', authenticate, requireRole('admin', 'scheduler'), withAudit('delete', 'user'), userController.deactivate);
router.post('/:id/reactivate', authenticate, requireRole('admin', 'scheduler'), withAudit('edit', 'user'), userController.reactivate);

// Admin-only maintenance action: hard-delete duplicate seed users, keeping
// exactly one account per role.
router.post('/cleanup-duplicates', authenticate, requireRole('admin'), userController.cleanupDuplicates);

// Admin-only maintenance action: wipe every user account and reprovision a
// merged Master Scheduler/Admin account plus a developer account.
router.post('/reset-all', authenticate, requireRole('admin'), userController.resetAllUsers);

// Admin-only maintenance action: ensure one demo account exists per
// non-admin role (scheduler, dept_head, physician, program_manager,
// hospital_admin). Idempotent -- safe to call more than once.
router.post('/seed-demo-accounts', authenticate, requireRole('admin'), userController.seedDemoAccounts);

// Admin-only maintenance action: permanently remove every demo account
// (anything ending in .demo@obgyn-rotation.local). Idempotent.
router.post('/remove-demo-accounts', authenticate, requireRole('admin'), userController.removeDemoAccounts);

// Admin-only maintenance action: add the approval_status column to the live
// users table (see Account Creation Policy). Idempotent.
router.post('/sync-approval-column', authenticate, requireRole('admin'), userController.syncApprovalColumn);

// Account Creation Policy: pending self-registrations awaiting approval.
// Approving/rejecting an admin-role request is further gated inside the
// controller to the developer account only; non-admin requests can be
// actioned by any admin.
router.get('/pending', authenticate, requireRole('admin'), userController.listPending);
router.post('/:id/approve', authenticate, requireRole('admin'), withAudit('edit', 'user'), userController.approveUser);
router.post('/:id/reject', authenticate, requireRole('admin'), withAudit('edit', 'user'), userController.rejectUser);

module.exports = router;
