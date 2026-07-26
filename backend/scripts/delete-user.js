/**
 * One-off, transactional HARD DELETE of a user account and every row that
 * references it. IRREVERSIBLE -- take a database backup before running with
 * --confirm.
 *
 * The app normally only "deactivates" users (reversible); this script is the
 * deliberate exception for permanently purging an account. It runs everything
 * inside a single transaction (all-or-nothing) and, by default, only PRINTS
 * what it would remove. Pass --confirm to actually execute.
 *
 * FK-safe order (full purge -- audit logs are DELETED, not kept):
 *   1. rotation_weeks.approved_by_id   -> NULL   (keep the schedule week rows)
 *   2. rotation_assignments.physician_id -> NULL (keep assignment rows)
 *   3. change_requests.resolved_by_id  -> NULL
 *   4. change_requests WHERE requested_by_id = id  -> DELETE (NOT NULL link)
 *   5. notifications WHERE user_id = id            -> DELETE (NOT NULL link)
 *   6. audit_logs WHERE user_id = id               -> DELETE (full purge)
 *   7. users WHERE id = id                         -> DELETE
 *
 * Target database:
 *   - If DATABASE_URL is set, it connects there (use this to target PRODUCTION
 *     without editing .env -- grab the prod MySQL public URL from Railway).
 *   - Otherwise it uses the app's normal DB env (config/db.js).
 *
 * Usage:
 *   node scripts/delete-user.js obgyn@omsb.org            # dry run (counts only)
 *   node scripts/delete-user.js obgyn@omsb.org --confirm  # execute
 *
 * PowerShell, targeting production:
 *   $env:DATABASE_URL="mysql://USER:PASS@HOST:PORT/railway"
 *   node scripts/delete-user.js obgyn@omsb.org            # review counts first
 *   node scripts/delete-user.js obgyn@omsb.org --confirm  # then execute
 */
const { Sequelize } = require('sequelize');

const email = process.argv[2];
const confirm = process.argv.includes('--confirm');

if (!email || email.startsWith('--')) {
  console.error('Usage: node scripts/delete-user.js <email> [--confirm]');
  process.exit(1);
}

let sequelize;
if (process.env.DATABASE_URL) {
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'mysql',
    logging: false,
    // Managed MySQL (Railway) generally requires SSL on the public endpoint.
    // Set DB_SSL=false to disable for a plain local connection.
    dialectOptions: process.env.DB_SSL === 'false' ? {} : { ssl: { require: true, rejectUnauthorized: false } },
  });
} else {
  sequelize = require('../config/db');
}

async function countRows(sql, id) {
  const [rows] = await sequelize.query(sql, { replacements: [id] });
  return rows[0].n;
}

(async () => {
  try {
    await sequelize.authenticate();

    const [users] = await sequelize.query('SELECT id, full_name, email FROM users WHERE email = ?', { replacements: [email] });
    if (users.length === 0) {
      console.log(`No user found with email "${email}". Nothing to do.`);
      process.exit(0);
    }
    const user = users[0];
    const id = user.id;

    const counts = {
      notifications: await countRows('SELECT COUNT(*) n FROM notifications WHERE user_id = ?', id),
      changeRequestsFiled: await countRows('SELECT COUNT(*) n FROM change_requests WHERE requested_by_id = ?', id),
      changeRequestsResolved: await countRows('SELECT COUNT(*) n FROM change_requests WHERE resolved_by_id = ?', id),
      auditLogs: await countRows('SELECT COUNT(*) n FROM audit_logs WHERE user_id = ?', id),
      rotationAssignments: await countRows('SELECT COUNT(*) n FROM rotation_assignments WHERE physician_id = ?', id),
      weekApprovals: await countRows('SELECT COUNT(*) n FROM rotation_weeks WHERE approved_by_id = ?', id),
    };

    console.log(`\nTarget user: ${user.full_name} <${user.email}> (id ${id})`);
    console.log('Related rows found:');
    console.log(`  notifications (DELETE):              ${counts.notifications}`);
    console.log(`  change_requests filed (DELETE):      ${counts.changeRequestsFiled}`);
    console.log(`  change_requests resolved (unlink):   ${counts.changeRequestsResolved}`);
    console.log(`  audit_logs (DELETE - full purge):    ${counts.auditLogs}`);
    console.log(`  rotation_assignments (unlink):       ${counts.rotationAssignments}`);
    console.log(`  week approvals (unlink):             ${counts.weekApprovals}`);

    if (!confirm) {
      console.log('\nDRY RUN -- nothing was changed. Re-run with --confirm to execute the deletion.');
      process.exit(0);
    }

    const t = await sequelize.transaction();
    try {
      const o = { replacements: [id], transaction: t };
      await sequelize.query('UPDATE rotation_weeks SET approved_by_id = NULL WHERE approved_by_id = ?', o);
      await sequelize.query('UPDATE rotation_assignments SET physician_id = NULL WHERE physician_id = ?', o);
      await sequelize.query('UPDATE change_requests SET resolved_by_id = NULL WHERE resolved_by_id = ?', o);
      await sequelize.query('DELETE FROM change_requests WHERE requested_by_id = ?', o);
      await sequelize.query('DELETE FROM notifications WHERE user_id = ?', o);
      await sequelize.query('DELETE FROM audit_logs WHERE user_id = ?', o);
      await sequelize.query('DELETE FROM users WHERE id = ?', o);
      await t.commit();
      console.log(`\nDone. Permanently deleted "${email}" (id ${id}) and its related records.`);
    } catch (err) {
      await t.rollback();
      console.error('\nDeletion FAILED -- transaction rolled back, no changes made:', err.message);
      process.exit(1);
    }
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
