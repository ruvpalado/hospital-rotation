require('dotenv').config();
/**
 * One-off update: applies the approved Sept 2026 - Aug 2027 curriculum
 * schedule (see ../seed/blockDefs.js) to the 13 Block rows that already
 * exist in the database, matched by block_number. Does NOT touch anything
 * else -- roles, sites, departments, users, rotation assignments/weeks,
 * notifications, and audit logs are left exactly as they are, and no tables
 * are dropped/recreated (unlike `npm run seed`).
 *
 * Usage (from the backend/ directory): npm run update-block-dates
 */
const { sequelize, Block } = require('../models');
const { BLOCK_DEFS } = require('../seed/blockDefs');

async function run() {
  let updatedCount = 0;
  for (const def of BLOCK_DEFS) {
    const publishLeadDays = def.n % 4 === 0 ? 2 : 14;
    const publishedAt = new Date(def.start);
    publishedAt.setDate(publishedAt.getDate() - publishLeadDays);

    const [count] = await Block.update(
      {
        start_date: def.start,
        end_date: def.end,
        total_weeks: def.weeks,
        published_at: publishedAt,
      },
      { where: { block_number: def.n } }
    );
    updatedCount += count;
    console.log(`Block ${def.n}: ${def.start} to ${def.end} (${def.weeks} weeks) -- ${count} row(s) updated`);
  }

  console.log(`\nDone. ${updatedCount} of ${BLOCK_DEFS.length} block records updated.`);
  if (updatedCount < BLOCK_DEFS.length) {
    console.log('Fewer rows than expected were updated -- if this is a brand new database with no blocks yet, run `npm run seed` instead.');
  }

  await sequelize.close();
}

run().catch((err) => {
  console.error('Failed to update block dates:', err);
  process.exit(1);
});
