const { AuditLog } = require('../models');

const DEVELOPER_EMAIL = 'ruvpalado@gmail.com';

/**
 * Developer Account -- Schedule Module Restriction.
 *
 * The developer account may VIEW schedules but must not EDIT them. Because the
 * developer role is otherwise a superset of admin (see middleware/roles.js), a
 * plain requireRole check would let it through -- so this explicitly denies the
 * developer account on schedule-edit routes and records the blocked attempt in
 * the audit log for traceability. Applied ahead of requireRole on PUT
 * /schedules/:id (see routes/schedules.js).
 */
module.exports = async function restrictDeveloperScheduleEdit(req, res, next) {
  const isDeveloper = req.user && (req.user.role === 'developer' || req.user.email === DEVELOPER_EMAIL);
  if (!isDeveloper) return next();

  // Record the blocked attempt. A failure to write the audit row must not
  // change the outcome -- the edit is denied either way.
  try {
    await AuditLog.create({
      user_id: req.user.id,
      action: 'edit',
      entity_type: 'schedule_edit_blocked',
      entity_id: Number(req.params.id) || null,
      details: {
        reason: 'Developer account is not permitted to edit schedules',
        method: req.method,
        path: req.originalUrl,
      },
    });
  } catch (err) {
    console.error('Failed to audit blocked developer schedule edit:', err.message);
  }

  return res.status(403).json({
    error: 'The developer account can view schedules but is not permitted to edit them.',
  });
};
