const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { Block, AuditLog } = require('../models');
const { BLOCK_DEFS } = require('../seed/blockDefs');

router.get('/', authenticate, async (req, res) => {
  const blocks = await Block.findAll({ order: [['block_number', 'ASC']] });
  res.json(blocks);
});

// One-time / repeatable maintenance endpoint: re-applies the canonical
// Sept 2026 - Aug 2027 curriculum block dates (backend/seed/blockDefs.js) to
// whatever database this API instance is actually connected to. Lets an
// admin or scheduler fix stale block dates without needing shell/console
// access to the host.
router.post('/resync-dates', authenticate, async (req, res) => {
  if (!['admin', 'scheduler'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    const results = [];
    for (const def of BLOCK_DEFS) {
      const publishLeadDays = def.n % 4 === 0 ? 2 : 14;
      const startDateObj = new Date(def.start);
      const publishedAt = new Date(startDateObj);
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
      results.push({ block_number: def.n, matched: count });
    }

    const totalMatched = results.reduce((sum, r) => sum + r.matched, 0);
    await AuditLog.create({
      user_id: req.user.id,
      action: 'edit',
      entity_type: 'block',
      details: { note: 'resync-dates', totalMatched, results },
    });

    const blocks = await Block.findAll({ order: [['block_number', 'ASC']] });
    res.json({ message: 'Block dates resynced', totalMatched, results, blocks });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to resync block dates', details: err.message });
  }
});

module.exports = router;
