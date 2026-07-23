require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cron = require('node-cron');

const { sequelize, User, RotationAssignment, Block } = require('./models');
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
// This is a live scheduling API, not static content -- always serve fresh data.
// Without this, Express's automatic ETag/304 responses get treated as request
// failures by axios (its default validateStatus only accepts 200-299), which
// surfaces in the browser as "Network Error" or "status code 304".
app.disable('etag');
app.use(helmet());
// In production, restrict to the deployed frontend's origin via FRONTEND_URL.
// Falls back to allow-all so local development keeps working out of the box.
const allowedOrigin = process.env.FRONTEND_URL || '*';
console.log(`[startup] CORS allowed origin resolved to: "${allowedOrigin}" (raw FRONTEND_URL env var: ${JSON.stringify(process.env.FRONTEND_URL)})`);
app.use(cors({ origin: allowedOrigin }));
app.use(express.json());
app.use(morgan('dev'));

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
}

async function start() {
  try {
    await sequelize.authenticate();
    await sequelize.sync(); // for production use, migrate via sequelize-cli instead
    await ensureApprovalStatusColumn();
    await ensurePhysicianNameColumn();
    await ensureResetCodeColumns();
    app.listen(PORT, () => console.log(`Hospital Rotation API listening on port ${PORT}`));
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
