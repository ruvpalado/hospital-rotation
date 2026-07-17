const { AuditLog } = require('../models');

// Wrap a route handler to auto-record an audit entry after it completes.
function withAudit(action, entityType) {
  return (req, res, next) => {
    const origJson = res.json.bind(res);
    res.json = (body) => {
      AuditLog.create({
        user_id: req.user ? req.user.id : null,
        action,
        entity_type: entityType,
        entity_id: (body && body.id) || (req.params && req.params.id) || null,
        details: { method: req.method, path: req.originalUrl, body: req.body },
        ip_address: req.ip,
      }).catch((e) => console.error('Audit log failed:', e.message));
      return origJson(body);
    };
    next();
  };
}

module.exports = withAudit;
