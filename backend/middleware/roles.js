// Usage: requireRole('admin', 'scheduler')
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: insufficient role', required: allowedRoles });
    }
    next();
  };
}

// Per Audit and Account Creation Policy: the audit log is restricted to
// exactly one account (ruvpalado@gmail.com), regardless of role. Relies on
// `email` being present in the JWT payload (see authController.signToken) --
// a token issued before that field existed won't carry it, so this denies
// access (safe default) until that session logs in again.
function requireDeveloperEmail(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  if (req.user.email !== 'ruvpalado@gmail.com') {
    return res.status(403).json({ error: 'Forbidden: the audit log is restricted to the developer account' });
  }
  next();
}

module.exports = requireRole;
module.exports.requireDeveloperEmail = requireDeveloperEmail;
