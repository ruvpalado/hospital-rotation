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

async function start() {
  try {
    await sequelize.authenticate();
    await sequelize.sync(); // for production use, migrate via sequelize-cli instead
    app.listen(PORT, () => console.log(`Hospital Rotation API listening on port ${PORT}`));
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
