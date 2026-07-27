const { AuditLog } = require('../models');

const DEVELOPER_EMAIL = 'ruvpalado@gmail.com';

/**
 * Developer Account -- view-only on Program-Administrator-managed data.
 *
 * The developer role is otherwise a superset of the Program Administrator (see
 * middleware/roles.js), so a plain requireRole check would let it write. This
 * factory returns middleware that denies the developer account on a specific
 * WRITE route and records the blocked attempt in the audit log for
 * traceability. Applied ahead of requireRole on every route that modifies data
 * the Program Administrator provides.
 *
 * Deliberately NOT applied to the developer's own maintenance tools (Edit
 * Role, Physician List, schedule delete, Audit Log) or to account
 * approval/rejection (which is developer-gated governance, not a PA input).
 *
 * @param {string} entityType e.g. 'schedule', 'user', 'change_request'
 */
module.exports = function denyDeveloperWrite(entityType) {
  return async function (req, res, next) {
    const isDeveloper = req.user && (req.user.role === 'developer' || req.user.email === DEVELOPER_EMAIL);
    if (!isDeveloper) return next();

    // Record the blocked attempt. Audit failure must not change the outcome.
    try {
      await AuditLog.create({
        user_id: req.user.id,
        action: 'edit',
        entity_type: `${entityType}_edit_blocked`,
        entity_id: Number(req.params.id) || Number(req.params.weekId) || null,
        details: {
          reason: 'Developer account is view-only and cannot modify Program Administrator data',
          method: req.method,
          path: req.originalUrl,
        },
      });
    } catch (err) {
      console.error('Failed to audit blocked developer write:', err.message);
    }

    return res.status(403).json({
      error: 'The developer account is view-only and cannot modify Program Administrator data.',
    });
  };
};
