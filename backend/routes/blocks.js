const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { Block } = require('../models');

router.get('/', authenticate, async (req, res) => {
  const blocks = await Block.findAll({ order: [['block_number', 'ASC']] });
  res.json(blocks);
});

module.exports = router;
