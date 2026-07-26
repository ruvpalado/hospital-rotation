require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cron = require('node-cron');

// Fail-loud on a missing/placeholder JWT secret -- tokens signed with a
// well-known default are trivially forgeable, so surface it at boot rather
// than shipping an insecure deployment silently.
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'replace_with_a_long_random_string') {
  const msg = '[startup][SECURITY] JWT_SECRET is missing or still the placeholder value -- set a long random JWT_SECRET in the environment.';
  // In production a forgeable/absent secret is unacceptable: refuse to boot
  // rather than serve tokens anyone could mint. Locally it's just a warning.
  if (process.env.NODE_ENV === 'production') {
    console.error(`${msg} Refusing to start in production.`);
    process.exit(1);
  }
  console.warn(msg);
}

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { sequelize, User, Role, RotationAssignment, Block } = require('./models');
const { sendUpcomingRotationReminder } = require('./services/notificationService');

const authRoutes = require('./routes/auth');
const siteRoutes = require('./routes/sites');
const departmentRoutes = require('./routes/departments');
const scheduleRoutes = require('./routes/schedules');
const changeRequestRoutes = require('./routes/changeRequests');
const notificationRoutes = require('./routes/notifications');
const auditLogRoutes = require('./routes/auditlogs');
const kpiRoutes = require('./routes/kpis');
const blockRoutes = require('./routes/blocks');
const userRoutes = require('./routes/users');
const roleRoutes = require('./routes/roles');
const physicianRosterRoutes = require('./routes/physicianRoster');

const app = express();
// Behind Railway's proxy: trust the first proxy hop so express-rate-limit and
// req.ip resolve the real client IP from X-Forwarded-For instead of bucketing
// every request under the proxy's own address.
app.set('trust proxy', 1);
// This is a live scheduling API, not static content -- always serve fresh data.
// Without this, Express's automatic ETag/304 responses get treated as request
// failures by axios (its default validateStatus only accepts 200-299), which
// surfaces in the browser as "Network Error" or "status code 304".
app.disable('etag');
app.use(helmet());
// CORS: allow the deployed frontend (FRONTEND_URL) plus localhost dev
// origins, so a developer running the frontend locally (npm run dev on
// :3000) can talk to this backend. If FRONTEND_URL isn't set at all, fall
// back to allow-all so a fresh local backend works out of the box.
const LOCAL_DEV_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000'];
const allowedOrigins = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL, ...LOCAL_DEV_ORIGINS]
  : null; // null -> allow all (no FRONTEND_URL configured)
console.log(`[startup] CORS allowed origins: ${allowedOrigins ? JSON.stringify(allowedOrigins) : 'all (FRONTEND_URL unset)'}`);
app.use(cors({
  origin: (origin, callback) => {
    // Non-browser clients (curl, server-to-server) send no Origin -> allow.
    if (!origin || !allowedOrigins) return callback(null, true);
    return callback(null, allowedOrigins.includes(origin));
  },
}));
app.use(express.json());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use('/api', authRoutes);
app.use('/api/sites', siteRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/change-requests', changeRequestRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/auditlogs', auditLogRoutes);
app.use('/api/kpis', kpiRoutes);
app.use('/api/blocks', blockRoutes);
app.use('/api/users', userRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/physician-roster', physicianRosterRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// Send reminders 3-5 days before a block's rotation changes start, once a day at 07:00.
cron.schedule('0 7 * * *', async () => {
  try {
    const now = new Date();
    const in3 = new Date(now); in3.setDate(in3.getDate() + 3);
    const in5 = new Date(now); in5.setDate(in5.getDate() + 5);
    const upcomingBlocks = await Block.findAll();
    for (const block of upcomingBlocks) {
      const start = new Date(block.start_date);
      if (start >= in3 && start <= in5) {
        const assignments = await RotationAssignment.findAll({ where: { block_id: block.id } });
        for (const a of assignments) {
          const physician = await User.findByPk(a.physician_id);
          if (physician) await sendUpcomingRotationReminder(physician, a, block);
        }
      }
    }
  } catch (err) {
    console.error('Cron reminder job failed:', err.message);
  }
});

const PORT = process.env.PORT || 5000;

// Runs before the server accepts any requests. Since sequelize.sync() (no
// force/alter) only creates missing tables and never alters existing ones,
// a new NOT NULL column with no default would otherwise require someone to
// call an admin-only endpoint to add it -- but login itself would already be
// broken (User queries reference the column) before anyone could log in to
// call that endpoint. Running it here, ahead of app.listen(), avoids that
// chicken-and-egg problem entirely. Idempotent -- checked via SHOW COLUMNS
// every boot, cheap no-op once the column exists.
async function ensureApprovalStatusColumn() {
  const [existingColumns] = await sequelize.query('SHOW COLUMNS FROM users');
  const alreadyExists = existingColumns.some((c) => c.Field === 'approval_status');
  if (!alreadyExists) {
    await sequelize.query(
      "ALTER TABLE users ADD COLUMN approval_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'approved'"
    );
    console.log('[startup] Added users.approval_status column (existing users grandfathered in as approved)');
  }
}

// Same rationale/pattern as ensureApprovalStatusColumn above: the Physician
// field on Add Rotation Schedule now accepts free-typed names, not just
// registered physician accounts, so rotation_assignments.physician_id has to
// become nullable and gains a physician_name column to hold the typed text
// when there's no matching account. Existing rows get physician_name
// backfilled from their linked physician's name so display code has one
// consistent field to read regardless of when the row was created.
async function ensurePhysicianNameColumn() {
  const [existingColumns] = await sequelize.query('SHOW COLUMNS FROM rotation_assignments');
  const hasPhysicianName = existingColumns.some((c) => c.Field === 'physician_name');
  if (!hasPhysicianName) {
    await sequelize.query('ALTER TABLE rotation_assignments ADD COLUMN physician_name VARCHAR(255) NULL');
    await sequelize.query(
      'UPDATE rotation_assignments ra JOIN users u ON u.id = ra.physician_id SET ra.physician_name = u.full_name WHERE ra.physician_name IS NULL'
    );
    console.log('[startup] Added rotation_assignments.physician_name column and backfilled existing rows from linked users');
  }
  const physicianIdColumn = existingColumns.find((c) => c.Field === 'physician_id');
  if (physicianIdColumn && physicianIdColumn.Null === 'NO') {
    await sequelize.query('ALTER TABLE rotation_assignments MODIFY COLUMN physician_id INT NULL');
    console.log('[startup] Relaxed rotation_assignments.physician_id to nullable (free-typed physician names allowed)');
  }
}

// Same rationale/pattern as the migrations above: Forgot Password needs
// somewhere to keep a hashed one-time reset code and its expiry per user.
async function ensureResetCodeColumns() {
  const [existingColumns] = await sequelize.query('SHOW COLUMNS FROM users');
  const hasResetCodeHash = existingColumns.some((c) => c.Field === 'reset_code_hash');
  if (!hasResetCodeHash) {
    await sequelize.query('ALTER TABLE users ADD COLUMN reset_code_hash VARCHAR(255) NULL');
    console.log('[startup] Added users.reset_code_hash column');
  }
  const hasResetCodeExpiresAt = existingColumns.some((c) => c.Field === 'reset_code_expires_at');
  if (!hasResetCodeExpiresAt) {
    await sequelize.query('ALTER TABLE users ADD COLUMN reset_code_expires_at DATETIME NULL');
    console.log('[startup] Added users.reset_code_expires_at column');
  }
  // Brute-force guard counter for the current reset code (see authController).
  const hasResetCodeAttempts = existingColumns.some((c) => c.Field === 'reset_code_attempts');
  if (!hasResetCodeAttempts) {
    await sequelize.query('ALTER TABLE users ADD COLUMN reset_code_attempts INT NOT NULL DEFAULT 0');
    console.log('[startup] Added users.reset_code_attempts column');
  }
}

// Weekly Status Update workflow: rotation_weeks gains proposed_status to hold
// a physician's proposed weekly status pending admin approval (see
// scheduleController.proposeWeekStatus / approveWeekStatus).
async function ensureProposedStatusColumn() {
  const [existingColumns] = await sequelize.query('SHOW COLUMNS FROM rotation_weeks');
  const hasProposedStatus = existingColumns.some((c) => c.Field === 'proposed_status');
  if (!hasProposedStatus) {
    await sequelize.query(
      "ALTER TABLE rotation_weeks ADD COLUMN proposed_status ENUM('attended','maternity_leave','annual_leave','absent','pending') NULL"
    );
    console.log('[startup] Added rotation_weeks.proposed_status column');
  }
  // Approval audit-trail columns (who finalized the week status, and when).
  const hasApprovedBy = existingColumns.some((c) => c.Field === 'approved_by_id');
  if (!hasApprovedBy) {
    await sequelize.query('ALTER TABLE rotation_weeks ADD COLUMN approved_by_id INT NULL');
    await sequelize.query('ALTER TABLE rotation_weeks ADD COLUMN approved_at DATETIME NULL');
    console.log('[startup] Added rotation_weeks.approved_by_id / approved_at columns');
  }
}

// Permanent developer account: re-provisioned on every server boot, so it
// survives anything that wipes or rebuilds the database (the development
// environment's pre-deploy seed, a fresh production database, a manual
// reset). findOrCreate keyed on email means an EXISTING account is left
// completely untouched -- in particular, a password the developer changed
// via Forgot Password is never reset back to the default; only a missing
// account gets (re)created with the default password. If it exists but was
// deactivated/unapproved somehow, those two flags are repaired so the
// account can always log in.
const DEVELOPER_EMAIL = 'ruvpalado@gmail.com';
// The developer password comes ONLY from the DEVELOPER_PASSWORD env var. If
// it isn't set we generate a random, un-guessable one rather than falling back
// to a value committed in source (a hardcoded default becomes the live
// super-admin password the moment anyone reads the repo). This is used only
// when the account is first created; an existing account's password is never
// overwritten here, so a missing env var can't lock the developer out.
const DEVELOPER_DEFAULT_PASSWORD = process.env.DEVELOPER_PASSWORD
  || crypto.randomBytes(24).toString('base64url');

// roles.key is a MySQL ENUM; on databases created before the 'developer'
// role existed the column has to be widened before we can insert it (a plain
// sequelize.sync() never alters an existing ENUM). Idempotent -- re-running
// with 'developer' already present is a harmless no-op.
async function ensureDeveloperRoleEnum() {
  const [columns] = await sequelize.query('SHOW COLUMNS FROM roles LIKE "key"');
  const type = columns && columns[0] && columns[0].Type ? columns[0].Type : '';
  if (!type.includes("'developer'")) {
    await sequelize.query(
      "ALTER TABLE roles MODIFY COLUMN `key` ENUM('developer','admin','dept_head','physician','program_manager','hospital_admin') NOT NULL"
    );
    console.log('[startup] Added \'developer\' to roles.key ENUM');
  }
}

async function ensureDeveloperAccount() {
  await ensureDeveloperRoleEnum();
  // The 'developer' role may not exist yet on databases seeded before it was
  // introduced -- create it on the fly so the account below can use it.
  const [developerRole] = await Role.findOrCreate({
    where: { key: 'developer' },
    defaults: { key: 'developer', label: 'Developer' },
  });

  const [user, created] = await User.findOrCreate({
    where: { email: DEVELOPER_EMAIL },
    defaults: {
      full_name: 'Ruel Palado (Developer)',
      email: DEVELOPER_EMAIL,
      password_hash: await bcrypt.hash(DEVELOPER_DEFAULT_PASSWORD, 10),
      role_id: developerRole.id,
      language_pref: 'en',
      is_active: true,
      approval_status: 'approved',
    },
  });

  if (created) {
    const how = process.env.DEVELOPER_PASSWORD
      ? 'password taken from DEVELOPER_PASSWORD env'
      : 'RANDOM one-time password (not logged) -- set your own via Forgot Password';
    console.log(`[startup] Developer account ${DEVELOPER_EMAIL} created (${how}).`);
    return;
  }

  // Existing account: never touch the password, but make sure it can log in
  // and holds the developer role the developer-gated endpoints depend on
  // (this also migrates an account previously provisioned as 'admin').
  let repaired = false;
  if (!user.is_active) { user.is_active = true; repaired = true; }
  if (user.approval_status !== 'approved') { user.approval_status = 'approved'; repaired = true; }
  if (user.role_id !== developerRole.id) { user.role_id = developerRole.id; repaired = true; }
  if (repaired) {
    await user.save();
    console.log(`[startup] Developer account ${DEVELOPER_EMAIL} repaired (active/approved/developer role restored).`);
  }
}

async function start() {
  try {
    await sequelize.authenticate();
    await sequelize.sync(); // for production use, migrate via sequelize-cli instead
    await ensureApprovalStatusColumn();
    await ensurePhysicianNameColumn();
    await ensureResetCodeColumns();
    await ensureProposedStatusColumn();
    await ensureDeveloperAccount();
    app.listen(PORT, () => console.log(`Hospital Rotation API listening on port ${PORT}`));
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
