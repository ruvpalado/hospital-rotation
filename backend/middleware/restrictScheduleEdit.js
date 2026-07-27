// Superseded by the generic middleware/denyDeveloperWrite.js. Kept as a thin,
// backward-compatible alias bound to the 'schedule' entity so existing imports
// keep working. See denyDeveloperWrite.js for the full rationale.
module.exports = require('./denyDeveloperWrite')('schedule');
