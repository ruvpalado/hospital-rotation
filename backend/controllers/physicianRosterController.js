const { parse } = require('csv-parse/sync');
const { PhysicianRoster, AuditLog } = require('../models');

/**
 * Every authenticated user who can reach the Add Schedule form needs this
 * list (it's merged into the Physician autocomplete alongside real
 * registered physician accounts -- see frontend/src/pages/AddScheduleModal.js).
 * Not developer-gated; only the upload/mutation below is.
 */
exports.listRoster = async (req, res) => {
  const entries = await PhysicianRoster.findAll({ order: [['full_name', 'ASC']] });
  res.json(entries.map((e) => ({ id: e.id, fullName: e.full_name })));
};

/**
 * Developer-only (see routes/physicianRoster.js requireDeveloperEmail):
 * bulk-adds names to the roster from an uploaded CSV. Expected columns
 * (header row required): a single `name` (or `full_name`) column -- nothing
 * else. No accounts, logins, or emails are created; this purely feeds the
 * Physician autocomplete in Add Schedule.
 *
 * Row-tolerant like the rest of this app's bulk-upload endpoints: blank
 * names and names that already exist in the roster (case-insensitive) are
 * skipped with a reason rather than failing the whole file.
 */
exports.uploadRoster = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file uploaded. Send it as multipart/form-data with field name "file".' });
    }

    let rows;
    try {
      rows = parse(req.file.buffer.toString('utf8'), { columns: true, skip_empty_lines: true, trim: true });
    } catch (parseErr) {
      return res.status(400).json({ error: 'Could not parse CSV file.', details: parseErr.message });
    }

    const existingEntries = await PhysicianRoster.findAll({ attributes: ['full_name'] });
    const existingNamesLower = new Set(existingEntries.map((e) => e.full_name.toLowerCase()));

    const created = [];
    const skipped = [];

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      const rowNumber = index + 2; // +1 for 0-index, +1 for the header row

      const name = (row.name || row.full_name || row.fullName || '').trim();

      if (!name) {
        skipped.push({ row: rowNumber, name: null, reason: 'Missing name' });
        continue;
      }
      if (existingNamesLower.has(name.toLowerCase())) {
        skipped.push({ row: rowNumber, name, reason: 'Already in the roster' });
        continue;
      }

      const entry = await PhysicianRoster.create({ full_name: name });
      existingNamesLower.add(name.toLowerCase()); // guards against duplicate rows within the same file
      created.push({ row: rowNumber, id: entry.id, name });
    }

    await AuditLog.create({
      user_id: req.user.id,
      action: 'create',
      entity_type: 'physician_roster_upload',
      details: { createdCount: created.length, skippedCount: skipped.length },
    });

    res.json({
      message: `${created.length} name(s) added to the physician roster, ${skipped.length} row(s) skipped.`,
      created,
      skipped,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process CSV upload', details: err.message });
  }
};
