const router = require('express').Router();
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const { requireDeveloperEmail } = requireRole;
const withAudit = require('../middleware/auditLogger');
const denyDeveloperWrite = require('../middleware/denyDeveloperWrite');
const userController = require('../controllers/userController');

// Applied only to the destructive user-maintenance endpoints below
// (cleanup/reset/seed/remove/sync). Day-to-day user management -- deactivate,
// reactivate, Edit Role, and account approve/reject -- remains available to
// the developer account.
const denyDevUser = denyDeveloperWrite('user');

// Only roles that assign/manage rotations need to browse or manage the user list.
router.get('/', authenticate, requireRole('admin', 'scheduler', 'dept_head'), userController.list);

// Developer-only: change a user's role. Gated to the developer account (not
// any admin) because a role change can grant full access. The before/after
// role is recorded in the audit log inside the controller.
router.patch('/:id/role', authenticate, requireDeveloperEmail, userController.updateRole);

// "Delete" a user account = deactivate (soft delete). Preserves rotation
// history/audit logs tied to the account; see userController.deactivate.
// User management is retained for the developer account: it may deactivate /
// reactivate accounts (alongside its Edit Role and account approve/reject
// tools). Only the destructive maintenance endpoints below stay blocked.
router.delete('/:id', authenticate, requireRole('admin', 'scheduler'), withAudit('delete', 'user'), userController.deactivate);
router.post('/:id/reactivate', authenticate, requireRole('admin', 'scheduler'), withAudit('edit', 'user'), userController.reactivate);

// Admin-only maintenance action: hard-delete duplicate seed users, keeping
// exactly one account per role.
router.post('/cleanup-duplicates', authenticate, denyDevUser, requireRole('admin'), userController.cleanupDuplicates);

// Admin-only maintenance action: wipe every user account and reprovision a
// merged Master Scheduler/Admin account plus a developer account.
router.post('/reset-all', authenticate, denyDevUser, requireRole('admin'), userController.resetAllUsers);

// Admin-only maintenance action: ensure one demo account exists per
// non-admin role (scheduler, dept_head, physician, program_manager,
// hospital_admin). Idempotent -- safe to call more than once.
router.post('/seed-demo-accounts', authenticate, denyDevUser, requireRole('admin'), userController.seedDemoAccounts);

// Admin-only maintenance action: permanently remove every demo account
// (anything ending in .demo@obgyn-rotation.local). Idempotent.
router.post('/remove-demo-accounts', authenticate, denyDevUser, requireRole('admin'), userController.removeDemoAccounts);

// Admin-only maintenance action: add the approval_status column to the live
// users table (see Account Creation Policy). Idempotent.
router.post('/sync-approval-column', authenticate, denyDevUser, requireRole('admin'), userController.syncApprovalColumn);

// Account Creation Policy:
//  - Any admin can view the pending list and approve/reject NON-admin
//    account requests.
//  - Admin-role account requests are additionally gated to the developer
//    account (ruvpalado@gmail.com) inside approveUser/rejectUser, so those
//    are effectively routed to the developer for final confirmation even
//    though the route itself allows any admin.
router.get('/pending', authenticate, requireRole('admin'), userController.listPending);
router.post('/:id/approve', authenticate, requireRole('admin'), withAudit('edit', 'user'), userController.approveUser);
router.post('/:id/reject', authenticate, requireRole('admin'), withAudit('edit', 'user'), userController.rejectUser);

module.exports = router;
